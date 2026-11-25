import io
import struct
import zlib
from datetime import date, timedelta

from app.constants import FDI_PERMANENT_TEETH, PHOTO_TYPES
from app.pdf.generator import validate_text_shaping_notdefs


def _make_png() -> bytes:
    def _chunk(ctype: bytes, data: bytes) -> bytes:
        return struct.pack("!I", len(data)) + ctype + data + struct.pack("!I", zlib.crc32(ctype + data) & 0xFFFFFFFF)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = _chunk(b"IHDR", struct.pack("!IIBBBBB", 8, 8, 8, 0, 0, 0, 0))
    idat = _chunk(b"IDAT", zlib.compress(b"\x00" + b"\x90" * 8 * 8))
    iend = _chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


def test_phase3_registration_consent_segregation_and_xrays_datewise(
    client, doctor_token, student1_token, receptionist_token
):
    doc_hdr = {"Authorization": f"Bearer {doctor_token}"}
    s1_hdr = {"Authorization": f"Bearer {student1_token}"}
    rec_hdr = {"Authorization": f"Bearer {receptionist_token}"}

    # 1. Doctor registers a patient using full_name only, assigning student4 (who has doctor_id=None)
    res = client.post(
        "/api/v1/patients",
        json={
            "full_name": "Harpreet Kaur Gill",
            "date_of_birth": "2014-05-10",
            "gender": "Female",
            "phone": "+91 98140 77001",
            "preferred_language": "pa",
            "student_id": 4,
            "disease_categories": ["Pediatric & Preventive", "Dental Caries & Restorative"],
            "case_keywords": ["pediatric", "special_case"],
            "special_case_flag": True,
            "pain_scale": 6,
            "severity_level": "moderate",
        },
        headers=doc_hdr,
    )
    assert res.status_code == 201, res.text
    pat = res.json()
    pid = pat["id"]
    assert pat["first_name"] == "Harpreet"
    assert pat["last_name"] == "Kaur Gill"
    assert pat["student_id"] == 4
    assert pat["preferred_language"] == "pa"
    assert pat["parent_consent_required"] is True
    assert pat["parent_consent_status"] == "pending"

    # 2. Upload & download encrypted CR card
    png_bytes = _make_png()
    card_up = client.post(
        f"/api/v1/patients/{pid}/card",
        data={"cr_number": "PGI-CR-PHASE3-01"},
        files={"file": ("cr_card.png", io.BytesIO(png_bytes), "image/png")},
        headers=doc_hdr,
    )
    assert card_up.status_code == 200, card_up.text
    assert card_up.json()["cr_number"] == "PGI-CR-PHASE3-01"
    assert card_up.json()["card_doc_id"] is not None

    card_dl = client.get(f"/api/v1/patients/{pid}/card", headers=doc_hdr)
    assert card_dl.status_code == 200
    assert card_dl.content == png_bytes
    assert client.get(f"/api/v1/patients/{pid}/card", headers=s1_hdr).status_code == 403
    assert client.get(f"/api/v1/patients/{pid}/card", headers=rec_hdr).status_code == 403

    # 3. Upload & download encrypted parent consent
    consent_up = client.post(
        f"/api/v1/patients/{pid}/consent",
        data={
            "parent_guardian_name": "Baljit Singh Gill",
            "parent_guardian_phone": "+91 98140 77009",
        },
        files={"file": ("consent.png", io.BytesIO(png_bytes), "image/png")},
        headers=doc_hdr,
    )
    assert consent_up.status_code == 200, consent_up.text
    c_body = consent_up.json()
    assert c_body["parent_consent_status"] == "signed"
    assert c_body["parent_consent_doc_id"] is not None
    assert c_body["parent_guardian_name"] == "Baljit Singh Gill"

    consent_dl = client.get(f"/api/v1/patients/{pid}/consent", headers=doc_hdr)
    assert consent_dl.status_code == 200
    assert consent_dl.content == png_bytes
    assert client.get(f"/api/v1/patients/{pid}/consent", headers=s1_hdr).status_code == 403
    assert client.get(f"/api/v1/patients/{pid}/consent", headers=rec_hdr).status_code == 403

    # 4. Segregation filters: categories, keyword, age_group, special_case, severity, scope
    f_cat = client.get(
        "/api/v1/patients?categories=Pediatric+%26+Preventive,Trauma+%26+Emergency",
        headers=doc_hdr,
    )
    assert f_cat.status_code == 200
    assert any(p["id"] == pid for p in f_cat.json()["items"])

    f_kw = client.get("/api/v1/patients?keyword=PGI-CR-PHASE3-01", headers=doc_hdr)
    assert f_kw.status_code == 200
    assert any(p["id"] == pid for p in f_kw.json()["items"])

    f_age = client.get("/api/v1/patients?age_group=pediatric&special_case=true", headers=doc_hdr)
    assert f_age.status_code == 200
    assert all(p["age"] < 18 and p["special_case_flag"] is True for p in f_age.json()["items"])

    f_ger = client.get("/api/v1/patients?age_group=geriatric", headers=doc_hdr)
    assert f_ger.status_code == 200
    assert all(p["age"] >= 60 for p in f_ger.json()["items"])

    f_sev = client.get("/api/v1/patients?severity=critical", headers=doc_hdr)
    assert f_sev.status_code == 200
    assert all(p["severity_level"] == "critical" for p in f_sev.json()["items"])

    f_mine = client.get("/api/v1/patients?scope=mine", headers=doc_hdr)
    assert f_mine.status_code == 200
    assert f_mine.json()["total"] <= f_cat.json()["total"] + 16

    # Student 1 cannot bypass isolation via scope=all
    s1_list = client.get("/api/v1/patients?scope=all", headers=s1_hdr)
    assert s1_list.status_code == 200
    assert all(p["student_id"] == 1 for p in s1_list.json()["items"])

    # 5. Date-wise X-rays endpoint returns document_type
    x_res = client.get("/api/v1/patients/1/xrays-datewise", headers=doc_hdr)
    assert x_res.status_code == 200
    x_items = x_res.json()
    assert len(x_items) >= 1
    assert "document_type" in x_items[0]
    assert x_items[0]["xray_type"] == "OPG"


