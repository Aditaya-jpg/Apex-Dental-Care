from datetime import datetime
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.appointment import Appointment
from app.models.care_log import CareAndSystemLog
from app.models.clinical_record import ClinicalRecord
from app.models.document import Document
from app.models.patient import Patient
from app.models.user import User
from app.security.dependencies import require_roles

router = APIRouter(prefix="/patient-portal", tags=["Patient Portal"])

PRE_APPT_HINTS = {
    "en": "Please carry your PGI CR Card, previous X-rays, and arrive 15 minutes early.",
    "hi": "कृपया अपना PGI CR कार्ड और पुराने एक्स-रे साथ लाएं, तथा समय से 15 मिनट पहले पहुंचें।",
    "pa": "ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ PGI CR ਕਾਰਡ ਅਤੇ ਪੁਰਾਣੇ ਐਕਸ-ਰੇ ਨਾਲ ਲਿਆਓ, ਅਤੇ ਸਮੇਂ ਤੋਂ 15 ਮਿੰਟ ਪਹਿਲਾਂ ਪਹੁੰਚੋ।",
}


def _resolve_portal_patient(db: Session, current_user: User, patient_id: int | None) -> Patient:
    if current_user.role == "patient":
        if not current_user.patient_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PATIENT_NOT_LINKED", "message": "No patient record linked to this account."},
            )
        if patient_id is not None and patient_id != current_user.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Access denied to other patient portal records."},
            )
        target_id = current_user.patient_id
    else:
        # Admin previewing portal
        if patient_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "PATIENT_ID_REQUIRED", "message": "Admin preview requires patient_id query parameter."},
            )
        target_id = patient_id

    patient = db.query(Patient).filter(Patient.id == target_id, Patient.is_deleted == False).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PATIENT_NOT_FOUND", "message": "Patient not found."},
        )
    return patient


def _build_google_calendar_url(appt: Appointment, patient: Patient) -> str:
    start_dt = datetime.combine(appt.appointment_date, appt.start_time)
    end_dt = datetime.combine(appt.appointment_date, appt.end_time)
    dates_param = f"{start_dt.strftime('%Y%m%dT%H%M%S')}/{end_dt.strftime('%Y%m%dT%H%M%S')}"
    doc_name = appt.doctor.full_name if appt.doctor else "PGI Dental Specialist"
    params = {
        "action": "TEMPLATE",
        "text": f"PGI Dental Appointment - {appt.appointment_type}",
        "dates": dates_param,
        "details": f"Attending Doctor: {doc_name}\nCR No: {patient.cr_number or patient.patient_code}",
        "location": f"{settings.CLINIC_NAME} ({appt.operatory})",
    }
    return f"https://calendar.google.com/calendar/render?{urlencode(params)}"


@router.get("/appointments")
def get_portal_appointments(
    patient_id: int | None = Query(default=None),
    current_user: User = Depends(require_roles("patient", "admin")),
    db: Session = Depends(get_db),
):
    """
    Patient Portal: Upcoming & past appointments with attending doctor's display name ONLY,
    Google Calendar sync link, .ics download URL, and pre-appointment instructions.
    Doctor phone/email, student details, and internal clinical notes are strictly omitted.
    """
    patient = _resolve_portal_patient(db, current_user, patient_id)
    lang = patient.preferred_language or "en"
    appts = (
        db.query(Appointment)
        .filter(Appointment.patient_id == patient.id)
        .order_by(Appointment.appointment_date.desc(), Appointment.start_time.desc())
        .all()
    )

    items = []
    for a in appts:
        items.append({
            "id": a.id,
            "appointment_date": a.appointment_date.isoformat(),
            "start_time": str(a.start_time)[:5],
            "end_time": str(a.end_time)[:5],
            "appointment_type": a.appointment_type,
            "operatory": a.operatory,
            "department": a.doctor.department if a.doctor else "Oral Health Sciences",
            "doctor_name": a.doctor.full_name if a.doctor else "PGI Dental Specialist",
            "status": a.status,
            "attendance_status": a.attendance_status,
            "google_calendar_url": _build_google_calendar_url(a, patient),
            "ics_url": f"/api/v1/appointments/{a.id}/ics",
            "pre_appointment_instructions": PRE_APPT_HINTS.get(lang, PRE_APPT_HINTS["en"]),
        })

    return {
        "patient_name": patient.full_name,
        "cr_number": patient.cr_number,
        "preferred_language": lang,
        "appointments": items,
    }


