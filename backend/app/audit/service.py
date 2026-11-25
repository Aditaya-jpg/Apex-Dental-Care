import json
import logging
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.care_log import CareAndSystemLog
from app.models.user import User

logger = logging.getLogger("audit")

SENSITIVE_KEYS = {
    "password", "password_hash", "hashed_password", "token",
    "access_token", "refresh_token", "jwt", "secret", "google_oauth_tokens",
}


def sanitize_audit_data(data: Any) -> Any:
    """Recursively scrub sensitive keys from dictionaries before logging."""
    if isinstance(data, dict):
        cleaned = {}
        for k, v in data.items():
            if any(sens in k.lower() for sens in SENSITIVE_KEYS):
                cleaned[k] = "[REDACTED]"
            else:
                cleaned[k] = sanitize_audit_data(v)
        return cleaned
    if isinstance(data, list):
        return [sanitize_audit_data(item) for item in data]
    return data


def log_audit_event(
    db: Session,
    action: str,
    user: User | None = None,
    user_id: int | None = None,
    user_email: str | None = None,
    entity_name: str | None = None,
    entity_id: str | None = None,
    details: dict[str, Any] | str | None = None,
    request: Request | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    patient_id: int | None = None,
) -> CareAndSystemLog:
    """Create an immutable centralized audit log entry in care_and_system_logs."""
    actual_user_id = user_id or (user.id if user else None)
    actual_user_email = user_email or (user.email if user else None)

    if request:
        ip_address = ip_address or (request.client.host if request.client else "unknown")
        user_agent = user_agent or request.headers.get("user-agent", "unknown")

    detail_str = None
    if details is not None:
        if isinstance(details, (dict, list)):
            safe_details = sanitize_audit_data(details)
            detail_str = json.dumps(safe_details)
        else:
            detail_str = str(details)

    if patient_id is None and entity_name == "Patient" and entity_id and str(entity_id).isdigit():
        patient_id = int(entity_id)

    audit_entry = CareAndSystemLog(
        event_type="audit",
        patient_id=patient_id,
        actor_user_id=actual_user_id,
        status="logged",
        channel="system",
        language="en",
        title=action,
        payload_json={
            "action": action,
            "user_email": actual_user_email,
            "entity_name": entity_name,
            "entity_id": str(entity_id) if entity_id is not None else None,
            "details": detail_str,
            "ip_address": ip_address,
            "user_agent": user_agent,
        },
    )

    db.add(audit_entry)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to record audit log: {e!s}")

    return audit_entry
