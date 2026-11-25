from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.constants import PROCEDURE_CATALOG
from app.database import get_db
from app.models.user import User
from app.schemas.treatment import (
    ProcedureCatalogResponse,
    TreatmentItemCreate,
    TreatmentItemResponse,
    TreatmentItemUpdate,
    TreatmentPlanCreate,
    TreatmentPlanResponse,
)
from app.security.dependencies import require_roles
from app.services.treatment_service import TreatmentService, to_treatment_plan_response

router = APIRouter(prefix="/treatments", tags=["Treatment Management"])


@router.get("/catalog", response_model=list[ProcedureCatalogResponse])
def get_procedure_catalog(
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
):
    """Retrieve catalog of standard dental procedures (no costs/fees)."""
    return [ProcedureCatalogResponse(**p) for p in PROCEDURE_CATALOG]


@router.get("/plans", response_model=list[TreatmentPlanResponse])
def list_treatment_plans(
    patient_id: int | None = None,
    doctor_id: int | None = None,
    dentist_id: int | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """List clinical treatment plans scoped by RBAC."""
    plans = TreatmentService.get_plans(
        db,
        current_user=current_user,
        patient_id=patient_id,
        doctor_id=doctor_id or dentist_id,
        status_filter=status_filter,
    )
    return [to_treatment_plan_response(p) for p in plans]


@router.post("/plans", response_model=TreatmentPlanResponse, status_code=status.HTTP_201_CREATED)
def create_treatment_plan(
    request: Request,
    payload: TreatmentPlanCreate,
    current_user: User = Depends(require_roles("doctor", "admin", "student")),
    db: Session = Depends(get_db),
):
    """Create a multi-procedure treatment plan."""
    plan = TreatmentService.create_treatment_plan(db, data=payload, current_user=current_user, request=request)
    return to_treatment_plan_response(plan)


@router.get("/plans/{plan_id}", response_model=TreatmentPlanResponse)
def get_treatment_plan(
    plan_id: int,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Retrieve full treatment plan details and item progress."""
    plan = TreatmentService.get_plan_by_id(db, plan_id, current_user=current_user)
    return to_treatment_plan_response(plan)


@router.post("/plans/{plan_id}/items", response_model=TreatmentItemResponse)
def add_treatment_item(
    request: Request,
    plan_id: int,
    payload: TreatmentItemCreate,
    current_user: User = Depends(require_roles("doctor", "admin", "student")),
    db: Session = Depends(get_db),
):
    """Add a new procedure item to an existing plan."""
    return TreatmentService.add_treatment_item(db, plan_id=plan_id, data=payload, current_user=current_user, request=request)


@router.put("/items/{item_id}", response_model=TreatmentItemResponse)
def update_treatment_item(
    request: Request,
    item_id: int,
    payload: TreatmentItemUpdate,
    current_user: User = Depends(require_roles("doctor", "admin", "student")),
    db: Session = Depends(get_db),
):
    """Update procedure status (planned, in_progress, completed) or notes."""
    return TreatmentService.update_treatment_item(db, item_id=item_id, data=payload, current_user=current_user, request=request)
