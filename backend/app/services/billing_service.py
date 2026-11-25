from datetime import date, datetime, UTC
from decimal import Decimal

from fastapi import HTTPException, Request, status
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.models.billing import (
    Invoice,
    InvoiceItem,
)
from app.models.patient import Patient
from app.models.user import User
from app.pdf.generator import generate_invoice_pdf
from app.schemas.billing import (
    InvoiceCreate,
)


class BillingService:
    @staticmethod
    def _generate_invoice_number(db: Session) -> str:
        count = db.query(func.count(Invoice.id)).scalar() or 0
        return f"INV-2026-{1001 + count}"

    @classmethod
    def create_invoice(
        cls,
        db: Session,
        data: InvoiceCreate,
        current_user: User,
        request: Request | None = None
    ) -> Invoice:
        patient = db.query(Patient).filter(Patient.id == data.patient_id, Patient.is_deleted == False).first()
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PATIENT_NOT_FOUND", "message": "Patient not found."}
            )

        invoice_num = cls._generate_invoice_number(db)

        # Calculate subtotal using exact Decimals
        subtotal = Decimal('0.00')
        for item in data.items:
            line_tot = Decimal(str(item.unit_price)) * Decimal(str(item.quantity))
            subtotal += line_tot

        discount = Decimal(str(data.discount))
        tax = Decimal(str(data.tax))
        total = (subtotal - discount) + tax
        total = max(total, Decimal('0.00'))

        invoice = Invoice(
            invoice_number=invoice_num,
            patient_id=data.patient_id,
            visit_id=data.visit_id,
            treatment_plan_id=data.treatment_plan_id,
            issue_date=date.today(),
            due_date=data.due_date,
            subtotal=subtotal,
            discount=discount,
            tax=tax,
            total=total,
            paid_amount=Decimal('0.00'),
            balance=total,
            status="unpaid" if total > 0 else "paid",
            notes=data.notes
        )
        db.add(invoice)
        db.flush()

        for item in data.items:
            line_tot = Decimal(str(item.unit_price)) * Decimal(str(item.quantity))
            inv_item = InvoiceItem(
                invoice_id=invoice.id,
                description=item.description,
                unit_price=item.unit_price,
                quantity=item.quantity,
                total=line_tot
            )
            db.add(inv_item)

        db.commit()
        db.refresh(invoice)

        if current_user:
            log_audit_event(
                db=db,
                action="INVOICE_CREATE",
                user=current_user,
                entity_name="Invoice",
                entity_id=str(invoice.id),
                details={
                    "invoice_number": invoice.invoice_number,
                    "patient_id": invoice.patient_id,
                    "total": float(invoice.total),
                    "items_count": len(data.items)
                },
                request=request
            )

        return invoice

    @classmethod
    def get_invoices(
        cls,
        db: Session,
        patient_id: int | None = None,
        status_filter: str | None = None
    ) -> list[Invoice]:
        query = db.query(Invoice)
        if patient_id:
            query = query.filter(Invoice.patient_id == patient_id)
        if status_filter and status_filter.lower() != "all":
            query = query.filter(Invoice.status == status_filter.lower())
        return query.order_by(desc(Invoice.created_at)).all()

    @classmethod
    def get_invoice_by_id(cls, db: Session, invoice_id: int) -> Invoice:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "INVOICE_NOT_FOUND", "message": "Invoice not found."}
            )
        return invoice

    @classmethod
    def get_pdf(cls, db: Session, invoice_id: int) -> bytes:
        inv = cls.get_invoice_by_id(db, invoice_id)
        return generate_invoice_pdf(inv, inv.patient)
