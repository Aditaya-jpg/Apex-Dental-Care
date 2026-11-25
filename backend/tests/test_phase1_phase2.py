import hashlib
import io
import struct
import zlib
from datetime import date

from sqlalchemy import text

from app.database import Base
from app.models.patient import Patient
from app.storage.file_storage import file_storage


def _make_large_png(payload_bytes: int = 1_200_000) -> bytes:
    """Build a valid PNG exceeding 1 MB to exercise multi-chunk AES-256-GCM streaming."""
    sig = b"\x89PNG\r\n\x1a\n"

    def _chunk(ctype: bytes, data: bytes) -> bytes:
        return struct.pack("!I", len(data)) + ctype + data + struct.pack("!I", zlib.crc32(ctype + data) & 0xFFFFFFFF)

    ihdr = _chunk(b"IHDR", struct.pack("!IIBBBBB", 16, 16, 8, 0, 0, 0, 0))
    idat = _chunk(b"IDAT", zlib.compress(b"\x00" + b"\x7f" * 16 * 16))
    # Valid ancillary PNG text chunk carrying >1MB to test chunked encryption/decryption
    pad = _chunk(b"tEXt", b"Comment\x00" + (b"PGI_CBCT_PAD_" * (payload_bytes // 13 + 1)))
    iend = _chunk(b"IEND", b"")
    return sig + ihdr + idat + pad + iend


def test_strictly_8_tables_and_sqlite_foreign_keys(db_session):
    assert sorted(Base.metadata.tables.keys()) == [
        "appointments",
        "care_and_system_logs",
        "clinical_records",
        "doctors",
        "documents",
        "patients",
        "students",
        "users",
    ]
    fk_state = db_session.execute(text("PRAGMA foreign_keys")).scalar()
    assert fk_state == 1


def test_no_billing_or_reports_endpoints(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    assert client.get("/api/v1/billing/invoices", headers=headers).status_code == 404
    assert client.get("/api/v1/billing", headers=headers).status_code == 404
    assert client.get("/api/v1/reports", headers=headers).status_code == 404


def test_aes256_gcm_chunked_vault_cbct_and_magic_validation(client, doctor_token, student1_token, receptionist_token, patient_token):
    headers_doc = {"Authorization": f"Bearer {doctor_token}"}

    # 1. Upload >1MB multi-chunk PNG
    large_png = _make_large_png(1_150_000)
    expected_sha = hashlib.sha256(large_png).hexdigest()
    up_res = client.post(
        "/api/v1/documents/upload",
        data={"patient_id": "1", "document_type": "opg", "title": "Multi-chunk OPG"},
        files={"file": ("multi_opg.png", io.BytesIO(large_png), "image/png")},
        headers=headers_doc,
    )
    assert up_res.status_code == 201, up_res.text
    doc_data = up_res.json()
    assert doc_data["is_encrypted"] is True
    assert doc_data["sha256_checksum"] == expected_sha
    assert doc_data["storage_key"].startswith("1/") and doc_data["storage_key"].endswith(".enc")

    # Verify disk bytes are encrypted (PGIV1 header, no plaintext PNG signature)
    disk_path = file_storage._resolve_key_path(doc_data["storage_key"])
    raw_disk = disk_path.read_bytes()
    assert raw_disk.startswith(b"PGIV1")
    assert b"\x89PNG" not in raw_disk[:64]

    # Verify authorized download decrypts byte-for-byte
    dl_res = client.get(f"/api/v1/documents/{doc_data['id']}/download", headers=headers_doc)
    assert dl_res.status_code == 200
    assert dl_res.content == large_png

    # 2. Raw CBCT (.dcm and .nii.gz) accepted
    dcm_bytes = (b"\x00" * 128) + b"DICM" + (b"\x01\x02" * 64)
    dcm_res = client.post(
        "/api/v1/documents/upload",
        data={"patient_id": "1", "document_type": "cbct", "title": "Raw DICOM CBCT"},
        files={"file": ("mandible_cbct.dcm", io.BytesIO(dcm_bytes), "application/octet-stream")},
        headers=headers_doc,
    )
    assert dcm_res.status_code == 201, dcm_res.text

    niigz_bytes = b"\x1f\x8b\x08\x00" + b"\x00" * 100
    nii_res = client.post(
        "/api/v1/documents/upload",
        data={"patient_id": "1", "document_type": "cbct", "title": "Raw NIfTI Volume"},
        files={"file": ("volume.nii.gz", io.BytesIO(niigz_bytes), "application/gzip")},
        headers=headers_doc,
    )
    assert nii_res.status_code == 201, nii_res.text

    # 3. Dangerous extensions and spoofed magic bytes rejected
    for bad_name, bad_content in [
        ("malware.exe", b"MZ\x90\x00"),
        ("xss.html", b"<!DOCTYPE html><script>alert(1)</script>"),
        ("payload.js", b"alert(1);"),
        ("vector.svg", b"<svg onload=alert(1)>"),
        ("script.sh", b"#!/bin/sh\nrm -rf /"),
        ("shell.php", b"<?php system($_GET['c']); ?>"),
        ("spoofed.png", b"<!DOCTYPE html><html>not a png</html>"),
    ]:
        bad_res = client.post(
            "/api/v1/documents/upload",
            data={"patient_id": "1", "document_type": "xray"},
            files={"file": (bad_name, io.BytesIO(bad_content), "image/png")},
            headers=headers_doc,
        )
        assert bad_res.status_code == 400, f"Expected 400 for {bad_name}, got {bad_res.status_code}"

    # 4. IDOR tests on seeded documents
    # Student 1's docs vs Patient 6 (Student 2)
    p6_docs = client.get("/api/v1/documents/patient/6", headers=headers_doc).json()
    assert len(p6_docs) >= 1
    p6_doc_id = p6_docs[0]["id"]

    assert client.get(f"/api/v1/documents/{p6_doc_id}/download", headers={"Authorization": f"Bearer {student1_token}"}).status_code == 403
    assert client.get(f"/api/v1/documents/{p6_doc_id}/download", headers={"Authorization": f"Bearer {receptionist_token}"}).status_code == 403

    # Patient 1 can download shared OPG (doc 1) but gets 403 on unshared surgery photo (doc 2)
    p1_docs = client.get("/api/v1/documents/patient/1", headers=headers_doc).json()
    shared_doc = next(d for d in p1_docs if d["document_type"] == "opg" and d["is_shared_with_patient"])
    unshared_doc = next(d for d in p1_docs if d["document_type"] == "surgery_photo" and not d["is_shared_with_patient"])

    assert client.get(f"/api/v1/documents/{shared_doc['id']}/download", headers={"Authorization": f"Bearer {patient_token}"}).status_code == 200
    assert client.get(f"/api/v1/documents/{unshared_doc['id']}/download", headers={"Authorization": f"Bearer {patient_token}"}).status_code == 403


def test_doctor_branch_wide_visibility_and_admin_doctor(client, doctor_token, admin_doctor_token, admin_token):
    # Non-admin doctor sees ALL 16 patients across branch (Student 1, Student 2, Doctor 1, unassigned)
    res = client.get("/api/v1/patients", headers={"Authorization": f"Bearer {doctor_token}"})
    assert res.status_code == 200
    assert res.json()["total"] >= 16

    for pid in (1, 6, 11, 14, 16):
        assert client.get(f"/api/v1/patients/{pid}", headers={"Authorization": f"Bearer {doctor_token}"}).status_code == 200

    # Non-admin doctor cannot access admin-only endpoints
    assert client.get("/api/v1/users", headers={"Authorization": f"Bearer {doctor_token}"}).status_code == 403
    assert client.get("/api/v1/dashboard/admin", headers={"Authorization": f"Bearer {doctor_token}"}).status_code == 403

    # Designated admin doctor (dr.mehta@pgi.edu.in is_admin=True) CAN access admin endpoints
    assert client.get("/api/v1/users", headers={"Authorization": f"Bearer {admin_doctor_token}"}).status_code == 200
    assert client.get("/api/v1/dashboard/admin", headers={"Authorization": f"Bearer {admin_doctor_token}"}).status_code == 200
    assert client.get("/api/v1/audit-logs", headers={"Authorization": f"Bearer {admin_doctor_token}"}).status_code == 200

    # Admin updates doctor operatory & is_admin
    upd = client.patch(
        "/api/v1/doctors/2",
        json={"cabin_operatory": "Operatory 5 (Pediatric)", "is_admin": True},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert upd.status_code == 200
    assert upd.json()["cabin_operatory"] == "Operatory 5 (Pediatric)"
    assert upd.json()["is_admin"] is True


def test_student_flexible_pool_isolation_and_instant_revocation(client, db_session, admin_token, student1_token):
    # 1. Student 1 isolation: sees ONLY their 5 assigned patients, gets 403 on Patient 6 & 14
    stu_hdr = {"Authorization": f"Bearer {student1_token}"}
    list_res = client.get("/api/v1/patients", headers=stu_hdr)
    assert list_res.status_code == 200
    assert list_res.json()["total"] == 5

    for forbidden_pid in (6, 11, 14):
        assert client.get(f"/api/v1/patients/{forbidden_pid}", headers=stu_hdr).status_code == 403
        assert client.get(f"/api/v1/visits/patient/{forbidden_pid}", headers=stu_hdr).status_code == 403
        assert client.get(f"/api/v1/dental-chart/{forbidden_pid}", headers=stu_hdr).status_code == 403
        assert client.get(f"/api/v1/treatments/plans?patient_id={forbidden_pid}", headers=stu_hdr).status_code == 403
        assert client.get(f"/api/v1/prescriptions?patient_id={forbidden_pid}", headers=stu_hdr).status_code == 403
        assert client.get(f"/api/v1/documents/patient/{forbidden_pid}", headers=stu_hdr).status_code == 403
        assert client.get(f"/api/v1/xrays/patient/{forbidden_pid}", headers=stu_hdr).status_code == 403
        assert client.get(f"/api/v1/followups?patient_id={forbidden_pid}", headers=stu_hdr).status_code == 403

    # 2. Create student without mandatory doctor_id (doctor_id=None)
    adm_hdr = {"Authorization": f"Bearer {admin_token}"}
    create_res = client.post(
        "/api/v1/students",
        json={
            "full_name": "Temp Intern",
            "email": "temp.intern@pgi.edu.in",
            "password": "TempPass@123",
            "roll_number": "PGI-TEMP-99",
            "doctor_id": None,
        },
        headers=adm_hdr,
    )
    assert create_res.status_code == 201, create_res.text
    assert create_res.json()["id"] > 0
    assert create_res.json()["doctor_id"] is None

    # Login as temp intern & verify active access
    temp_login = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "temp.intern@pgi.edu.in", "password": "TempPass@123"},
    )
    assert temp_login.status_code == 200
    temp_jwt = temp_login.json()["access_token"]
    temp_refresh = temp_login.json()["refresh_token"]
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {temp_jwt}"}).status_code == 200

    # Delete temp student by email -> immediate 401 TOKEN_REVOKED on existing JWT, login & refresh rejected
    del_email_res = client.delete("/api/v1/students/by-email/temp.intern@pgi.edu.in", headers=adm_hdr)
    assert del_email_res.status_code == 200

    revoked_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {temp_jwt}"})
    assert revoked_me.status_code == 401
    assert revoked_me.json()["error"]["code"] == "TOKEN_REVOKED"

    assert client.post("/api/v1/auth/refresh", json={"refresh_token": temp_refresh}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"username_or_email": "temp.intern@pgi.edu.in", "password": "TempPass@123"}).status_code == 401

    # 3. Revoke Student 1 via DELETE /students/{id} -> unassigns patients, preserves records, 401 on Student 1 JWT
    assert db_session.query(Patient).filter(Patient.student_id == 1).count() == 5
    del_s1 = client.delete("/api/v1/students/1", headers=adm_hdr)
    assert del_s1.status_code == 200

    # Previously assigned patient records stay intact with student_id=None
    db_session.expire_all()
    p1 = db_session.query(Patient).filter(Patient.id == 1).first()
    assert p1 is not None and p1.student_id is None and p1.is_deleted is False

    # Student 1's valid JWT immediately fails with 401 TOKEN_REVOKED
    s1_check = client.get("/api/v1/patients", headers=stu_hdr)
    assert s1_check.status_code == 401
    assert s1_check.json()["error"]["code"] == "TOKEN_REVOKED"


def test_student_revoke_endpoint(client, db_session, admin_token, student2_token):
    s2_hdr = {"Authorization": f"Bearer {student2_token}"}
    assert client.get("/api/v1/patients", headers=s2_hdr).status_code == 200

    rev_res = client.post("/api/v1/students/2/revoke", headers={"Authorization": f"Bearer {admin_token}"})
    assert rev_res.status_code == 200

    check = client.get("/api/v1/patients", headers=s2_hdr)
    assert check.status_code == 401
    assert check.json()["error"]["code"] == "TOKEN_REVOKED"


def test_receptionist_attendance_only(client, receptionist_token):
    hdr = {"Authorization": f"Bearer {receptionist_token}"}

    # Attendance endpoints work cleanly and expose zero clinical notes
    today_res = client.get(f"/api/v1/attendance/today?date={date.today().isoformat()}", headers=hdr)
    assert today_res.status_code == 200
    body = today_res.json()
    assert len(body["items"]) >= 4
    first_item = body["items"][0]
    assert "clinical_notes" not in first_item
    assert "diagnosis" not in first_item

    # Mark attendance
    appt_id = first_item["appointment_id"]
    mark_res = client.patch(f"/api/v1/attendance/{appt_id}/mark", json={"status": "present"}, headers=hdr)
    assert mark_res.status_code == 200
    assert mark_res.json()["attendance_status"] == "present"

    # Walk-in check-in by CR Number
    walkin_res = client.post(
        "/api/v1/attendance/walkin-checkin",
        json={"cr_number": "PGI-CR-2026-1014", "operatory": "Operatory 5 (Pediatric)"},
        headers=hdr,
    )
    assert walkin_res.status_code == 201
    assert walkin_res.json()["attendance_status"] == "checked_in"

    # Receptionist strictly blocked from clinical routes
    assert client.post("/api/v1/patients", json={}, headers=hdr).status_code == 403
    assert client.get("/api/v1/patients", headers=hdr).status_code == 403
    assert client.get("/api/v1/visits/patient/1", headers=hdr).status_code == 403
    assert client.get("/api/v1/documents", headers=hdr).status_code == 403
    assert client.get("/api/v1/followups", headers=hdr).status_code == 403
    assert client.get("/api/v1/students", headers=hdr).status_code == 403


def test_patient_portal_privacy_and_opt_in_sharing(client, patient_token):
    hdr = {"Authorization": f"Bearer {patient_token}"}

    # Patient blocked from staff clinical routes & doctor contact directory
    for forbidden_url in (
        "/api/v1/patients",
        "/api/v1/patients/1",
        "/api/v1/visits/patient/1",
        "/api/v1/dental-chart/1",
        "/api/v1/treatments/plans",
        "/api/v1/prescriptions",
        "/api/v1/documents",
        "/api/v1/documents/patient/1",
        "/api/v1/doctors",
        "/api/v1/users/doctors",
        "/api/v1/users/dentists",
    ):
        r = client.get(forbidden_url, headers=hdr)
        assert r.status_code == 403, f"Expected 403 on {forbidden_url}, got {r.status_code}"

    # Portal appointments: doctor name only, Google Cal & .ics links, zero doctor email/phone
    appts_res = client.get("/api/v1/patient-portal/appointments", headers=hdr)
    assert appts_res.status_code == 200
    appts = appts_res.json()["appointments"]
    assert len(appts) >= 1
    for a in appts:
        assert "doctor_name" in a
        assert "doctor_email" not in a
        assert "doctor_phone" not in a
        assert "notes" not in a
        assert "google_calendar_url" in a
        assert "ics_url" in a

    # Portal prescriptions: visible prescriptions only
    rx_res = client.get("/api/v1/patient-portal/prescriptions", headers=hdr)
    assert rx_res.status_code == 200
    rxs = rx_res.json()["prescriptions"]
    assert len(rxs) >= 1
    assert rxs[0]["prescription_number"] == "RX-2026-1001"

    # Portal shared items: advisories + ONLY shared docs (1 OPG X-ray, NOT unshared surgery photo)
    shared_res = client.get("/api/v1/patient-portal/shared-items", headers=hdr)
    assert shared_res.status_code == 200
    shared_body = shared_res.json()
    assert len(shared_body["advisories"]) >= 1
    shared_types = {d["document_type"] for d in shared_body["shared_documents"]}
    assert "opg" in shared_types
    assert "surgery_photo" not in shared_types


def test_doctor_missed_appointment_and_severity_triage(client, doctor_token):
    hdr = {"Authorization": f"Bearer {doctor_token}"}
    missed_res = client.post(
        "/api/v1/appointments/missed",
        json={"cr_number": "PGI-CR-2026-1002", "missed_reason": "Patient missed follow-up"},
        headers=hdr,
    )
    assert missed_res.status_code == 201
    assert missed_res.json()["is_missed"] is True

    sev_res = client.patch(
        "/api/v1/patients/2/severity",
        json={"pain_scale": 8, "severity_level": "severe"},
        headers=hdr,
    )
    assert sev_res.status_code == 200
    assert sev_res.json()["pain_scale"] == 8
    assert sev_res.json()["severity_level"] == "severe"