def test_phase3_patient_tracker_enquiries_convert_and_slipping(
    client, doctor_token, student1_token, receptionist_token, patient_token
):
    doc_hdr = {"Authorization": f"Bearer {doctor_token}"}
    s1_hdr = {"Authorization": f"Bearer {student1_token}"}

    # Receptionist and Patient blocked with 403
    for tok in (receptionist_token, patient_token):
        hdr = {"Authorization": f"Bearer {tok}"}
        assert client.get("/api/v1/tracker/overview", headers=hdr).status_code == 403
        assert client.get("/api/v1/tracker/enquiries", headers=hdr).status_code == 403
        assert client.get("/api/v1/tracker/slipping", headers=hdr).status_code == 403

    # Overview & Slipping
    ov = client.get("/api/v1/tracker/overview", headers=doc_hdr)
    assert ov.status_code == 200
    assert "stage_counts" in ov.json()
    assert set(ov.json()["stages"].keys()) == {
        "enquiry", "registered", "diagnosed", "in_treatment", "followup", "slipping", "completed"
    }

    slip = client.get("/api/v1/tracker/slipping", headers=doc_hdr)
    assert slip.status_code == 200
    slip_body = slip.json()
    assert len(slip_body["slipping_patients"]) >= 2
    assert len(slip_body["stale_enquiries"]) >= 1

    # Log enquiry by Student 1 -> auto-assigned to Student 1
    enq_res = client.post(
        "/api/v1/tracker/enquiries",
        json={
            "caller_name": "Karanveer Singh",
            "phone": "+91 98760 12345",
            "source_channel": "phone_enquiry",
            "preferred_language": "pa",
            "chief_complaint": "Toothache in lower molar",
            "follow_up_date": (date.today() + timedelta(days=1)).isoformat(),
        },
        headers=s1_hdr,
    )
    assert enq_res.status_code == 201, enq_res.text
    enq_id = enq_res.json()["id"]
    assert enq_res.json()["assigned_student_id"] == 1

    # Update enquiry
    upd = client.patch(
        f"/api/v1/tracker/enquiries/{enq_id}",
        json={"status": "contacted", "notes": "Confirmed morning OPD visit"},
        headers=s1_hdr,
    )
    assert upd.status_code == 200
    assert upd.json()["status"] == "contacted"

    # Convert enquiry to real Patient record
    conv = client.post(f"/api/v1/tracker/enquiries/{enq_id}/convert", headers=s1_hdr)
    assert conv.status_code == 201, conv.text
    conv_body = conv.json()
    assert conv_body["enquiry"]["status"] == "converted"
    assert conv_body["enquiry"]["patient_id"] == conv_body["patient"]["id"]
    assert conv_body["patient"]["student_id"] == 1
    assert conv_body["patient"]["full_name"] == "Karanveer Singh"


