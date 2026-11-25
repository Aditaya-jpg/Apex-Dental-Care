from datetime import date

from fastapi import HTTPException, Request, UploadFile, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.constants import DOCUMENT_TYPES, TREATMENT_STAGES
from app.models.document import Document
from app.models.patient import Patient
from app.models.user import User
from app.schemas.document import DocumentResponse
from app.security.dependencies import resolve_student_for_user, verify_patient_access
from app.storage.file_storage import file_storage


def to_document_response(doc: Document) -> DocumentResponse:
    return DocumentResponse(
        id=doc.id,
        patient_id=doc.patient_id,
        clinical_record_id=doc.clinical_record_id,
        visit_id=doc.clinical_record_id,
        uploaded_by_user_id=doc.uploaded_by_user_id,
        document_type=doc.document_type,
        title=doc.title or doc.original_filename,
        description=doc.description,
        notes=doc.description,
        disease_category=doc.disease_category,
        treatment_stage=doc.treatment_stage,
        media_date=doc.media_date or doc.created_at.date(),
        is_shared_with_patient=doc.is_shared_with_patient,
        storage_key=doc.storage_key,
        file_name=doc.file_name,
        original_filename=doc.original_filename,
        original_file_name=doc.original_filename,
        mime_type=doc.mime_type,
        file_size_bytes=doc.file_size_bytes,
        file_size=doc.file_size_bytes,
        is_encrypted=doc.is_encrypted,
        sha256_checksum=doc.sha256_checksum,
        created_at=doc.created_at,
        patient_name=doc.patient.full_name if doc.patient else None,
        uploaded_by_name=doc.uploaded_by.full_name if doc.uploaded_by else None,
    )


