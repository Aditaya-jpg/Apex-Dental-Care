from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.billing import (
    InvoiceCreate,
    InvoiceResponse,
)
from app.security.dependencies import get_current_user, require_roles
from app.services.billing_service import BillingService

router = APIRouter(prefix="/billing", tags=["Billing & Invoices"])

@router.get("/my-invoices", response_model=list[InvoiceResponse])
def get_my_invoices(
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all invoices for the currently authenticated patient."""
    if current_user.role == "patient" and not current_user.patient_id:
        return []
    
    patient_id = current_user.patient_id
    if not patient_id and current_user.role in ["admin", "receptionist", "dentist"]:
        invoices = BillingService.get_invoices(db, status_filter=status)
    else:
        invoices = BillingService.get_invoices(db, patient_id=patient_id, status_filter=status)

    result = []
    for inv in invoices:
        resp = InvoiceResponse.model_validate(inv)
        resp.patient_name = inv.patient.full_name if inv.patient else None
        result.append(resp)
    return result

@router.get("/invoices", response_model=list[InvoiceResponse])
def list_invoices(
    patient_id: int | None = None,
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve invoices with patient and status filtering."""
    if current_user.role == "patient":
        patient_id = current_user.patient_id

    invoices = BillingService.get_invoices(db, patient_id=patient_id, status_filter=status)
    result = []
    for inv in invoices:
        resp = InvoiceResponse.model_validate(inv)
        resp.patient_name = inv.patient.full_name if inv.patient else None
        result.append(resp)
    return result

@router.post("/invoices", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    request: Request,
    payload: InvoiceCreate,
    current_user: User = Depends(require_roles("admin", "receptionist")),
    db: Session = Depends(get_db)
):
    """Receptionist/Admin: Create a new invoice with itemized procedures."""
    inv = BillingService.create_invoice(db, data=payload, current_user=current_user, request=request)
    resp = InvoiceResponse.model_validate(inv)
    resp.patient_name = inv.patient.full_name if inv.patient else None
    return resp

@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve single invoice with item breakdown."""
    inv = BillingService.get_invoice_by_id(db, invoice_id)
    if current_user.role == "patient" and inv.patient_id != current_user.patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this invoice.")
    resp = InvoiceResponse.model_validate(inv)
    resp.patient_name = inv.patient.full_name if inv.patient else None
    return resp

@router.get("/invoices/{invoice_id}/pdf")
def download_invoice_pdf(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate and stream clinic-branded invoice PDF."""
    inv = BillingService.get_invoice_by_id(db, invoice_id)
    if current_user.role == "patient" and inv.patient_id != current_user.patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this invoice.")
    pdf_bytes = BillingService.get_pdf(db, invoice_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="invoice_{invoice_id}.pdf"'
        }
    )