def test_phase4_visits_perio_surgical_misc_notices_and_media(
    client, doctor_token, student1_token, receptionist_token, patient_token
):
    doc_hdr = {"Authorization": f"Bearer {doctor_token}"}
    s1_hdr = {"Authorization": f"Bearer {student1_token}"}
    rec_hdr = {"Authorization": f"Bearer {receptionist_token}"}
    pat_hdr = {"Authorization": f"Bearer {patient_token}"}

    # 1. Visit saves General + Intraoral exam and syncs patient pain_scale / severity_level
    v_res = client.post(
        "/api/v1/visits",
        json={
            "patient_id": 1,
            "visit_date": date.today().isoformat(),
            "general_exam_notes": "Afebrile, alert",
            "extraoral_findings": "No facial swelling",
            "tmj_status": "Normal bilateral",
            "lymph_nodes": "Non-palpable",
            "intraoral_hard_tissue": "Root canal treated 16",
            "intraoral_soft_tissue": "Healthy attached gingiva",
            "occlusion_status": "Class I",
            "diagnosis": "Post-endodontic review",
            "pain_scale": 2,
            "severity_level": "mild",
        },
        headers=doc_hdr,
    )
    assert v_res.status_code == 201, v_res.text
    pat_after = client.get("/api/v1/patients/1", headers=doc_hdr).json()
    assert pat_after["pain_scale"] == 2
    assert pat_after["severity_level"] == "mild"

    # 2. Perio chart 32 teeth + 6 sites + summary + snapshots
    perio_teeth = {}
    for idx, t in enumerate(sorted(FDI_PERMANENT_TEETH)):
        depth = 6 if idx == 0 else (4 if idx == 1 else 2)
        perio_teeth[str(t)] = {
            "probing_depths": {"mb": depth, "b": 2, "db": depth, "ml": 2, "l": 2, "dl": 2},
            "recession": {"mb": 1, "b": 0, "db": 1, "ml": 0, "l": 0, "dl": 0},
            "bop": {"mb": idx < 2, "b": False, "db": idx == 0, "ml": False, "l": False, "dl": False},
            "mobility": 1 if idx == 0 else 0,
            "furcation": 1 if idx == 0 else 0,
            "notes": "Baseline charting",
        }
    p_put = client.put(
        "/api/v1/dental-chart/1/perio",
        json={"teeth": perio_teeth, "plaque_index": "Good (18%)", "notes": "Full 32-tooth chart"},
        headers=doc_hdr,
    )
    assert p_put.status_code == 200, p_put.text
    p_data = p_put.json()
    assert len(p_data["teeth"]) == 32
    assert p_data["summary"]["deepest_pocket"] == 6
    assert p_data["summary"]["sites_ge_4mm"] == 4
    assert p_data["summary"]["sites_ge_6mm"] == 2
    assert p_data["summary"]["bop_percentage"] > 0
    assert len(p_data["snapshots"]) >= 1

    # Unassigned student gets 403 on patient 6 perio
    assert client.get("/api/v1/dental-chart/6/perio", headers=s1_hdr).status_code == 403

    # 3. Upload all 6 photo types + stage/category filtering + Doctor-only share toggle
    png_bytes = _make_png()
    uploaded_ids = []
    for ptype in PHOTO_TYPES:
        up = client.post(
            "/api/v1/documents/upload",
            data={
                "patient_id": "1",
                "document_type": ptype,
                "title": f"Test {ptype}",
                "disease_category": "Endodontics (RCT & Pulpitis)",
                "treatment_stage": "surgery" if ptype == "surgery_photo" else "mid_treatment",
                "media_date": date.today().isoformat(),
                "is_shared_with_patient": "false",
            },
            files={"file": (f"{ptype}.png", io.BytesIO(png_bytes), "image/png")},
            headers=doc_hdr,
        )
        assert up.status_code == 201, up.text
        uploaded_ids.append(up.json()["id"])

    filtered_docs = client.get(
        "/api/v1/documents?document_type=surgery_photo&treatment_stage=surgery",
        headers=doc_hdr,
    )
    assert filtered_docs.status_code == 200
    assert len(filtered_docs.json()) >= 1

    # Student & Patient cannot toggle share (403); Doctor can
    target_doc_id = uploaded_ids[0]
    assert client.patch(f"/api/v1/documents/{target_doc_id}/share", json={"is_shared_with_patient": True}, headers=s1_hdr).status_code == 403
    assert client.patch(f"/api/v1/documents/{target_doc_id}/share", json={"is_shared_with_patient": True}, headers=pat_hdr).status_code == 403
    sh = client.patch(f"/api/v1/documents/{target_doc_id}/share", json={"is_shared_with_patient": True}, headers=doc_hdr)
    assert sh.status_code == 200 and sh.json()["is_shared_with_patient"] is True

    # 4. Surgical logs CRUD + auto post-treatment notification
    before_logs = len(client.get("/api/v1/notifications/logs?patient_id=1", headers=doc_hdr).json())
    s_create = client.post(
        "/api/v1/patients/1/surgical-logs",
        json={
            "procedure_name": "Surgical Extraction / Impaction",
            "tooth_numbers": [18],
            "surgeon_name": "Dr. Anjali Sharma",
            "anesthesia_type": "PSA Nerve Block",
            "operative_notes": "Atraumatic elevation",
            "post_op_instructions": "Ice pack 24 hours",
            "suture_removal_date": (date.today() + timedelta(days=7)).isoformat(),
            "linked_document_ids": [uploaded_ids[-2]],
        },
        headers=doc_hdr,
    )
    assert s_create.status_code == 201, s_create.text
    slog = s_create.json()
    assert slog["is_visible_to_patient"] is False
    assert slog["linked_document_ids"] == [uploaded_ids[-2]]

    after_logs = len(client.get("/api/v1/notifications/logs?patient_id=1", headers=doc_hdr).json())
    assert after_logs > before_logs

    s_upd = client.put(
        f"/api/v1/patients/1/surgical-logs/{slog['id']}",
        json={"operative_notes": "Updated operative notes"},
        headers=doc_hdr,
    )
    assert s_upd.status_code == 200
    assert s_upd.json()["operative_notes"] == "Updated operative notes"
    assert client.delete(f"/api/v1/patients/1/surgical-logs/{slog['id']}", headers=doc_hdr).status_code == 200
    assert client.get("/api/v1/patients/1/surgical-logs", headers=pat_hdr).status_code == 403
    assert client.get("/api/v1/patients/1/surgical-logs", headers=rec_hdr).status_code == 403

    # 5. Miscellaneous & Shared Notices
    m_put = client.put(
        "/api/v1/patients/1/miscellaneous",
        json={"category": "Prosthodontics & Implants", "notes": "Shade A2 selected"},
        headers=doc_hdr,
    )
    assert m_put.status_code == 200
    assert m_put.json()["records"]["Prosthodontics & Implants"] == "Shade A2 selected"

    n_post = client.post(
        "/api/v1/patients/1/shared-notices",
        json={"category": "scan_request", "title": "Bring CBCT", "message": "Conduct CBCT Maxilla and bring CD."},
        headers=doc_hdr,
    )
    assert n_post.status_code == 201
    nid = n_post.json()["id"]
    assert client.post(
        "/api/v1/patients/1/shared-notices",
        json={"category": "scan_request", "title": "Fail", "message": "Student blocked"},
        headers=s1_hdr,
    ).status_code == 403
    assert client.delete(f"/api/v1/patients/1/shared-notices/{nid}", headers=doc_hdr).status_code == 200


