"""PGI Dental PDF generation with HarfBuzz OpenType shaping for Latin, Devanagari (Hindi), and Gurmukhi (Punjabi)."""

from __future__ import annotations

import io
import re
from pathlib import Path
from typing import Any

import uharfbuzz as hb
from fontTools.pens.basePen import BasePen
from fontTools.pens.qu2cuPen import Qu2CuPen
from fontTools.ttLib import TTFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont as RLTTFont
from reportlab.platypus import (
    Flowable,
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.config import settings
from app.i18n.translations import (
    get_prescription_labels,
    localize_medication_item,
    normalize_language,
)

FONTS_DIR = Path(__file__).resolve().parent / "fonts"
_REGISTERED_FONTS = False
_FONT_RESOURCES: dict[tuple[str, bool], dict[str, Any]] = {}

FONT_MAP: dict[tuple[str, bool], tuple[str, str]] = {
    ("latin", False): ("PGISans", "NotoSans-Regular.ttf"),
    ("latin", True): ("PGISans-Bold", "NotoSans-Bold.ttf"),
    ("devanagari", False): ("PGIDevanagari", "NotoSansDevanagari-Regular.ttf"),
    ("devanagari", True): ("PGIDevanagari-Bold", "NotoSansDevanagari-Bold.ttf"),
    ("gurmukhi", False): ("PGIGurmukhi", "NotoSansGurmukhi-Regular.ttf"),
    ("gurmukhi", True): ("PGIGurmukhi-Bold", "NotoSansGurmukhi-Bold.ttf"),
}


class _ReportLabCubicPen(BasePen):
    """fontTools pen emitting translated & scaled cubic Bezier segments onto a ReportLab PDFPathObject."""

    def __init__(self, glyph_set: Any, pdf_path: Any, tx: float, ty: float, scale: float):
        super().__init__(glyph_set)
        self.pdf_path = pdf_path
        self.tx = tx
        self.ty = ty
        self.scale = scale

    def _x(self, x: float) -> float:
        return self.tx + x * self.scale

    def _y(self, y: float) -> float:
        return self.ty + y * self.scale

    def _moveTo(self, pt: tuple[float, float]) -> None:
        self.pdf_path.moveTo(self._x(pt[0]), self._y(pt[1]))

    def _lineTo(self, pt: tuple[float, float]) -> None:
        self.pdf_path.lineTo(self._x(pt[0]), self._y(pt[1]))

    def _curveToOne(
        self,
        pt1: tuple[float, float],
        pt2: tuple[float, float],
        pt3: tuple[float, float],
    ) -> None:
        self.pdf_path.curveTo(
            self._x(pt1[0]),
            self._y(pt1[1]),
            self._x(pt2[0]),
            self._y(pt2[1]),
            self._x(pt3[0]),
            self._y(pt3[1]),
        )

    def _closePath(self) -> None:
        self.pdf_path.close()


def _ensure_fonts_registered() -> tuple[str, str]:
    """Register Unicode TTF fonts (Latin, Devanagari, Gurmukhi) with ReportLab."""
    global _REGISTERED_FONTS
    if not _REGISTERED_FONTS:
        for (rl_name, filename) in FONT_MAP.values():
            path = FONTS_DIR / filename
            if path.exists():
                try:
                    pdfmetrics.registerFont(RLTTFont(rl_name, str(path)))
                except Exception:
                    pass
        _REGISTERED_FONTS = True
    return "PGISans", "PGISans-Bold"


def _get_font_resource(script_key: str, bold: bool) -> dict[str, Any]:
    """Load and cache fontTools TTFont, cmap, and uharfbuzz Font for a script + weight."""
    _ensure_fonts_registered()
    key = (script_key, bold)
    if key in _FONT_RESOURCES:
        return _FONT_RESOURCES[key]

    rl_name, filename = FONT_MAP.get(key, FONT_MAP[("latin", bold)])
    path = FONTS_DIR / filename
    if not path.exists():
        rl_name, filename = FONT_MAP[("latin", False)]
        path = FONTS_DIR / filename

    tt_font = TTFont(str(path))
    cmap = tt_font.getBestCmap() or {}
    glyph_set = tt_font.getGlyphSet()
    upem = int(tt_font["head"].unitsPerEm or 1000)

    blob = hb.Blob.from_file_path(str(path))
    face = hb.Face(blob)
    hb_font = hb.Font(face)

    res = {
        "rl_name": rl_name,
        "tt_font": tt_font,
        "cmap": cmap,
        "glyph_set": glyph_set,
        "upem": upem,
        "hb_font": hb_font,
    }
    _FONT_RESOURCES[key] = res
    return res


def _detect_char_script(ch: str, bold: bool, active_indic: str | None = None) -> str:
    """Assign each character to a script font whose cmap contains it (prevents missing-glyph boxes)."""
    cp = ord(ch)
    if 0x0900 <= cp <= 0x097F:
        return "devanagari"
    if 0x0A00 <= cp <= 0x0A7F:
        return "gurmukhi"
    if cp in (0x200C, 0x200D, 0x200B):  # ZWNJ, ZWJ, ZWSP
        return active_indic or "latin"
    if cp in (0x0964, 0x0965):  # Danda / Double Danda
        if active_indic == "gurmukhi" and cp in _get_font_resource("gurmukhi", bold)["cmap"]:
            return "gurmukhi"
        return "devanagari"

    latin_cmap = _get_font_resource("latin", bold)["cmap"]
    if cp in latin_cmap:
        return "latin"
    if cp in _get_font_resource("devanagari", bold)["cmap"]:
        return "devanagari"
    if cp in _get_font_resource("gurmukhi", bold)["cmap"]:
        return "gurmukhi"
    return "latin"


def _segment_script_runs(text: str, bold: bool) -> list[tuple[str, str]]:
    """Split text into contiguous (segment, script_key) runs for mixed-script shaping."""
    if not text:
        return []
    runs: list[tuple[str, str]] = []
    cur_chars: list[str] = []
    cur_script: str | None = None
    active_indic: str | None = None

    for ch in text:
        sc = _detect_char_script(ch, bold, active_indic)
        if sc in ("devanagari", "gurmukhi"):
            active_indic = sc
        elif ch.isascii() and ch.isalpha():
            active_indic = None

        if cur_script is None:
            cur_script = sc
            cur_chars.append(ch)
        elif sc == cur_script:
            cur_chars.append(ch)
        else:
            runs.append(("".join(cur_chars), cur_script))
            cur_script = sc
            cur_chars = [ch]

    if cur_chars and cur_script is not None:
        runs.append(("".join(cur_chars), cur_script))
    return runs


def _shape_run(text: str, script_key: str, bold: bool, font_size: float) -> tuple[list[Any], list[Any], float, dict[str, Any]]:
    """Run HarfBuzz shaping for an Indic or Latin text run."""
    res = _get_font_resource(script_key, bold)
    buf = hb.Buffer()
    buf.add_str(text)
    if script_key == "devanagari":
        buf.script = "Deva"
    elif script_key == "gurmukhi":
        buf.script = "Guru"
    else:
        buf.script = "Latn"
    buf.direction = "ltr"
    buf.guess_segment_properties()
    hb.shape(res["hb_font"], buf)
    scale = font_size / float(res["upem"])
    return buf.glyph_infos, buf.glyph_positions, scale, res


def measure_shaped_width(text: str, font_size: float, bold: bool = False) -> float:
    """Accurately measure rendered width across mixed Latin, Devanagari, and Gurmukhi runs."""
    if not text:
        return 0.0
    total = 0.0
    for seg, script_key in _segment_script_runs(text, bold):
        if script_key == "latin":
            res = _get_font_resource("latin", bold)
            rl_name = res["rl_name"]
            if rl_name in pdfmetrics.getRegisteredFontNames():
                total += pdfmetrics.stringWidth(seg, rl_name, font_size)
            else:
                total += pdfmetrics.stringWidth(seg, "Helvetica-Bold" if bold else "Helvetica", font_size)
        else:
            _, poss, scale, _ = _shape_run(seg, script_key, bold, font_size)
            total += sum(pos.x_advance * scale for pos in poss)
    return total


def _is_combining_indic(ch: str) -> bool:
    cp = ord(ch)
    return (
        (0x0900 <= cp <= 0x0903)
        or (0x093A <= cp <= 0x094F)
        or (0x0951 <= cp <= 0x0957)
        or (0x0962 <= cp <= 0x0963)
        or (0x0A01 <= cp <= 0x0A03)
        or (0x0A3C <= cp <= 0x0A4D)
        or (0x0A70 <= cp <= 0x0A75)
        or cp in (0x200C, 0x200D)
    )


def _split_grapheme_clusters(word: str) -> list[str]:
    """Group base + combining marks so hard-wrapping never tears apart an Indic syllable."""
    clusters: list[str] = []
    for ch in word:
        if clusters and (_is_combining_indic(ch) or clusters[-1].endswith("\u094d") or clusters[-1].endswith("\u0a4d")):
            clusters[-1] += ch
        else:
            clusters.append(ch)
    return clusters


class ShapedParagraph(Flowable):
    """
    ReportLab Flowable supporting mixed Latin + Devanagari + Gurmukhi text with:
    - HarfBuzz OpenType glyph shaping (GSUB/GPOS)
    - fontTools Qu2CuPen vector glyph path rendering (zero missing-glyph boxes)
    - Word-level and grapheme-safe wrapping inside tables and document stories
    """

    def __init__(
        self,
        text: str | None,
        font_size: float = 9.5,
        leading: float | None = None,
        bold: bool = False,
        color: Any = colors.HexColor("#1e293b"),
        align: int = 0,
        space_after: float = 0.0,
    ):
        super().__init__()
        self.text = str(text or "")
        self.font_size = float(font_size)
        self.leading = float(leading or round(font_size * 1.38, 2))
        self.bold = bool(bold)
        self.color = color
        self.align = align
        self.space_after = float(space_after)
        self._lines: list[str] = [self.text]

    def _wrap_paragraph(self, para: str, max_width: float) -> list[str]:
        if not para:
            return [""]
        words = para.split(" ")
        lines: list[str] = []
        cur_line = ""

        for word in words:
            candidate = word if not cur_line else f"{cur_line} {word}"
            if measure_shaped_width(candidate, self.font_size, self.bold) <= max_width:
                cur_line = candidate
                continue

            if cur_line:
                lines.append(cur_line)
                cur_line = ""

            if measure_shaped_width(word, self.font_size, self.bold) <= max_width:
                cur_line = word
            else:
                # Hard-wrap long token along grapheme cluster boundaries
                chunk = ""
                for cl in _split_grapheme_clusters(word):
                    if chunk and measure_shaped_width(chunk + cl, self.font_size, self.bold) > max_width:
                        lines.append(chunk)
                        chunk = cl
                    else:
                        chunk += cl
                cur_line = chunk

        if cur_line or not lines:
            lines.append(cur_line)
        return lines

    def wrap(self, availWidth: float, availHeight: float) -> tuple[float, float]:
        max_w = max(float(availWidth), 24.0)
        wrapped: list[str] = []
        for para in self.text.split("\n"):
            wrapped.extend(self._wrap_paragraph(para, max_w))
        self._lines = wrapped or [""]
        self.width = max_w
        self.height = (len(self._lines) * self.leading) + 2.0 + self.space_after
        return self.width, self.height

    def draw(self) -> None:
        canv = self.canv
        canv.saveState()
        canv.setFillColor(self.color)

        top_y = self.height - 1.0 - self.font_size
        for line_idx, line in enumerate(self._lines):
            if not line:
                continue
            baseline_y = top_y - (line_idx * self.leading)
            line_w = measure_shaped_width(line, self.font_size, self.bold)
            if self.align == 1:
                cursor_x = max(0.0, (self.width - line_w) / 2.0)
            elif self.align == 2:
                cursor_x = max(0.0, self.width - line_w)
            else:
                cursor_x = 0.0

            for seg, script_key in _segment_script_runs(line, self.bold):
                if script_key == "latin":
                    res = _get_font_resource("latin", self.bold)
                    rl_name = res["rl_name"]
                    if rl_name not in pdfmetrics.getRegisteredFontNames():
                        rl_name = "Helvetica-Bold" if self.bold else "Helvetica"
                    canv.setFont(rl_name, self.font_size)
                    canv.drawString(cursor_x, baseline_y, seg)
                    cursor_x += pdfmetrics.stringWidth(seg, rl_name, self.font_size)
                else:
                    infos, poss, scale, res = _shape_run(seg, script_key, self.bold, self.font_size)
                    tt_font = res["tt_font"]
                    glyph_set = res["glyph_set"]
                    path = canv.beginPath()
                    for info, pos in zip(infos, poss, strict=True):
                        gid = info.codepoint
                        if gid != 0:
                            gname = tt_font.getGlyphName(gid)
                            tx = cursor_x + (pos.x_offset * scale)
                            ty = baseline_y + (pos.y_offset * scale)
                            pen = Qu2CuPen(
                                _ReportLabCubicPen(glyph_set, path, tx, ty, scale),
                                max_err=0.5,
                                all_cubic=True,
                            )
                            glyph_set[gname].draw(pen)
                        cursor_x += pos.x_advance * scale
                        baseline_y += pos.y_advance * scale
                    canv.drawPath(path, stroke=0, fill=1)

        canv.restoreState()


def validate_text_shaping_notdefs(text: str, bold: bool = False) -> int:
    """Diagnostic helper returning total .notdef (gid == 0) glyphs when shaping mixed-script text."""
    notdefs = 0
    for seg, script_key in _segment_script_runs(text, bold):
        if script_key == "latin":
            cmap = _get_font_resource("latin", bold)["cmap"]
            for ch in seg:
                if ord(ch) not in cmap:
                    notdefs += 1
        else:
            infos, _, _, _ = _shape_run(seg, script_key, bold, 10.0)
            for info in infos:
                if info.codepoint == 0:
                    notdefs += 1
    return notdefs


def get_clinic_header(styles: Any, font_regular: str = "PGISans", font_bold: str = "PGISans-Bold", language: str = "en") -> list:
    """Reusable PGI Dental Branch branding header with localized subtitle."""
    _ensure_fonts_registered()
    labels = get_prescription_labels(language)
    reg_fonts = pdfmetrics.getRegisteredFontNames()
    bold_name = font_bold if font_bold in reg_fonts else "Helvetica-Bold"
    reg_name = font_regular if font_regular in reg_fonts else "Helvetica"

    header_elements: list = []
    clinic_title_style = ParagraphStyle(
        "ClinicTitle",
        parent=styles["Heading1"],
        fontSize=15,
        leading=19,
        textColor=colors.HexColor("#0d9488"),
        fontName=bold_name,
        spaceAfter=2,
    )
    clinic_sub_style = ParagraphStyle(
        "ClinicSub",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=11,
        fontName=reg_name,
        textColor=colors.HexColor("#4b5563"),
    )

    header_elements.append(Paragraph(settings.CLINIC_NAME, clinic_title_style))
    if normalize_language(language) != "en":
        header_elements.append(
            ShapedParagraph(
                labels["clinic_subtitle"],
                font_size=9.5,
                bold=True,
                color=colors.HexColor("#0f766e"),
                space_after=2,
            )
        )
    header_elements.append(Paragraph(f"{settings.CLINIC_ADDRESS} | Phone: {settings.CLINIC_PHONE}", clinic_sub_style))
    header_elements.append(Paragraph(f"Email: {settings.CLINIC_EMAIL} | Reg No: {settings.CLINIC_REG_NO}", clinic_sub_style))
    header_elements.append(Spacer(1, 6))
    header_elements.append(
        HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0d9488"), spaceBefore=2, spaceAfter=10)
    )
    return header_elements


def _strip_html(val: str) -> str:
    return re.sub(r"<[^>]+>", "", val)


def generate_prescription_pdf(rx_record: Any, patient: Any, doctor: Any) -> bytes:
    """Generate a PGI Dental Branch prescription PDF with full HarfBuzz EN/HI/PA shaping."""
    _ensure_fonts_registered()
    payload = getattr(rx_record, "payload_json", None) or {}
    language = normalize_language(getattr(rx_record, "language", None) or getattr(patient, "preferred_language", "en"))
    labels = get_prescription_labels(language)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=32,
        bottomMargin=32,
    )

    styles = getSampleStyleSheet()
    story: list = []
    story.extend(get_clinic_header(styles, language=language))

    story.append(
        ShapedParagraph(
            labels["prescription_title"],
            font_size=12,
            bold=True,
            color=colors.HexColor("#0f766e"),
            space_after=6,
        )
    )

    doctor_name = doctor.full_name if doctor else "Dr. In-Charge"
    doctor_spec = doctor.specialization if doctor else "Dental Surgeon"
    doctor_lic = doctor.license_number if doctor else "N/A"
    rx_number = payload.get("prescription_number") or f"RX-{rx_record.id}"
    date_str = rx_record.created_at.strftime("%d-%b-%Y")

    doc_left = (
        f"{labels['prescribing_doctor']}: {doctor_name}\n"
        f"{doctor_spec}\n"
        f"{labels['reg_license']}: {doctor_lic}"
    )
    doc_right = (
        f"{labels['prescription_no']}: {rx_number}\n"
        f"{labels['date']}: {date_str}\n"
        f"{labels['language']}: {language.upper()}"
    )

    t_doc = Table(
        [[
            ShapedParagraph(doc_left, font_size=9, color=colors.HexColor("#1e293b")),
            ShapedParagraph(doc_right, font_size=9, color=colors.HexColor("#1e293b")),
        ]],
        colWidths=[270, 270],
    )
    t_doc.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("PADDING", (0, 0), (-1, -1), 8),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ])
    )
    story.append(t_doc)
    story.append(Spacer(1, 8))

    dob_str = patient.date_of_birth.strftime("%d-%b-%Y") if patient and patient.date_of_birth else "N/A"
    patient_name = patient.full_name if patient else "Patient"
    patient_gender = patient.gender if patient else ""
    patient_cr = (patient.cr_number or patient.patient_code) if patient else "N/A"
    patient_phone = patient.phone if patient else "N/A"

    t_patient = Table(
        [[
            ShapedParagraph(f"{labels['patient']}: {patient_name} ({patient_gender})", font_size=8.8),
            ShapedParagraph(f"{labels['cr_number']}: {patient_cr}", font_size=8.8),
            ShapedParagraph(f"{labels['dob']}: {dob_str}", font_size=8.8),
            ShapedParagraph(f"{labels['phone']}: {patient_phone}", font_size=8.8),
        ]],
        colWidths=[170, 120, 125, 125],
    )
    t_patient.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fdfa")),
            ("PADDING", (0, 0), (-1, -1), 6),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#99f6e4")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
    )
    story.append(t_patient)
    story.append(Spacer(1, 10))

    diagnosis_summary = payload.get("diagnosis_summary")
    if diagnosis_summary:
        story.append(
            ShapedParagraph(
                f"{labels['diagnosis']}: {_strip_html(str(diagnosis_summary))}",
                font_size=9.5,
                bold=True,
                color=colors.HexColor("#0f172a"),
                space_after=8,
            )
        )

    story.append(
        ShapedParagraph(
            labels["medications_heading"],
            font_size=11,
            bold=True,
            color=colors.HexColor("#0f766e"),
            space_after=6,
        )
    )

    med_table_data: list[list[Any]] = [
        [
            ShapedParagraph(labels["col_num"], font_size=8.8, bold=True, color=colors.white),
            ShapedParagraph(labels["col_medicine"], font_size=8.8, bold=True, color=colors.white),
            ShapedParagraph(labels["col_dosage"], font_size=8.8, bold=True, color=colors.white),
            ShapedParagraph(labels["col_frequency"], font_size=8.8, bold=True, color=colors.white),
            ShapedParagraph(labels["col_duration"], font_size=8.8, bold=True, color=colors.white),
            ShapedParagraph(labels["col_instructions"], font_size=8.8, bold=True, color=colors.white),
        ]
    ]

    for idx, item in enumerate(payload.get("medications", []), start=1):
        loc_inst = item.get("localized_instructions") or localize_medication_item(item, language)
        med_table_data.append([
            ShapedParagraph(str(idx), font_size=8.8),
            ShapedParagraph(str(item.get("medicine_name", "")), font_size=8.8, bold=True),
            ShapedParagraph(str(item.get("dosage", "")), font_size=8.8),
            ShapedParagraph(str(item.get("frequency", "")), font_size=8.8),
            ShapedParagraph(str(item.get("duration", "")), font_size=8.8),
            ShapedParagraph(loc_inst, font_size=8.5),
        ])

    t_meds = Table(med_table_data, colWidths=[26, 134, 70, 75, 65, 170])
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
    story.append(Spacer(1, 10))

    general_instructions = payload.get("general_instructions")
    if general_instructions:
        story.append(ShapedParagraph(f"{labels['general_advice']}:", font_size=9.5, bold=True, space_after=2))
        story.append(ShapedParagraph(_strip_html(str(general_instructions)), font_size=9.2, space_after=8))

    treatment_instructions = payload.get("treatment_instructions") or payload.get("localized_summary")
    if treatment_instructions:
        story.append(ShapedParagraph(f"{labels['care_instructions']}:", font_size=9.5, bold=True, space_after=2))
        story.append(ShapedParagraph(_strip_html(str(treatment_instructions)), font_size=9.2, space_after=10))

    story.append(Spacer(1, 18))
    footer_left = f"{labels['valid_note']}\n{labels['keep_safe_note']}"
    footer_right = f"____________________________________\n{doctor_name}\n{labels['signature_label']}"

    t_sig = Table(
        [[
            ShapedParagraph(footer_left, font_size=8.2, color=colors.HexColor("#64748b")),
            ShapedParagraph(footer_right, font_size=8.8, bold=True, color=colors.HexColor("#0f172a"), align=2),
        ]],
        colWidths=[290, 250],
    )
    t_sig.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "BOTTOM"), ("PADDING", (0, 0), (-1, -1), 0)]))
    story.append(t_sig)

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
