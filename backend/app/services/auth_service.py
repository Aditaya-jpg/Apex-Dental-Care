from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.config import settings
from app.models.student import Student
from app.models.user import User
from app.security.hashing import verify_password
from app.security.tokens import create_access_token, generate_refresh_token, hash_token


def _ensure_active_user_and_student(db: Session, user: User) -> None:
    """Reject inactive or revoked users (including removed/revoked students)."""
    if user.revoked_at is not None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "ACCOUNT_REVOKED", "message": "Account access has been revoked or deactivated."},
        )
    if user.role == "student":
        active_student = db.query(Student).filter(
            Student.user_id == user.id,
            Student.is_active == True,
            Student.revoked_at.is_(None),
        ).first()
        if not active_student:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "ACCOUNT_REVOKED", "message": "Student access has been revoked."},
            )


def _prune_refresh_tokens(tokens: list[dict] | None, now: datetime) -> list[dict]:
    if not tokens:
        return []
    valid = []
    for entry in tokens:
        exp_raw = entry.get("expires_at")
        if not exp_raw:
            continue
        try:
            exp_dt = datetime.fromisoformat(exp_raw)
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=UTC)
            if exp_dt > now:
                valid.append(entry)
        except Exception:
            continue
    return valid[-10:]


class AuthService:
    @staticmethod
    def authenticate_user(
        db: Session,
        username_or_email: str,
        password: str,
        request: Request | None = None,
    ) -> tuple[User, str, str]:
        """Authenticate user with lock protection, revocation check, and token_version claim."""
        lookup = username_or_email.strip()
        user = db.query(User).filter(
            (User.email == lookup.lower()) | (User.username == lookup)
        ).first()

        if not user:
            log_audit_event(
                db=db,
                action="LOGIN_FAILURE",
                user_email=lookup,
                entity_name="User",
                details={"reason": "User not found"},
                request=request,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_CREDENTIALS", "message": "Incorrect username/email or password."},
            )

        now = datetime.now(UTC)
        if user.locked_until:
            locked = user.locked_until.replace(tzinfo=UTC) if user.locked_until.tzinfo is None else user.locked_until
            if locked > now:
                log_audit_event(
                    db=db,
                    action="LOGIN_LOCKED",
                    user=user,
                    entity_name="User",
                    entity_id=str(user.id),
                    details={"locked_until": str(user.locked_until)},
                    request=request,
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"code": "ACCOUNT_LOCKED", "message": "Account is temporarily locked. Try again later."},
                )

        _ensure_active_user_and_student(db, user)

        if not verify_password(password, user.password_hash):
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.locked_until = now + timedelta(minutes=15)
                info = "Account locked for 15 minutes due to 5 consecutive failures."
            else:
                info = f"Failed attempts: {user.failed_login_attempts}"

            db.commit()
            log_audit_event(
                db=db,
                action="LOGIN_FAILURE",
                user=user,
                entity_name="User",
                entity_id=str(user.id),
                details={"reason": "Password mismatch", "attempts": user.failed_login_attempts, "info": info},
                request=request,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_CREDENTIALS", "message": "Incorrect username/email or password."},
            )

        # Reset failed attempts and record login timestamp
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = now

        access_token = create_access_token(
            data={
                "sub": str(user.id),
                "role": user.role,
                "email": user.email,
                "name": user.full_name,
                "tv": user.token_version,
                "is_admin": user.is_admin,
            }
        )
        raw_refresh_token = generate_refresh_token()
        refresh_hash = hash_token(raw_refresh_token)

        existing_tokens = _prune_refresh_tokens(list(user.refresh_tokens_json or []), now)
        existing_tokens.append({
            "token_hash": refresh_hash,
            "expires_at": (now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)).isoformat(),
            "created_at": now.isoformat(),
        })
        user.refresh_tokens_json = existing_tokens
        db.commit()
        db.refresh(user)

        log_audit_event(
            db=db,
            action="LOGIN",
            user=user,
            entity_name="User",
            entity_id=str(user.id),
            details="User logged in successfully",
            request=request,
        )

        return user, access_token, raw_refresh_token

    @staticmethod
    def refresh_access_token(db: Session, raw_refresh_token: str) -> tuple[User, str, str]:
        """Validate refresh token stored in user.refresh_tokens_json and rotate token pair."""
        now = datetime.now(UTC)
        refresh_hash = hash_token(raw_refresh_token)

        active_users = db.query(User).filter(User.is_active == True, User.revoked_at.is_(None)).all()
        matched_user: User | None = None
        matched_tokens: list[dict] = []

        for candidate in active_users:
            valid_tokens = _prune_refresh_tokens(list(candidate.refresh_tokens_json or []), now)
            remaining = [t for t in valid_tokens if t.get("token_hash") != refresh_hash]
            if len(remaining) < len(valid_tokens):
                matched_user = candidate
                matched_tokens = remaining
                break

        if not matched_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_REFRESH_TOKEN", "message": "Refresh token is invalid or expired."},
            )

        _ensure_active_user_and_student(db, matched_user)

        new_access_token = create_access_token(
            data={
                "sub": str(matched_user.id),
                "role": matched_user.role,
                "email": matched_user.email,
                "name": matched_user.full_name,
                "tv": matched_user.token_version,
                "is_admin": matched_user.is_admin,
            }
        )
        new_raw_refresh = generate_refresh_token()
        matched_tokens.append({
            "token_hash": hash_token(new_raw_refresh),
            "expires_at": (now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)).isoformat(),
            "created_at": now.isoformat(),
        })
        matched_user.refresh_tokens_json = matched_tokens
        db.commit()
        db.refresh(matched_user)

        return matched_user, new_access_token, new_raw_refresh

    @staticmethod
    def revoke_refresh_token(
        db: Session,
        raw_refresh_token: str,
        user: User | None = None,
        request: Request | None = None,
    ) -> None:
        """Revoke a refresh token on logout."""
        refresh_hash = hash_token(raw_refresh_token)
        if user:
            current_tokens = list(user.refresh_tokens_json or [])
            user.refresh_tokens_json = [t for t in current_tokens if t.get("token_hash") != refresh_hash]
            db.commit()
            log_audit_event(
                db=db,
                action="LOGOUT",
                user=user,
                entity_name="User",
                entity_id=str(user.id),
                details="User logged out successfully",
                request=request,
            )
        else:
            for candidate in db.query(User).all():
                current_tokens = list(candidate.refresh_tokens_json or [])
                filtered = [t for t in current_tokens if t.get("token_hash") != refresh_hash]
                if len(filtered) < len(current_tokens):
                    candidate.refresh_tokens_json = filtered
                    db.commit()
                    break
