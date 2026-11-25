from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.clinical import VisitCreate, VisitResponse, VisitUpdate
from app.security.dependencies import require_roles
from app.services.clinical_service import ClinicalService, to_visit_response

router = APIRouter(prefix="/visits", tags=["Clinical Examinations & Visits"])


@router.post("", response_model=VisitResponse, status_code=status.HTTP_201_CREATED)
def create_visit(
    request: Request,
    payload: VisitCreate,
    current_user: User = Depends(require_roles("doctor", "admin", "student")),
    db: Session = Depends(get_db),
):
    """Record a clinical examination and patient visit."""
    visit = ClinicalService.create_visit(db, data=payload, current_user=current_user, request=request)
    return to_visit_response(visit)


@router.get("/{visit_id}", response_model=VisitResponse)
def get_visit(
    visit_id: int,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Retrieve visit details and examination findings."""
    visit = ClinicalService.get_visit_by_id(db, visit_id, current_user=current_user)
    return to_visit_response(visit)


@router.get("/patient/{patient_id}", response_model=list[VisitResponse])
def get_patient_visits(
    patient_id: int,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Retrieve all historical visits for a patient."""
    visits = ClinicalService.get_patient_visits(db, patient_id, current_user=current_user)
    return [to_visit_response(v) for v in visits]


@router.put("/{visit_id}", response_model=VisitResponse)
def update_visit(
    request: Request,
    visit_id: int,
    payload: VisitUpdate,
    current_user: User = Depends(require_roles("doctor", "admin", "student")),
    db: Session = Depends(get_db),
):
    """Update examination notes or vitals."""
    visit = ClinicalService.update_visit(db, visit_id=visit_id, data=payload, current_user=current_user, request=request)
    return to_visit_response(visit)
