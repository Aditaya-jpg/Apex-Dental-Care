from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.database import get_db
from app.models.document import Document
from app.models.patient import Patient
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.patient import (
    MiscRecordsUpdate,
    PatientCreate,
    PatientDetailResponse,
    PatientListItem,
    PatientSeverityUpdate,
    PatientUpdate,
    SharedNoticeCreate,
    SharedNoticeResponse,
    SurgicalLogCreate,
    SurgicalLogResponse,
    SurgicalLogUpdate,
)
from app.security.dependencies import get_current_user, require_roles, verify_patient_access
from app.services.document_service import DocumentService
from app.services.patient_service import PatientService, to_patient_detail
from app.storage.file_storage import file_storage

router = APIRouter(prefix="/patients", tags=["Patient Management"])


class DateWiseXrayItem(BaseModel):
    id: int
    patient_id: int
    upload_date: str
    media_date: date
    created_at: datetime
    xray_type: str
    document_type: str
    title: str | None = None
    description: str | None = None
    disease_category: str | None = None
    treatment_stage: str = "initial_assessment"
    is_shared_with_patient: bool = False
    file_name: str
    original_file_name: str
    file_size: int
    mime_type: str
    uploaded_by: str | None = None
    view_url: str
    download_url: str


class CardVerificationUpdate(BaseModel):
    status: str


@router.get("/my-profile")
def get_my_patient_profile(
    current_user: User = Depends(require_roles("patient", "admin")),
    db: Session = Depends(get_db),
):
    """Retrieve sanitized demographic profile for the currently logged-in patient (no internal clinical notes)."""
    if not current_user.patient_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PATIENT_NOT_FOUND", "message": "No patient record associated with this account."},
        )
    patient = PatientService.get_patient_by_id(db, current_user.patient_id)
    return {
        "id": patient.id,
        "patient_code": patient.patient_code,
        "cr_number": patient.cr_number,
        "full_name": patient.full_name,
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "date_of_birth": patient.date_of_birth,
        "age": patient.age,
        "gender": patient.gender,
        "phone": patient.phone,
        "email": patient.email,
        "address": patient.address,
        "blood_group": patient.blood_group,
        "preferred_language": patient.preferred_language,
        "card_verification_status": patient.card_verification_status,
        "patient_card_document": patient.patient_card_document,
    }


