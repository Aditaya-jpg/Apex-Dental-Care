import io
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.config import settings

FONTS_DIR = Path(__file__).resolve().parent / "fonts"
_REGISTERED_FONTS = False


def _ensure_fonts_registered() -> tuple[str, str]:
    """Register Unicode TTF fonts (Latin, Devanagari, Gurmukhi) if present."""
    global _REGISTERED_FONTS
    if not _REGISTERED_FONTS:
        font_files = {
            "PGISans": FONTS_DIR / "NotoSans-Regular.ttf",
            "PGISans-Bold": FONTS_DIR / "NotoSans-Bold.ttf",
            "PGIDevanagari": FONTS_DIR / "NotoSansDevanagari-Regular.ttf",
            "PGIDevanagari-Bold": FONTS_DIR / "NotoSansDevanagari-Bold.ttf",
            "PGIGurmukhi": FONTS_DIR / "NotoSansGurmukhi-Regular.ttf",
            "PGIGurmukhi-Bold": FONTS_DIR / "NotoSansGurmukhi-Bold.ttf",
        }
        for name, path in font_files.items():
            if path.exists():
                try:
                    pdfmetrics.registerFont(TTFont(name, str(path)))
                except Exception:
                    pass
        _REGISTERED_FONTS = True
    return "PGISans", "PGISans-Bold"


def _select_font_pair(language: str) -> tuple[str, str]:
    regular, bold = _ensure_fonts_registered()
    if language == "hi" and "PGIDevanagari" in pdfmetrics.getRegisteredFontNames():
        return "PGIDevanagari", "PGIDevanagari-Bold" if "PGIDevanagari-Bold" in pdfmetrics.getRegisteredFontNames() else "PGIDevanagari"
    if language == "pa" and "PGIGurmukhi" in pdfmetrics.getRegisteredFontNames():
        return "PGIGurmukhi", "PGIGurmukhi-Bold" if "PGIGurmukhi-Bold" in pdfmetrics.getRegisteredFontNames() else "PGIGurmukhi"
    if regular in pdfmetrics.getRegisteredFontNames():
        return regular, bold if bold in pdfmetrics.getRegisteredFontNames() else regular
    return "Helvetica", "Helvetica-Bold"


def get_clinic_header(styles, font_regular: str = "Helvetica", font_bold: str = "Helvetica-Bold") -> list:
    """Reusable PGI Dental Branch branding header."""
    header_elements = []

    clinic_title_style = ParagraphStyle(
        "ClinicTitle",
        parent=styles["Heading1"],
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#0d9488"),
        fontName=font_bold,
        spaceAfter=2,
    )

    clinic_sub_style = ParagraphStyle(
        "ClinicSub",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=11,
        fontName=font_regular,
        textColor=colors.HexColor("#4b5563"),
    )

    header_elements.append(Paragraph(settings.CLINIC_NAME, clinic_title_style))
    header_elements.append(Paragraph(f"{settings.CLINIC_ADDRESS} | Phone: {settings.CLINIC_PHONE}", clinic_sub_style))
    header_elements.append(Paragraph(f"Email: {settings.CLINIC_EMAIL} | Reg No: {settings.CLINIC_REG_NO}", clinic_sub_style))
    header_elements.append(Spacer(1, 8))
    header_elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0d9488"), spaceBefore=2, spaceAfter=12))

    return header_elements