@router.get("/prescriptions")
def get_portal_prescriptions(
    patient_id: int | None = Query(default=None),
    current_user: User = Depends(require_roles("patient", "admin")),
    db: Session = Depends(get_db),
):
    """
    Patient Portal: Issued patient-visible prescriptions (localized EN/HI/PA + PDF URL)
    and doctor-sent care instructions. Internal visits, charts, treatment plans, and surgical logs are strictly excluded.
    """
    patient = _resolve_portal_patient(db, current_user, patient_id)

    rx_records = (
        db.query(ClinicalRecord)
        .filter(
            ClinicalRecord.patient_id == patient.id,
            ClinicalRecord.record_type == "prescription",
            ClinicalRecord.is_visible_to_patient == True,
        )
        .order_by(desc(ClinicalRecord.record_date), desc(ClinicalRecord.id))
        .all()
    )

    prescriptions = []
    for rec in rx_records:
        payload = rec.payload_json or {}
        prescriptions.append({
            "id": rec.id,
            "prescription_number": payload.get("prescription_number") or f"RX-{rec.id}",
            "record_date": rec.record_date.isoformat(),
            "title": rec.title or "Dental Prescription",
            "language": rec.language or patient.preferred_language or "en",
            "doctor_name": rec.doctor.full_name if rec.doctor else "PGI Dental Specialist",
            "diagnosis_summary": payload.get("diagnosis_summary"),
            "general_instructions": payload.get("general_instructions"),
            "treatment_instructions": payload.get("treatment_instructions"),
            "localized_summary": payload.get("localized_summary"),
            "medications": payload.get("medications", []),
            "pdf_url": f"/api/v1/prescriptions/{rec.id}/pdf",
            "created_at": rec.created_at.isoformat(),
        })

    # Include patient-facing care instruction & preventive notifications
    care_logs = (
        db.query(CareAndSystemLog)
        .filter(
            CareAndSystemLog.patient_id == patient.id,
            CareAndSystemLog.event_type.in_(["notification", "recall"]),
        )
        .order_by(desc(CareAndSystemLog.created_at))
        .limit(20)
        .all()
    )
    care_instructions = []
    for cl in care_logs:
        p = cl.payload_json or {}
        care_instructions.append({
            "id": cl.id,
            "event_type": cl.event_type,
            "category": p.get("category", "care_instruction"),
            "title": cl.title or "Care Instruction",
            "message": p.get("message_body") or p.get("message") or cl.title,
            "language": cl.language,
            "scheduled_date": cl.scheduled_date.isoformat() if cl.scheduled_date else None,
            "created_at": cl.created_at.isoformat(),
        })

    return {
        "patient_name": patient.full_name,
        "cr_number": patient.cr_number,
        "preferred_language": patient.preferred_language,
        "prescriptions": prescriptions,
        "care_instructions": care_instructions,
    }


@router.get("/shared-items")
def get_portal_shared_items(
    patient_id: int | None = Query(default=None),
    current_user: User = Depends(require_roles("patient", "admin")),
    db: Session = Depends(get_db),
):
    """
    Patient Portal: ONLY explicit doctor-issued advisories (tests/scans to conduct and bring)
    and documents explicitly toggled is_shared_with_patient == True.
    All unshared X-rays, clinical/surgery photos, charts, and internal notes are hidden.
    """
    patient = _resolve_portal_patient(db, current_user, patient_id)

    shared_docs = (
        db.query(Document)
        .filter(
            Document.patient_id == patient.id,
            Document.is_shared_with_patient == True,
        )
        .order_by(desc(Document.media_date), desc(Document.id))
        .all()
    )

    docs_payload = []
    for d in shared_docs:
        docs_payload.append({
            "id": d.id,
            "document_type": d.document_type,
            "title": d.title or d.original_filename,
            "description": d.description,
            "disease_category": d.disease_category,
            "treatment_stage": d.treatment_stage,
            "media_date": d.media_date.isoformat() if d.media_date else None,
            "original_filename": d.original_filename,
            "mime_type": d.mime_type,
            "file_size_bytes": d.file_size_bytes,
            "download_url": f"/api/v1/documents/{d.id}/download",
            "created_at": d.created_at.isoformat(),
        })

    return {
        "patient_name": patient.full_name,
        "cr_number": patient.cr_number,
        "advisories": list(patient.patient_shared_notices_json or []),
        "shared_documents": docs_payload,
    }