@router.get("", response_model=PaginatedResponse[PatientListItem])
def list_patients(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    doctor_id: int | None = None,
    student_id: int | None = None,
    scope: str = Query("all", pattern="^(all|mine)$"),
    categories: str | None = None,
    keyword: str | None = None,
    age_group: str | None = Query(default=None, pattern="^(pediatric|adult|geriatric)$"),
    special_case: bool | None = None,
    severity: str | None = Query(default=None, pattern="^(none|mild|moderate|severe|critical)$"),
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Retrieve paginated patients. Doctors see ALL branch patients; Students see ONLY assigned patients."""
    items, total = PatientService.get_patients_paginated(
        db,
        page=page,
        page_size=page_size,
        search=search,
        current_user=current_user,
        doctor_id=doctor_id,
        student_id=student_id,
        scope=scope,
        categories=categories,
        keyword=keyword,
        age_group=age_group,
        special_case=special_case,
        severity=severity,
    )
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        items=[PatientListItem.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("", response_model=PatientDetailResponse, status_code=status.HTTP_201_CREATED)
def create_patient(
    request: Request,
    payload: PatientCreate,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Register a new patient (Admin, Doctor, or Student; Receptionist blocked with 403)."""
    patient = PatientService.create_patient(db, data=payload, current_user=current_user, request=request)
    return to_patient_detail(patient)


@router.get("/{patient_id}", response_model=PatientDetailResponse)
def get_patient(
    request: Request,
    patient_id: int,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Retrieve full patient demographic, medical, and dental history with strict RBAC isolation."""
    patient = verify_patient_access(db, current_user, patient_id)

    log_audit_event(
        db=db,
        action="PATIENT_VIEW",
        user=current_user,
        entity_name="Patient",
        entity_id=str(patient.id),
        patient_id=patient.id,
        details={"patient_code": patient.patient_code},
        request=request,
    )

    return to_patient_detail(patient)


@router.put("/{patient_id}", response_model=PatientDetailResponse)
def update_patient(
    request: Request,
    patient_id: int,
    payload: PatientUpdate,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Update patient demographic, student assignment, disease categories, or clinical history."""
    patient = PatientService.update_patient(db, patient_id=patient_id, data=payload, current_user=current_user, request=request)
    return to_patient_detail(patient)


@router.patch("/{patient_id}/severity", response_model=PatientDetailResponse)
def update_patient_severity(
    request: Request,
    patient_id: int,
    payload: PatientSeverityUpdate,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Update patient pain scale (0-10) and triage severity level."""
    patient = PatientService.update_severity(
        db=db,
        patient_id=patient_id,
        pain_scale=payload.pain_scale,
        severity_level=payload.severity_level,
        current_user=current_user,
        request=request,
    )
    return to_patient_detail(patient)


@router.delete("/{patient_id}", response_model=MessageResponse)
def delete_patient(
    request: Request,
    patient_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Soft delete patient record."""
    PatientService.soft_delete_patient(db, patient_id=patient_id, current_user=current_user, request=request)
    return MessageResponse(message=f"Patient {patient_id} successfully archived.")


@router.get("/{patient_id}/timeline", response_model=list[dict[str, Any]])
def get_patient_timeline(
    patient_id: int,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Retrieve complete chronological clinical history and event timeline (zero billing)."""
    return PatientService.get_patient_timeline(db, patient_id, current_user=current_user)


@router.get("/{patient_id}/xrays-datewise", response_model=list[DateWiseXrayItem])
def get_datewise_xrays(
    patient_id: int,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Retrieve diagnostic X-rays/OPG/CBCT organized date-wise with disease category metadata."""
    patient = verify_patient_access(db, current_user, patient_id)

    xray_docs = (
        db.query(Document)
        .filter(
            Document.patient_id == patient.id,
            Document.document_type.in_(["xray", "opg", "cbct", "pa", "bitewing", "panoramic"]),
        )
        .order_by(Document.media_date.desc(), Document.created_at.desc())
        .all()
    )

    items = []
    for doc in xray_docs:
        media_dt = doc.media_date or doc.created_at.date()
        uploaded_by_name = doc.uploaded_by.full_name if doc.uploaded_by else "Clinical Staff"
        items.append(
            DateWiseXrayItem(
                id=doc.id,
                patient_id=patient.id,
                upload_date=media_dt.strftime("%d %B %Y"),
                media_date=media_dt,
                created_at=doc.created_at,
                xray_type=doc.document_type.upper(),
                document_type=doc.document_type,
                title=doc.title,
                description=doc.description,
                disease_category=doc.disease_category or "Routine Diagnostic",
                treatment_stage=doc.treatment_stage,
                is_shared_with_patient=doc.is_shared_with_patient,
                file_name=doc.file_name,
                original_file_name=doc.original_filename,
                file_size=doc.file_size_bytes,
                mime_type=doc.mime_type,
                uploaded_by=uploaded_by_name,
                view_url=f"/api/v1/documents/{doc.id}/download",
                download_url=f"/api/v1/documents/{doc.id}/download",
            )
        )

    return items


@router.post("/{patient_id}/xrays", response_model=DateWiseXrayItem, status_code=status.HTTP_201_CREATED)
async def upload_datewise_xray(
    request: Request,
    patient_id: int,
    file: UploadFile = File(...),
    xray_type: str = Form("xray"),
    title: str | None = Form(None),
    description: str | None = Form(None),
    disease_category: str | None = Form(None),
    treatment_stage: str = Form("initial_assessment"),
    upload_date: str | None = Form(None),
    is_shared_with_patient: bool = Form(False),
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Upload an encrypted X-ray/OPG/CBCT scan categorized by disease and media_date."""
    patient = verify_patient_access(db, current_user, patient_id, require_write=True)

    doc_type = xray_type.lower() if xray_type.lower() in ("xray", "opg", "cbct") else "xray"
    parsed_media_date: date | None = None
    if upload_date:
        try:
            parsed_media_date = datetime.fromisoformat(upload_date).date()
        except Exception:
            parsed_media_date = None

    doc = await DocumentService.upload_document(
        db=db,
        patient_id=patient.id,
        document_type=doc_type,
        file=file,
        current_user=current_user,
        title=title or xray_type,
        description=description,
        disease_category=disease_category,
        treatment_stage=treatment_stage,
        media_date=parsed_media_date,
        is_shared_with_patient=is_shared_with_patient if current_user.role != "student" else False,
        request=request,
    )

    media_dt = doc.media_date or doc.created_at.date()
    return DateWiseXrayItem(
        id=doc.id,
        patient_id=patient.id,
        upload_date=media_dt.strftime("%d %B %Y"),
        media_date=media_dt,
        created_at=doc.created_at,
        xray_type=xray_type,
        document_type=doc.document_type,
        title=doc.title,
        description=doc.description,
        disease_category=doc.disease_category or "Clinical Review",
        treatment_stage=doc.treatment_stage,
        is_shared_with_patient=doc.is_shared_with_patient,
        file_name=doc.file_name,
        original_file_name=doc.original_filename,
        file_size=doc.file_size_bytes,
        mime_type=doc.mime_type,
        uploaded_by=current_user.full_name,
        view_url=f"/api/v1/documents/{doc.id}/download",
        download_url=f"/api/v1/documents/{doc.id}/download",
    )


@router.post("/{patient_id}/card", response_model=PatientDetailResponse)
async def upload_patient_card(
    request: Request,
    patient_id: int,
    file: UploadFile = File(...),
    cr_number: str | None = Form(None),
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Upload encrypted patient registration/CR card (PDF, JPG, JPEG, PNG)."""
    patient = verify_patient_access(db, current_user, patient_id, require_write=True)

    stored = await file_storage.save_encrypted_upload(
        patient_id=patient.id,
        file=file,
        document_type="patient_card",
    )

    doc = Document(
        patient_id=patient.id,
        uploaded_by_user_id=current_user.id,
        document_type="patient_card",
        title="PGI Patient CR Card",
        description="Patient Identity Card / CR Registration Document",
        treatment_stage="initial_assessment",
        media_date=date.today(),
        is_shared_with_patient=True,
        storage_key=stored.storage_key,
        original_filename=stored.original_filename,
        mime_type=stored.mime_type,
        file_size_bytes=stored.file_size_bytes,
        is_encrypted=stored.is_encrypted,
        encryption_iv=stored.encryption_iv,
        sha256_checksum=stored.sha256_checksum,
    )
    db.add(doc)
    db.flush()

    patient.card_doc_id = doc.id
    patient.card_verification_status = "verified" if current_user.role in ("admin", "doctor", "dentist") else "pending"

    if cr_number:
        clean_cr = cr_number.strip()
        existing = db.query(Patient).filter(
            Patient.cr_number == clean_cr,
            Patient.id != patient.id,
            Patient.is_deleted == False,
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "DUPLICATE_CR_NUMBER", "message": f"CR Number {cr_number} is already registered to another patient."},
            )
        patient.cr_number = clean_cr

    db.commit()
    db.refresh(patient)

    log_audit_event(
        db=db,
        action="PATIENT_CARD_UPLOAD",
        user=current_user,
        entity_name="Patient",
        entity_id=str(patient.id),
        patient_id=patient.id,
        details={"cr_number": patient.cr_number, "card_file": stored.original_filename, "doc_id": doc.id},
        request=request,
    )

    return to_patient_detail(patient)


@router.get("/{patient_id}/card")
def download_patient_card(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download/preview the encrypted patient CR card after authorization check."""
    patient = verify_patient_access(db, current_user, patient_id, allow_patient_self=True)

    card_doc = None
    if patient.card_doc_id:
        card_doc = db.query(Document).filter(Document.id == patient.card_doc_id).first()
    if not card_doc:
        card_doc = (
            db.query(Document)
            .filter(Document.patient_id == patient.id, Document.document_type == "patient_card")
            .order_by(Document.created_at.desc())
            .first()
        )

    if not card_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CARD_NOT_FOUND", "message": "No registration card has been uploaded for this patient."},
        )

    return StreamingResponse(
        file_storage.iter_decrypted_chunks(card_doc.storage_key),
        media_type=card_doc.mime_type,
        headers={"Content-Disposition": f'inline; filename="{card_doc.original_filename}"'},
    )


@router.put("/{patient_id}/card-status", response_model=PatientDetailResponse)
def update_card_verification_status(
    patient_id: int,
    payload: CardVerificationUpdate,
    request: Request,
    current_user: User = Depends(require_roles("admin", "doctor")),
    db: Session = Depends(get_db),
):
    """Doctor or Admin: update patient card verification status."""
    patient = verify_patient_access(db, current_user, patient_id, require_write=True)
    patient.card_verification_status = payload.status
    db.commit()
    db.refresh(patient)

    log_audit_event(
        db=db,
        action="CARD_STATUS_UPDATE",
        user=current_user,
        entity_name="Patient",
        entity_id=str(patient.id),
        patient_id=patient.id,
        details={"verification_status": payload.status},
        request=request,
    )

    return to_patient_detail(patient)


@router.post("/{patient_id}/consent", response_model=PatientDetailResponse)
async def upload_parent_consent(
    request: Request,
    patient_id: int,
    file: UploadFile = File(...),
    parent_guardian_name: str | None = Form(None),
    parent_guardian_phone: str | None = Form(None),
    parent_consent_status: str | None = Form(None),
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Upload encrypted signed parent/guardian consent form (minors or special cases)."""
    patient = verify_patient_access(db, current_user, patient_id, require_write=True)

    stored = await file_storage.save_encrypted_upload(
        patient_id=patient.id,
        file=file,
        document_type="parent_consent",
    )

    doc = Document(
        patient_id=patient.id,
        uploaded_by_user_id=current_user.id,
        document_type="parent_consent",
        title="Parent / Guardian Consent Form",
        description="Signed Parent or Guardian Consent Document",
        treatment_stage="initial_assessment",
        media_date=date.today(),
        is_shared_with_patient=True,
        storage_key=stored.storage_key,
        original_filename=stored.original_filename,
        mime_type=stored.mime_type,
        file_size_bytes=stored.file_size_bytes,
        is_encrypted=stored.is_encrypted,
        encryption_iv=stored.encryption_iv,
        sha256_checksum=stored.sha256_checksum,
    )
    db.add(doc)
    db.flush()

    patient.parent_consent_required = True
    patient.parent_consent_doc_id = doc.id
    if parent_guardian_name is not None:
        patient.parent_guardian_name = parent_guardian_name.strip()
    if parent_guardian_phone is not None:
        patient.parent_guardian_phone = parent_guardian_phone.strip()
    patient.parent_consent_status = parent_consent_status or "signed"

    db.commit()
    db.refresh(patient)

    log_audit_event(
        db=db,
        action="PARENT_CONSENT_UPLOAD",
        user=current_user,
        entity_name="Patient",
        entity_id=str(patient.id),
        patient_id=patient.id,
        details={"doc_id": doc.id, "consent_status": patient.parent_consent_status},
        request=request,
    )
    return to_patient_detail(patient)


@router.get("/{patient_id}/consent")
def download_parent_consent(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download/preview encrypted parent/guardian consent document after authorization check."""
    patient = verify_patient_access(db, current_user, patient_id, allow_patient_self=True)

    consent_doc = None
    if patient.parent_consent_doc_id:
        consent_doc = db.query(Document).filter(Document.id == patient.parent_consent_doc_id).first()
    if not consent_doc:
        consent_doc = (
            db.query(Document)
            .filter(Document.patient_id == patient.id, Document.document_type == "parent_consent")
            .order_by(Document.created_at.desc())
            .first()
        )

    if not consent_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CONSENT_NOT_FOUND", "message": "No parent/guardian consent document uploaded."},
        )

    return StreamingResponse(
        file_storage.iter_decrypted_chunks(consent_doc.storage_key),
        media_type=consent_doc.mime_type,
        headers={"Content-Disposition": f'inline; filename="{consent_doc.original_filename}"'},
    )


# ── Date-Wise Surgical Treatment Logs ──

@router.get("/{patient_id}/surgical-logs", response_model=list[SurgicalLogResponse])
def list_surgical_logs(
    patient_id: int,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """List chronological surgical treatment logs (internal staff only, never exposed to patient)."""
    return PatientService.list_surgical_logs(db, patient_id=patient_id, current_user=current_user)


@router.post("/{patient_id}/surgical-logs", response_model=SurgicalLogResponse, status_code=status.HTTP_201_CREATED)
def create_surgical_log(
    request: Request,
    patient_id: int,
    payload: SurgicalLogCreate,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Log a surgical procedure and trigger localized post-treatment instruction alert."""
    return PatientService.create_surgical_log(
        db, patient_id=patient_id, data=payload, current_user=current_user, request=request
    )


@router.put("/{patient_id}/surgical-logs/{log_id}", response_model=SurgicalLogResponse)
def update_surgical_log(
    request: Request,
    patient_id: int,
    log_id: int,
    payload: SurgicalLogUpdate,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Update an existing surgical treatment log."""
    return PatientService.update_surgical_log(
        db, patient_id=patient_id, log_id=log_id, data=payload, current_user=current_user, request=request
    )


@router.delete("/{patient_id}/surgical-logs/{log_id}", response_model=MessageResponse)
def delete_surgical_log(
    request: Request,
    patient_id: int,
    log_id: int,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Delete a surgical treatment log."""
    PatientService.delete_surgical_log(
        db, patient_id=patient_id, log_id=log_id, current_user=current_user, request=request
    )
    return MessageResponse(message=f"Surgical log {log_id} deleted.")


# ── Category-Specific Miscellaneous Records ──

@router.get("/{patient_id}/miscellaneous")
def get_misc_records(
    patient_id: int,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Retrieve category-specific miscellaneous clinical notes."""
    return PatientService.get_misc_records(db, patient_id=patient_id, current_user=current_user)


@router.put("/{patient_id}/miscellaneous")
def update_misc_records(
    request: Request,
    patient_id: int,
    payload: MiscRecordsUpdate,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Update category-specific miscellaneous clinical notes."""
    return PatientService.update_misc_records(
        db, patient_id=patient_id, data=payload, current_user=current_user, request=request
    )


# ── Doctor-to-Patient Advisories / Shared Notices ──

@router.get("/{patient_id}/shared-notices", response_model=list[SharedNoticeResponse])
def get_shared_notices(
    patient_id: int,
    current_user: User = Depends(require_roles("admin", "doctor", "student", "patient")),
    db: Session = Depends(get_db),
):
    """List doctor-issued advisories for the patient (tests/scans to conduct & bring)."""
    return PatientService.get_shared_notices(db, patient_id=patient_id, current_user=current_user)


@router.post("/{patient_id}/shared-notices", response_model=SharedNoticeResponse, status_code=status.HTTP_201_CREATED)
def add_shared_notice(
    request: Request,
    patient_id: int,
    payload: SharedNoticeCreate,
    current_user: User = Depends(require_roles("admin", "doctor")),
    db: Session = Depends(get_db),
):
    """Doctor/Admin: Add a patient-visible test/scan advisory or care notice."""
    return PatientService.add_shared_notice(
        db, patient_id=patient_id, data=payload, current_user=current_user, request=request
    )


@router.delete("/{patient_id}/shared-notices/{notice_id}", response_model=MessageResponse)
def delete_shared_notice(
    request: Request,
    patient_id: int,
    notice_id: str,
    current_user: User = Depends(require_roles("admin", "doctor")),
    db: Session = Depends(get_db),
):
    """Doctor/Admin: Remove a patient-visible advisory."""
    PatientService.delete_shared_notice(
        db, patient_id=patient_id, notice_id=notice_id, current_user=current_user, request=request
    )
    return MessageResponse(message=f"Shared notice '{notice_id}' removed.")