def generate_prescription_pdf(rx_record, patient, doctor) -> bytes:
    """Generate a PGI Dental Branch prescription PDF from ClinicalRecord(record_type='prescription')."""
    payload = getattr(rx_record, "payload_json", None) or {}
    language = getattr(rx_record, "language", "en") or "en"
    font_reg, font_bold = _select_font_pair(language)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()
    normal_style = ParagraphStyle("PGINormal", parent=styles["Normal"], fontName=font_reg, fontSize=9.5, leading=13)
    bold_style = ParagraphStyle("PGIBold", parent=normal_style, fontName=font_bold)

    story = []
    story.extend(get_clinic_header(styles, font_regular="Helvetica", font_bold="Helvetica-Bold"))

    doctor_name = doctor.full_name if doctor else "Dr. In-Charge"
    doctor_spec = doctor.specialization if doctor else "Dental Surgeon"
    doctor_lic = doctor.license_number if doctor else "N/A"
    rx_number = payload.get("prescription_number") or f"RX-{rx_record.id}"

    doc_meta_data = [
        [
            Paragraph(
                f"<b>Prescribing Doctor:</b><br/>{doctor_name}<br/><i>{doctor_spec}</i><br/>Reg/License: {doctor_lic}",
                normal_style,
            ),
            Paragraph(
                f"<b>Prescription #:</b> {rx_number}<br/>"
                f"<b>Date:</b> {rx_record.created_at.strftime('%d-%b-%Y')}<br/>"
                f"<b>Language:</b> {language.upper()}",
                normal_style,
            ),
        ]
    ]

    t_doc = Table(doc_meta_data, colWidths=[270, 270])
    t_doc.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("PADDING", (0, 0), (-1, -1), 8),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ])
    )
    story.append(t_doc)
    story.append(Spacer(1, 10))

    dob_str = patient.date_of_birth.strftime("%d-%b-%Y") if patient and patient.date_of_birth else "N/A"
    patient_name = patient.full_name if patient else "Patient"
    patient_gender = patient.gender if patient else ""
    patient_cr = (patient.cr_number or patient.patient_code) if patient else "N/A"
    patient_phone = patient.phone if patient else "N/A"

    patient_data = [
        [
            Paragraph(f"<b>Patient:</b> {patient_name} ({patient_gender})", normal_style),
            Paragraph(f"<b>CR / Code:</b> {patient_cr}", normal_style),
            Paragraph(f"<b>DOB:</b> {dob_str}", normal_style),
            Paragraph(f"<b>Phone:</b> {patient_phone}", normal_style),
        ]
    ]
    t_patient = Table(patient_data, colWidths=[170, 120, 125, 125])
    t_patient.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fdfa")),
            ("PADDING", (0, 0), (-1, -1), 6),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#99f6e4")),
        ])
    )
    story.append(t_patient)
    story.append(Spacer(1, 12))

    diagnosis_summary = payload.get("diagnosis_summary")
    if diagnosis_summary:
        story.append(Paragraph(f"<b>Diagnosis / Clinical Summary:</b> {diagnosis_summary}", normal_style))
        story.append(Spacer(1, 10))

    story.append(
        Paragraph(
            "<b>Rx MEDICATION &amp; DOSAGE SCHEDULE</b>",
            ParagraphStyle("RxHeader", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, textColor=colors.HexColor("#0f766e")),
        )
    )
    story.append(Spacer(1, 6))

    med_table_data = [
        [
            Paragraph("<b>#</b>", bold_style),
            Paragraph("<b>Medicine Name</b>", bold_style),
            Paragraph("<b>Dosage</b>", bold_style),
            Paragraph("<b>Frequency</b>", bold_style),
            Paragraph("<b>Duration</b>", bold_style),
            Paragraph("<b>Timing &amp; Instructions</b>", bold_style),
        ]
    ]

    for idx, item in enumerate(payload.get("medications", []), start=1):
        inst = item.get("localized_instructions") or item.get("instructions") or ""
        timing_str = f"{item.get('timing', 'After Food')}" + (f" - {inst}" if inst else "")
        med_table_data.append([
            Paragraph(str(idx), normal_style),
            Paragraph(f"<b>{item.get('medicine_name', '')}</b>", normal_style),
            Paragraph(str(item.get("dosage", "")), normal_style),
            Paragraph(str(item.get("frequency", "")), normal_style),
            Paragraph(str(item.get("duration", "")), normal_style),
            Paragraph(timing_str, normal_style),
        ])

    t_meds = Table(med_table_data, colWidths=[25, 140, 75, 80, 70, 150])
    t_meds.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0d9488")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("PADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ])
    )
    story.append(t_meds)
    story.append(Spacer(1, 12))

    general_instructions = payload.get("general_instructions")
    if general_instructions:
        story.append(Paragraph("<b>General Advice &amp; Instructions:</b>", bold_style))
        story.append(Paragraph(general_instructions, normal_style))
        story.append(Spacer(1, 10))

    treatment_instructions = payload.get("treatment_instructions") or payload.get("localized_summary")
    if treatment_instructions:
        story.append(Paragraph("<b>Care Instructions:</b>", bold_style))
        story.append(Paragraph(treatment_instructions, normal_style))
        story.append(Spacer(1, 12))

    story.append(Spacer(1, 24))
    sig_data = [
        [
            Paragraph(
                "<i>* Valid for 30 days from date of issue.<br/>* Keep medications out of reach of children.</i>",
                ParagraphStyle("Foot", parent=normal_style, fontSize=8, textColor=colors.gray),
            ),
            Paragraph(
                f"____________________________________<br/><b>{doctor_name}</b><br/>Authorized PGI Doctor Signature",
                ParagraphStyle("Sig", parent=normal_style, alignment=2),
            ),
        ]
    ]
    t_sig = Table(sig_data, colWidths=[300, 240])
    t_sig.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "BOTTOM"), ("PADDING", (0, 0), (-1, -1), 0)]))
    story.append(t_sig)

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
