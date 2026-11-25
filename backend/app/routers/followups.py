from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.followup import FollowUpCreate, FollowUpResponse, FollowUpUpdate
from app.security.dependencies import require_roles
from app.services.followup_service import FollowUpService, to_followup_response

router = APIRouter(prefix="/followups", tags=["Follow-Up Management"])


@router.get("", response_model=list[FollowUpResponse])
def list_followups(
    patient_id: int | None = None,
    doctor_id: int | None = None,
    dentist_id: int | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Retrieve scheduled clinical follow-ups scoped by RBAC."""
    fus = FollowUpService.get_followups(
        db,
        current_user=current_user,
        patient_id=patient_id,
        doctor_id=doctor_id or dentist_id,
        status_filter=status_filter,
    )
    return [to_followup_response(f) for f in fus]


@router.post("", response_model=FollowUpResponse, status_code=status.HTTP_201_CREATED)
def create_followup(
    request: Request,
    payload: FollowUpCreate,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Schedule a follow-up review date."""
    fu = FollowUpService.create_followup(db, data=payload, current_user=current_user, request=request)
    return to_followup_response(fu)


@router.put("/{followup_id}", response_model=FollowUpResponse)
def update_followup(
    request: Request,
    followup_id: int,
    payload: FollowUpUpdate,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Update follow-up status (pending, completed, cancelled) or notes."""
    fu = FollowUpService.update_followup(db, followup_id=followup_id, data=payload, current_user=current_user, request=request)
    return to_followup_response(fu)
