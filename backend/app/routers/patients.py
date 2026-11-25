from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.database import get_db
from app.models.document import Document
from app.models.patient import Patient
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.patient import (
    PatientCreate,
    PatientDetailResponse,
    PatientListItem,
    PatientUpdate,
)
from app.security.dependencies import get_current_user, require_roles
from app.services.document_service import DocumentService
from app.services.patient_service import PatientService
from app.storage.file_storage import file_storage

router = APIRouter(prefix="/patients", tags=["Patient Management"])


class DateWiseXrayItem(BaseModel):
    id: int
    patient_id: int
    upload_date: str
    created_at: datetime
    xray_type: str
    description: str | None = None
    disease_category: str | None = None
    file_name: str
    original_file_name: str
    file_size: int
    mime_type: str
    uploaded_by: str | None = None
    view_url: str
    download_url: str


class CardVerificationUpdate(BaseModel):
    status: str

@router.get("/my-profile", response_model=PatientDetailResponse)
def get_my_patient_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve full clinical patient profile for the currently logged-in patient user."""
    if not current_user.patient_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No patient record associated with this account.")
    patient = PatientService.get_patient_by_id(db, current_user.patient_id)
    return PatientDetailResponse.model_validate(patient)

@router.get("", response_model=PaginatedResponse[PatientListItem])
def list_patients(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    doctor_id: int | None = None,
    student_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve paginated list of patients with search filtering and role-based scoping."""
    items, total = PatientService.get_patients_paginated(
        db,
        page=page,
        page_size=page_size,
        search=search,
        current_user=current_user,
        doctor_id=doctor_id,
        student_id=student_id
    )
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        items=[PatientListItem.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.post("", response_model=PatientDetailResponse, status_code=status.HTTP_201_CREATED)
def create_patient(
    request: Request,
    payload: PatientCreate,
    current_user: User = Depends(require_roles("admin", "receptionist", "dentist", "doctor", "student")),
    db: Session = Depends(get_db)
):
    """Register a new patient with automatic Doctor/Student hierarchy and CR Number."""
    patient = PatientService.create_patient(db, data=payload, current_user=current_user, request=request)
    return PatientDetailResponse.model_validate(patient)

@router.get("/{patient_id}", response_model=PatientDetailResponse)
def get_patient(
    request: Request,
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve full patient demographic, medical, and dental history with access control."""
    patient = PatientService.get_patient_by_id(db, patient_id, current_user=current_user)

    # Log patient view for compliance
    log_audit_event(
        db=db,
        action="PATIENT_VIEW",
        user=current_user,
        entity_name="Patient",
        entity_id=str(patient.id),
        details={"patient_code": patient.patient_code},
        request=request
    )

    return PatientDetailResponse.model_validate(patient)

@router.put("/{patient_id}", response_model=PatientDetailResponse)
def update_patient(
    request: Request,
    patient_id: int,
    payload: PatientUpdate,
    current_user: User = Depends(require_roles("admin", "receptionist", "dentist", "doctor", "student")),
    db: Session = Depends(get_db)
):
    """Update patient demographic, student assignment, disease categories, or clinical history."""
    patient = PatientService.update_patient(db, patient_id=patient_id, data=payload, current_user=current_user, request=request)
    return PatientDetailResponse.model_validate(patient)

@router.delete("/{patient_id}", response_model=MessageResponse)
def delete_patient(
    request: Request,
    patient_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db)
):
    """Soft delete patient record."""
    PatientService.soft_delete_patient(db, patient_id=patient_id, current_user=current_user, request=request)
    return MessageResponse(message=f"Patient {patient_id} successfully archived.")

@router.get("/{patient_id}/timeline", response_model=list[dict[str, Any]])
def get_patient_timeline(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve complete chronological clinical history and event timeline."""
    return PatientService.get_patient_timeline(db, patient_id)


@router.get("/{patient_id}/xrays-datewise", response_model=list[DateWiseXrayItem])
def get_datewise_xrays(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve all diagnostic X-rays organized date-wise with hyperlink metadata.
    Enforces that doctors only access their patients, students access assigned patients.
    """
    patient = PatientService.get_patient_by_id(db, patient_id, current_user=current_user)

    xray_docs = db.query(Document).filter(
        Document.patient_id == patient.id,
        Document.document_type.in_(["xray", "opg", "cbct", "pa", "bitewing", "panoramic"])
    ).order_by(Document.created_at.desc()).all()

    items = []
    for doc in xray_docs:
        upload_date_str = doc.created_at.strftime("%d %B %Y")
        uploaded_by_name = doc.uploaded_by.full_name if doc.uploaded_by else "Clinical Staff"
        items.append(DateWiseXrayItem(
            id=doc.id,
            patient_id=patient.id,
            upload_date=upload_date_str,
            created_at=doc.created_at,
            xray_type=doc.document_type.upper(),
            description=doc.notes,
            disease_category=doc.notes if doc.notes else "Routine Diagnostic",
            file_name=doc.file_name,
            original_file_name=doc.original_file_name,
            file_size=doc.file_size,
            mime_type=doc.mime_type,
            uploaded_by=uploaded_by_name,
            view_url=f"/api/v1/documents/{doc.id}/download",
            download_url=f"/api/v1/documents/{doc.id}/download"
        ))

    return items


@router.post("/{patient_id}/xrays", response_model=DateWiseXrayItem, status_code=status.HTTP_201_CREATED)
async def upload_datewise_xray(
    request: Request,
    patient_id: int,
    file: UploadFile = File(...),
    xray_type: str = Form("OPG Panoramic"),
    description: str | None = Form(None),
    disease_category: str | None = Form(None),
    upload_date: str | None = Form(None),
    current_user: User = Depends(require_roles("admin", "dentist", "doctor", "student")),
    db: Session = Depends(get_db)
):
    """
    Upload an X-ray for a patient with specific metadata, categorized date-wise.
    Accessible to authorized Doctors and Students.
    """
    patient = PatientService.get_patient_by_id(db, patient_id, current_user=current_user)

    notes_combined = description or ""
    if disease_category:
        notes_combined = f"{disease_category} - {notes_combined}".strip(" -")

    doc = await DocumentService.upload_document(
        db=db,
        patient_id=patient.id,
        document_type="xray",
        file=file,
        current_user=current_user,
        notes=notes_combined or xray_type,
        request=request
    )

    if upload_date:
        try:
            parsed_dt = datetime.fromisoformat(upload_date)
            doc.created_at = parsed_dt
            db.commit()
            db.refresh(doc)
        except Exception:
            pass

    upload_date_str = doc.created_at.strftime("%d %B %Y")
    return DateWiseXrayItem(
        id=doc.id,
        patient_id=patient.id,
        upload_date=upload_date_str,
        created_at=doc.created_at,
        xray_type=xray_type,
        description=description,
        disease_category=disease_category or "Clinical Review",
        file_name=doc.file_name,
        original_file_name=doc.original_file_name,
        file_size=doc.file_size,
        mime_type=doc.mime_type,
        uploaded_by=current_user.full_name,
        view_url=f"/api/v1/documents/{doc.id}/download",
        download_url=f"/api/v1/documents/{doc.id}/download"
    )


@router.post("/{patient_id}/card", response_model=PatientDetailResponse)
async def upload_patient_card(
    request: Request,
    patient_id: int,
    file: UploadFile = File(...),
    cr_number: str | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload patient registration/identity card (PDF, JPG, JPEG, PNG).
    Updates patient card document reference and CR Number if provided.
    """
    patient = PatientService.get_patient_by_id(db, patient_id, current_user=current_user)

    allowed_exts = [".pdf", ".jpg", ".jpeg", ".png"]
    ext = file.filename[file.filename.rfind("."):].lower() if "." in file.filename else ""
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_FILE_TYPE", "message": f"File type {ext} not allowed. Allowed: PDF, JPG, JPEG, PNG"}
        )

    # Save file via file_storage
    stored_name, orig_name, size_bytes, mime = await file_storage.save_file(file)

    # Record in documents table
    doc = Document(
        patient_id=patient.id,
        document_type="patient_card",
        file_name=stored_name,
        original_file_name=orig_name,
        file_size=size_bytes,
        mime_type=mime,
        file_path=str(file_storage.get_file_path(stored_name)),
        notes="Patient Identity Card / Registration Document",
        uploaded_by_user_id=current_user.id
    )
    db.add(doc)

    patient.patient_card_document = f"/api/v1/patients/{patient.id}/card"
    patient.card_verification_status = "verified" if current_user.role in ["admin", "dentist", "doctor"] else "pending"

    if cr_number:
        # Check duplicate CR Number
        existing = db.query(Patient).filter(Patient.cr_number == cr_number, Patient.id != patient.id, Patient.is_deleted == False).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "DUPLICATE_CR_NUMBER", "message": f"CR Number {cr_number} is already registered to another patient."}
            )
        patient.cr_number = cr_number

    db.commit()
    db.refresh(patient)

    log_audit_event(
        db=db,
        action="PATIENT_CARD_UPLOAD",
        user=current_user,
        entity_name="Patient",
        entity_id=str(patient.id),
        details={"cr_number": patient.cr_number, "card_file": orig_name},
        request=request
    )

    return PatientDetailResponse.model_validate(patient)


