from datetime import date

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.document import DocumentResponse, DocumentShareUpdate
from app.security.dependencies import get_current_user, require_roles
from app.services.document_service import DocumentService, to_document_response
from app.storage.file_storage import file_storage

router = APIRouter(prefix="/documents", tags=["Document & X-Ray Vault"])


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    request: Request,
    patient_id: int = Form(...),
    document_type: str = Form(...),
    title: str | None = Form(None),
    description: str | None = Form(None),
    notes: str | None = Form(None),
    disease_category: str | None = Form(None),
    treatment_stage: str = Form("initial_assessment"),
    media_date: date | None = Form(None),
    is_shared_with_patient: bool = Form(False),
    visit_id: int | None = Form(None),
    clinical_record_id: int | None = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Securely encrypt and upload patient document, clinical photo, or diagnostic scan (2D/CBCT)."""
    doc = await DocumentService.upload_document(
        db=db,
        patient_id=patient_id,
        document_type=document_type,
        file=file,
        current_user=current_user,
        visit_id=visit_id,
        clinical_record_id=clinical_record_id,
        title=title,
        description=description or notes,
        disease_category=disease_category,
        treatment_stage=treatment_stage,
        media_date=media_date,
        is_shared_with_patient=is_shared_with_patient,
        request=request,
    )
    return to_document_response(doc)


@router.get("", response_model=list[DocumentResponse])
def list_documents(
    patient_id: int | None = None,
    document_type: str | None = None,
    treatment_stage: str | None = None,
    disease_category: str | None = None,
    media_date: date | None = None,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Retrieve encrypted clinic documents scoped by RBAC (Students see only assigned patients)."""
    docs = DocumentService.get_all_documents(
        db,
        current_user=current_user,
        patient_id=patient_id,
        document_type=document_type,
        treatment_stage=treatment_stage,
        disease_category=disease_category,
        media_date=media_date,
    )
    return [to_document_response(d) for d in docs]


@router.get("/patient/{patient_id}", response_model=list[DocumentResponse])
def get_patient_documents(
    patient_id: int,
    document_type: str | None = None,
    treatment_stage: str | None = None,
    disease_category: str | None = None,
    media_date: date | None = None,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Retrieve metadata of documents and scans for an authorized patient."""
    docs = DocumentService.get_patient_documents(
        db,
        patient_id,
        current_user=current_user,
        document_type=document_type,
        treatment_stage=treatment_stage,
        disease_category=disease_category,
        media_date=media_date,
    )
    return [to_document_response(d) for d in docs]


@router.get("/{document_id}/download")
def download_document(
    request: Request,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Decrypt and stream protected vault file after strict IDOR & patient-sharing verification."""
    doc = DocumentService.authorize_download(db, document_id, current_user=current_user, request=request)
    return StreamingResponse(
        file_storage.iter_decrypted_chunks(doc.storage_key),
        media_type=doc.mime_type,
        headers={"Content-Disposition": f'inline; filename="{doc.original_filename}"'},
    )


@router.patch("/{document_id}/share", response_model=DocumentResponse)
def toggle_document_share(
    request: Request,
    document_id: int,
    payload: DocumentShareUpdate,
    current_user: User = Depends(require_roles("admin", "doctor")),
    db: Session = Depends(get_db),
):
    """Doctor/Admin: Toggle whether a document or scan is visible in the Patient Portal."""
    doc = DocumentService.set_share_status(
        db,
        document_id=document_id,
        is_shared=payload.is_shared_with_patient,
        current_user=current_user,
        request=request,
    )
    return to_document_response(doc)


@router.delete("/{document_id}", response_model=MessageResponse)
def delete_document(
    request: Request,
    document_id: int,
    current_user: User = Depends(require_roles("admin", "doctor")),
    db: Session = Depends(get_db),
):
    """Doctor/Admin: Permanently remove an encrypted document from vault and database."""
    DocumentService.delete_document(db, document_id=document_id, current_user=current_user, request=request)
    return MessageResponse(message=f"Document {document_id} removed.")
