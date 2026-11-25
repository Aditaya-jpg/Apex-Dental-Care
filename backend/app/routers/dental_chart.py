from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.dental_chart import (
    DentalChartDetailResponse,
    PerioChartResponse,
    PerioChartUpdate,
    ToothConditionResponse,
    ToothConditionUpdate,
    ToothHistoryResponse,
)
from app.security.dependencies import require_roles
from app.services.dental_service import DentalChartService

router = APIRouter(prefix="/dental-chart", tags=["FDI Restorative & Perio Chart"])


@router.get("/{patient_id}", response_model=DentalChartDetailResponse)
def get_patient_dental_chart(
    patient_id: int,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Retrieve full 32 permanent teeth restorative chart and condition history."""
    return DentalChartService.get_full_chart_details(db, patient_id, current_user=current_user)


@router.post("/{patient_id}/tooth", response_model=ToothConditionResponse)
def update_tooth_condition(
    request: Request,
    patient_id: int,
    payload: ToothConditionUpdate,
    current_user: User = Depends(require_roles("doctor", "admin", "student")),
    db: Session = Depends(get_db),
):
    """Update condition of an FDI permanent tooth (11-48) and log immutable history snapshot."""
    return DentalChartService.update_tooth_condition(
        db=db,
        patient_id=patient_id,
        data=payload,
        current_user=current_user,
        request=request,
    )


@router.get("/{patient_id}/tooth/{tooth_number}/history", response_model=list[ToothHistoryResponse])
def get_tooth_history(
    patient_id: int,
    tooth_number: int,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Retrieve complete clinical history for a single tooth."""
    return DentalChartService.get_tooth_history(db, patient_id=patient_id, tooth_number=tooth_number, current_user=current_user)


@router.get("/{patient_id}/perio", response_model=PerioChartResponse)
def get_perio_chart(
    patient_id: int,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Retrieve 6-site periodontal chart and summary metrics."""
    return DentalChartService.get_perio_chart(db, patient_id=patient_id, current_user=current_user)


@router.put("/{patient_id}/perio", response_model=PerioChartResponse)
def update_perio_chart(
    request: Request,
    patient_id: int,
    payload: PerioChartUpdate,
    current_user: User = Depends(require_roles("doctor", "admin", "student")),
    db: Session = Depends(get_db),
):
    """Save 6-site periodontal probing depths, BOP, recession, mobility, and furcation."""
    return DentalChartService.update_perio_chart(
        db=db,
        patient_id=patient_id,
        data=payload,
        current_user=current_user,
        request=request,
    )