def test_phase4_multilingual_prescriptions_instructions_and_harfbuzz_pdfs(
    client, doctor_token
):
    doc_hdr = {"Authorization": f"Bearer {doctor_token}"}

    # 1. Create custom Rx template
    tpl_res = client.post(
        "/api/v1/prescriptions/templates",
        json={
            "template_name": "Post-Implant Care",
            "diagnosis_summary": "Implant placement",
            "general_instructions": "Soft diet for 7 days",
            "language": "en",
            "medications": [
                {
                    "medicine_name": "Augmentin 625mg",
                    "dosage": "625 mg",
                    "frequency": "1-0-1",
                    "duration": "5 days",
                    "timing": "After Food",
                }
            ],
        },
        headers=doc_hdr,
    )
    assert tpl_res.status_code == 201, tpl_res.text

    # 2. Instructions Library EN/HI/PA
    for lang in ("en", "hi", "pa"):
        lib = client.get(f"/api/v1/prescriptions/instructions-library?language={lang}", headers=doc_hdr)
        assert lib.status_code == 200
        body = lib.json()
        assert len(body["pre_appointment"]) >= 4
        assert len(body["post_treatment"]) >= 4

    # 3. Send localized instruction
    send_res = client.post(
        "/api/v1/prescriptions/instructions/send",
        json={
            "patient_id": 2,
            "instruction_key": "post_rct",
            "language": "hi",
            "category": "post_treatment",
        },
        headers=doc_hdr,
    )
    assert send_res.status_code == 200, send_res.text
    assert send_res.json()["language"] == "hi"
    assert send_res.json()["status"] == "sent_sandbox"

    # 4. Generate Hindi & Punjabi Prescriptions + HarfBuzz PDFs
    for lang, diag, advice in [
        ("hi", "दंत क्षय एवं मसूड़ों की सूजन", "कृपया सभी दवाएं भोजन के बाद लें। ठंडा व नरम भोजन करें।"),
        ("pa", "ਦੰਦਾਂ ਵਿੱਚ ਦਰਦ ਅਤੇ ਮਸੂੜਿਆਂ ਦੀ ਸੋਜ", "ਕਿਰਪਾ ਕਰਕੇ ਸਾਰੀਆਂ ਦਵਾਈਆਂ ਭੋਜਨ ਤੋਂ ਬਾਅਦ ਲਓ। ਨਰਮ ਭੋਜਨ ਖਾਓ।"),
    ]:
        assert validate_text_shaping_notdefs(diag) == 0
        assert validate_text_shaping_notdefs(advice) == 0

        rx_res = client.post(
            "/api/v1/prescriptions",
            json={
                "patient_id": 2 if lang == "hi" else 3,
                "language": lang,
                "diagnosis_summary": diag,
                "general_instructions": advice,
                "treatment_instructions": advice,
                "items": [
                    {
                        "medicine_name": "Amoxicillin 500mg",
                        "dosage": "500 mg",
                        "frequency": "1-0-1",
                        "duration": "5 days",
                        "timing": "After Food",
                    }
                ],
            },
            headers=doc_hdr,
        )
        assert rx_res.status_code == 201, rx_res.text
        rx_body = rx_res.json()
        assert rx_body["language"] == lang
        assert rx_body["localized_summary"] is not None
        assert rx_body["items"][0]["localized_instructions"] is not None

        pdf_res = client.get(f"/api/v1/prescriptions/{rx_body['id']}/pdf", headers=doc_hdr)
        assert pdf_res.status_code == 200
        assert pdf_res.headers["content-type"] == "application/pdf"
        assert pdf_res.content.startswith(b"%PDF")
        assert len(pdf_res.content) > 10000

    # 5. Completing a treatment item triggers post-treatment instruction alert
    plan = client.post(
        "/api/v1/treatments/plans",
        json={
            "patient_id": 2,
            "title": "Extraction Plan",
            "treatments": [{"procedure_name": "Simple Tooth Extraction", "tooth_number": 46}],
        },
        headers=doc_hdr,
    )
    assert plan.status_code == 201
    item_id = plan.json()["treatments"][0]["id"]
    before_cnt = len(client.get("/api/v1/notifications/logs?patient_id=2", headers=doc_hdr).json())
    upd_item = client.put(
        f"/api/v1/treatments/items/{item_id}",
        json={"status": "completed", "notes": "Completed cleanly"},
        headers=doc_hdr,
    )
    assert upd_item.status_code == 200
    after_cnt = len(client.get("/api/v1/notifications/logs?patient_id=2", headers=doc_hdr).json())
    assert after_cnt > before_cnt