@router.get("/{patient_id}/card")
def download_patient_card(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download/preview the securely stored patient card."""
    patient = PatientService.get_patient_by_id(db, patient_id, current_user=current_user)

    card_doc = db.query(Document).filter(
        Document.patient_id == patient.id,
        Document.document_type == "patient_card"
    ).order_by(Document.created_at.desc()).first()

    if not card_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CARD_NOT_FOUND", "message": "No registration card has been uploaded for this patient."}
        )

    file_path = file_storage.get_file_path(card_doc.file_name)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "FILE_NOT_FOUND", "message": "Card file is missing from storage."}
        )

    return FileResponse(
        path=str(file_path),
        media_type=card_doc.mime_type,
        filename=card_doc.original_file_name,
        headers={"Content-Disposition": f'inline; filename="{card_doc.original_file_name}"'}
    )


@router.put("/{patient_id}/card-status", response_model=PatientDetailResponse)
def update_card_verification_status(
    patient_id: int,
    payload: CardVerificationUpdate,
    request: Request,
    current_user: User = Depends(require_roles("admin", "dentist", "doctor")),
    db: Session = Depends(get_db)
):
    """Doctor or Admin: update patient card verification status."""
    patient = PatientService.get_patient_by_id(db, patient_id, current_user=current_user)
    patient.card_verification_status = payload.status
    db.commit()
    db.refresh(patient)

    log_audit_event(
        db=db,
        action="CARD_STATUS_UPDATE",
        user=current_user,
        entity_name="Patient",
        entity_id=str(patient.id),
        details={"verification_status": payload.status},
        request=request
    )

    return PatientDetailResponse.model_validate(patient)