class DocumentService:
    @staticmethod
    async def upload_document(
        db: Session,
        patient_id: int,
        document_type: str,
        file: UploadFile,
        current_user: User,
        visit_id: int | None = None,
        clinical_record_id: int | None = None,
        title: str | None = None,
        description: str | None = None,
        notes: str | None = None,
        disease_category: str | None = None,
        treatment_stage: str = "initial_assessment",
        media_date: date | None = None,
        is_shared_with_patient: bool = False,
        request: Request | None = None,
    ) -> Document:
        patient = verify_patient_access(db, current_user, patient_id, require_write=True)

        norm_doc_type = (document_type or "other").strip().lower()
        if norm_doc_type not in DOCUMENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "INVALID_DOCUMENT_TYPE",
                    "message": f"Invalid document_type '{document_type}'. Allowed: {DOCUMENT_TYPES}",
                },
            )

        norm_stage = (treatment_stage or "initial_assessment").strip().lower()
        if norm_stage not in TREATMENT_STAGES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "INVALID_TREATMENT_STAGE",
                    "message": f"Invalid treatment_stage '{treatment_stage}'. Allowed: {TREATMENT_STAGES}",
                },
            )

        stored = await file_storage.save_encrypted_upload(
            patient_id=patient.id,
            file=file,
            document_type=norm_doc_type,
        )

        # Students cannot expose items to patient portal; only Doctors/Admin can toggle share
        shared_flag = bool(is_shared_with_patient) if current_user.role in ("admin", "doctor", "dentist") else False

        doc = Document(
            patient_id=patient.id,
            clinical_record_id=clinical_record_id or visit_id,
            uploaded_by_user_id=current_user.id,
            document_type=norm_doc_type,
            title=title or stored.original_filename,
            description=description or notes,
            disease_category=disease_category,
            treatment_stage=norm_stage,
            media_date=media_date or date.today(),
            is_shared_with_patient=shared_flag,
            storage_key=stored.storage_key,
            original_filename=stored.original_filename,
            mime_type=stored.mime_type,
            file_size_bytes=stored.file_size_bytes,
            is_encrypted=stored.is_encrypted,
            encryption_iv=stored.encryption_iv,
            sha256_checksum=stored.sha256_checksum,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        log_audit_event(
            db=db,
            action="DOCUMENT_UPLOAD",
            user=current_user,
            entity_name="Document",
            entity_id=str(doc.id),
            patient_id=patient.id,
            details={
                "patient_id": patient.id,
                "type": norm_doc_type,
                "treatment_stage": norm_stage,
                "filename": stored.original_filename,
                "sha256": stored.sha256_checksum,
            },
            request=request,
        )

        return doc

    @staticmethod
    def get_document_by_id(db: Session, document_id: int) -> Document:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found."},
            )
        return doc

    @staticmethod
    def get_patient_documents(
        db: Session,
        patient_id: int,
        current_user: User,
        *,
        document_type: str | None = None,
        treatment_stage: str | None = None,
        disease_category: str | None = None,
        media_date: date | None = None,
    ) -> list[Document]:
        verify_patient_access(db, current_user, patient_id, allow_patient_self=True)
        query = db.query(Document).filter(Document.patient_id == patient_id)
        if current_user.role == "patient":
            query = query.filter(Document.is_shared_with_patient == True)
        if document_type:
            query = query.filter(Document.document_type == document_type.strip().lower())
        if treatment_stage:
            query = query.filter(Document.treatment_stage == treatment_stage.strip().lower())
        if disease_category:
            query = query.filter(Document.disease_category == disease_category.strip())
        if media_date:
            query = query.filter(Document.media_date == media_date)
        return query.order_by(desc(Document.media_date), desc(Document.created_at)).all()

    @staticmethod
    def get_all_documents(
        db: Session,
        current_user: User,
        *,
        patient_id: int | None = None,
        document_type: str | None = None,
        treatment_stage: str | None = None,
        disease_category: str | None = None,
        media_date: date | None = None,
    ) -> list[Document]:
        if current_user.role in ("receptionist", "patient"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Access to clinic document directory is restricted."},
            )

        query = db.query(Document)
        if current_user.role == "student":
            stu = resolve_student_for_user(db, current_user)
            if not stu:
                return []
            assigned_ids = [
                r[0]
                for r in db.query(Patient.id).filter(Patient.student_id == stu.id, Patient.is_deleted == False).all()
            ]
            if not assigned_ids:
                return []
            query = query.filter(Document.patient_id.in_(assigned_ids))

        if patient_id is not None:
            verify_patient_access(db, current_user, patient_id)
            query = query.filter(Document.patient_id == patient_id)
        if document_type:
            query = query.filter(Document.document_type == document_type.strip().lower())
        if treatment_stage:
            query = query.filter(Document.treatment_stage == treatment_stage.strip().lower())
        if disease_category:
            query = query.filter(Document.disease_category == disease_category.strip())
        if media_date:
            query = query.filter(Document.media_date == media_date)

        return query.order_by(desc(Document.media_date), desc(Document.created_at)).all()

    @classmethod
    def authorize_download(
        cls,
        db: Session,
        document_id: int,
        current_user: User,
        request: Request | None = None,
    ) -> Document:
        """
        Strict IDOR authorization gate:
        - admin / doctor: allowed across all patients.
        - student: allowed ONLY if patient.student_id == current_student.id.
        - patient: allowed ONLY if doc.patient_id == current_user.patient_id AND doc.is_shared_with_patient == True.
        - receptionist: ALWAYS 403.
        """
        doc = cls.get_document_by_id(db, document_id)
        verify_patient_access(db, current_user, doc.patient_id, allow_patient_self=True)

        if current_user.role == "patient" and not doc.is_shared_with_patient:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "This document has not been shared with you."},
            )

        log_audit_event(
            db=db,
            action="DOCUMENT_DOWNLOAD",
            user=current_user,
            entity_name="Document",
            entity_id=str(doc.id),
            patient_id=doc.patient_id,
            details={"filename": doc.original_filename},
            request=request,
        )

        return doc

    @classmethod
    def set_share_status(
        cls,
        db: Session,
        document_id: int,
        is_shared: bool,
        current_user: User,
        request: Request | None = None,
    ) -> Document:
        doc = cls.get_document_by_id(db, document_id)
        verify_patient_access(db, current_user, doc.patient_id, require_write=True)
        doc.is_shared_with_patient = is_shared
        db.commit()
        db.refresh(doc)

        log_audit_event(
            db=db,
            action="DOCUMENT_SHARE_UPDATED",
            user=current_user,
            entity_name="Document",
            entity_id=str(doc.id),
            patient_id=doc.patient_id,
            details={"is_shared_with_patient": is_shared},
            request=request,
        )
        return doc

    @classmethod
    def delete_document(
        cls,
        db: Session,
        document_id: int,
        current_user: User,
        request: Request | None = None,
    ) -> None:
        doc = cls.get_document_by_id(db, document_id)
        verify_patient_access(db, current_user, doc.patient_id, require_write=True)
        storage_key = doc.storage_key
        patient_id = doc.patient_id
        filename = doc.original_filename
        db.delete(doc)
        db.commit()
        if storage_key and not storage_key.startswith("/"):
            file_storage.delete_object(storage_key)

        log_audit_event(
            db=db,
            action="DOCUMENT_DELETE",
            user=current_user,
            entity_name="Document",
            entity_id=str(document_id),
            patient_id=patient_id,
            details={"filename": filename},
            request=request,
        )