def test_phase5_calendar_ics_notifications_recalls_preventive_and_social(
    client, doctor_token, student1_token, receptionist_token, patient_token
):
    doc_hdr = {"Authorization": f"Bearer {doctor_token}"}
    s1_hdr = {"Authorization": f"Bearer {student1_token}"}
    rec_hdr = {"Authorization": f"Bearer {receptionist_token}"}
    pat_hdr = {"Authorization": f"Bearer {patient_token}"}

    # 1. Smart Calendar (doctor & operatory views, day & week) + student scoping
    cal_doc = client.get(f"/api/v1/appointments/calendar?date={date.today().isoformat()}&view=doctor&range=week", headers=doc_hdr)
    assert cal_doc.status_code == 200
    cal_body = cal_doc.json()
    assert len(cal_body["doctors"]) >= 3
    assert len(cal_body["operatories"]) >= 5
    assert "appointments" in cal_body

    cal_stu = client.get(f"/api/v1/appointments/calendar?date={date.today().isoformat()}&view=operatory&range=day", headers=s1_hdr)
    assert cal_stu.status_code == 200
    for appt in cal_stu.json()["appointments"]:
        assert appt["student_id"] == 1 or appt["patient_id"] in {1, 2, 3, 4, 5}

    assert client.get(f"/api/v1/appointments/calendar?date={date.today().isoformat()}", headers=rec_hdr).status_code == 403

    # 2. Booking appointment triggers notification + populates Google Calendar URL & .ics download
    target_dt = (date.today() + timedelta(days=12)).isoformat()
    appt_res = client.post(
        "/api/v1/appointments",
        json={
            "patient_id": 1,
            "doctor_id": 1,
            "operatory": "Operatory 1",
            "appointment_type": "Surgical Extraction",
            "appointment_date": target_dt,
            "start_time": "11:00:00",
            "end_time": "11:30:00",
        },
        headers=doc_hdr,
    )
    assert appt_res.status_code == 201, appt_res.text
    appt = appt_res.json()
    assert appt["google_calendar_url"].startswith("https://calendar.google.com/calendar/render")
    assert appt["ics_url"] == f"/api/v1/appointments/{appt['id']}/ics"

    ics_res = client.get(appt["ics_url"], headers=pat_hdr)
    assert ics_res.status_code == 200
    assert "text/calendar" in ics_res.headers["content-type"]
    assert "BEGIN:VCALENDAR" in ics_res.text and "BEGIN:VEVENT" in ics_res.text

    # Unassigned student and receptionist get 403 on Patient 1's .ics
    assert client.get(appt["ics_url"], headers=rec_hdr).status_code == 403

    # 3. Notification settings (SMS Sender ID) & sandbox send
    put_set = client.put(
        "/api/v1/notifications/settings",
        json={"sms_sender_id": "PGICHD", "sms_provider": "sandbox"},
        headers=doc_hdr,
    )
    assert put_set.status_code == 200
    assert put_set.json()["sms_sender_id"] == "PGICHD"

    send_notif = client.post(
        "/api/v1/notifications/send",
        json={
            "patient_id": 3,
            "channel": "sms",
            "language": "pa",
            "title": "Test Alert",
            "message_body": "ਕਿਰਪਾ ਕਰਕੇ ਸਮੇਂ ਸਿਰ ਪਹੁੰਚੋ।",
        },
        headers=doc_hdr,
    )
    assert send_notif.status_code == 201
    assert send_notif.json()["status"] == "sent_sandbox"
    assert send_notif.json()["sender_id"] == "PGICHD"

    # 4. Missed appointment with send_recall=True
    miss = client.post(
        "/api/v1/appointments/missed",
        json={"patient_id": 4, "reason": "No show", "send_recall": True},
        headers=doc_hdr,
    )
    assert miss.status_code == 201
    assert miss.json()["is_missed"] is True

    # 5. Automatic Recalls generation & dispatch
    gen = client.post("/api/v1/notifications/recalls/generate", headers=doc_hdr)
    assert gen.status_code == 200
    assert gen.json()["generated_count"] > 0

    disp = client.post(
        "/api/v1/notifications/recalls/dispatch-due",
        json={"include_upcoming": True},
        headers=doc_hdr,
    )
    assert disp.status_code == 200
    assert disp.json()["dispatched_count"] > 0

    # 6. Preventive care preview & send (diabetic + tobacco Punjabi patient 3, pediatric patient 14)
    prev_p3 = client.get("/api/v1/notifications/preventive-care/preview/3?language=pa", headers=doc_hdr)
    assert prev_p3.status_code == 200
    rule_keys_p3 = {r["rule_key"] for r in prev_p3.json()["matched_rules"]}
    assert "diabetic_gum_care" in rule_keys_p3
    assert "tobacco_cessation" in rule_keys_p3

    prev_p14 = client.get("/api/v1/notifications/preventive-care/preview/14?language=hi", headers=doc_hdr)
    assert prev_p14.status_code == 200
    assert any(r["rule_key"] == "pediatric_hygiene" for r in prev_p14.json()["matched_rules"])

    prev_send = client.post(
        "/api/v1/notifications/preventive-care/send",
        json={"patient_id": 3, "language": "pa", "channel": "sms"},
        headers=doc_hdr,
    )
    assert prev_send.status_code == 201
    assert prev_send.json()["status"] == "sent_sandbox"

    # 7. Social settings, webhook lead capture & WhatsApp link
    soc_put = client.put(
        "/api/v1/integrations/social-settings",
        json={"whatsapp_number": "+919876500001", "instagram_url": "https://instagram.com/pgi_test"},
        headers=doc_hdr,
    )
    assert soc_put.status_code == 200
    assert soc_put.json()["whatsapp_number"] == "+919876500001"

    # Webhook lead via X-Webhook-Token
    lead_res = client.post(
        "/api/v1/integrations/social-lead",
        json={
            "caller_name": "Instagram Lead User",
            "phone": "+91 98111 22334",
            "source_channel": "instagram",
            "chief_complaint": "Braces enquiry",
            "preferred_language": "en",
        },
        headers={"X-Webhook-Token": "pgi-social-webhook"},
    )
    assert lead_res.status_code == 201, lead_res.text

    wa = client.get("/api/v1/integrations/whatsapp-link/3?kind=preventive&language=pa", headers=doc_hdr)
    assert wa.status_code == 200
    assert wa.json()["whatsapp_url"].startswith("https://wa.me/91")

    # 8. Receptionist blocked on notifications & integrations
    assert client.get("/api/v1/notifications/settings", headers=rec_hdr).status_code == 403
    assert client.get("/api/v1/notifications/logs", headers=rec_hdr).status_code == 403
    assert client.get("/api/v1/notifications/recalls", headers=rec_hdr).status_code == 403
    assert client.get("/api/v1/integrations/whatsapp-link/1", headers=rec_hdr).status_code == 403
