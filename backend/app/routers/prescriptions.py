from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.constants import MEDICINE_CATALOG
from app.database import get_db
from app.models.user import User
from app.schemas.prescription import (
    MedicineCatalogResponse,
    PrescriptionCreate,
    PrescriptionResponse,
)
from app.security.dependencies import require_roles
from app.services.prescription_service import PrescriptionService, to_prescription_response

router = APIRouter(prefix="/prescriptions", tags=["Prescription Management"])


@router.get("/catalog", response_model=list[MedicineCatalogResponse])
def get_medicine_catalog(
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
):
    """Retrieve catalog of standard PGI medications and default dosages."""
    return [MedicineCatalogResponse(**m) for m in MEDICINE_CATALOG]


@router.get("/templates")
def get_rx_templates(
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Retrieve reusable Auto-Prescription templates."""
    return PrescriptionService.get_templates(db)


@router.get("", response_model=list[PrescriptionResponse])
def list_prescriptions(
    patient_id: int | None = None,
    doctor_id: int | None = None,
    dentist_id: int | None = None,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """List prescriptions with optional patient or doctor filters."""
    rx_list = PrescriptionService.get_prescriptions(
        db,
        current_user=current_user,
        patient_id=patient_id,
        doctor_id=doctor_id or dentist_id,
    )
    return [to_prescription_response(rx) for rx in rx_list]


@router.post("", response_model=PrescriptionResponse, status_code=status.HTTP_201_CREATED)
def create_prescription(
    request: Request,
    payload: PrescriptionCreate,
    current_user: User = Depends(require_roles("doctor", "admin")),
    db: Session = Depends(get_db),
):
    """Doctor/Admin: Generate a digital prescription with medication schedule."""
    rx = PrescriptionService.create_prescription(db, data=payload, current_user=current_user, request=request)
    return to_prescription_response(rx)


@router.get("/{prescription_id}", response_model=PrescriptionResponse)
def get_prescription(
    prescription_id: int,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Retrieve prescription details."""
    rx = PrescriptionService.get_prescription_by_id(db, prescription_id, current_user=current_user)
    return to_prescription_response(rx)


@router.get("/{prescription_id}/pdf")
def download_prescription_pdf(
    prescription_id: int,
    current_user: User = Depends(require_roles("admin", "doctor", "student", "patient")),
    db: Session = Depends(get_db),
):
    """Generate and stream PGI-branded prescription PDF (patients can only download visible prescriptions)."""
    pdf_bytes = PrescriptionService.get_pdf(db, prescription_id, current_user=current_user)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="prescription_{prescription_id}.pdf"'},
    )
