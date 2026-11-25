from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.care_log import CareAndSystemLog
from app.models.user import User
from app.schemas.audit import AuditLogResponse
from app.schemas.common import PaginatedResponse
from app.security.dependencies import require_roles

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


def _to_audit_response(log: CareAndSystemLog) -> AuditLogResponse:
    p = log.payload_json or {}
    return AuditLogResponse(
        id=log.id,
        user_id=log.actor_user_id,
        user_email=p.get("user_email"),
        action=p.get("action") or log.title or "EVENT",
        entity_name=p.get("entity_name"),
        entity_id=p.get("entity_id"),
        details=p.get("details"),
        ip_address=p.get("ip_address"),
        user_agent=p.get("user_agent"),
        created_at=log.created_at,
    )


@router.get("", response_model=PaginatedResponse[AuditLogResponse])
def get_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    action: str | None = None,
    entity_name: str | None = None,
    user_email: str | None = None,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Admin-only: Retrieve centralized audit trail from care_and_system_logs."""
    query = db.query(CareAndSystemLog).filter(CareAndSystemLog.event_type == "audit")
    all_logs = query.order_by(desc(CareAndSystemLog.created_at), desc(CareAndSystemLog.id)).all()

    filtered: list[CareAndSystemLog] = []
    for log in all_logs:
        p = log.payload_json or {}
        act = p.get("action") or log.title or ""
        ent = p.get("entity_name") or ""
        email = p.get("user_email") or ""
        if action and act != action:
            continue
        if entity_name and ent != entity_name:
            continue
        if user_email and user_email.lower() not in email.lower():
            continue
        filtered.append(log)

    total = len(filtered)
    start = (page - 1) * page_size
    page_items = filtered[start : start + page_size]
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        items=[_to_audit_response(item) for item in page_items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
