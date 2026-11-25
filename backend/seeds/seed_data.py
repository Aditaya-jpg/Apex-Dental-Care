import struct
import sys
import zlib
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path

# Ensure backend directory is on sys.path regardless of working directory
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.constants import FDI_PERMANENT_TEETH  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import (  # noqa: E402
    Appointment,
    CareAndSystemLog,
    ClinicalRecord,
    Doctor,
    Document,
    Patient,
    Student,
    User,
)
from app.security.hashing import hash_password  # noqa: E402
from app.storage.file_storage import file_storage  # noqa: E402


def _make_sample_png(width: int = 32, height: int = 32, shade: int = 160) -> bytes:
    """Create a valid minimal grayscale PNG image in memory for encrypted vault seeding."""

    def _chunk(chunk_type: bytes, data: bytes) -> bytes:
        length = struct.pack("!I", len(data))
        crc = struct.pack("!I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
        return length + chunk_type + data + crc

    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = _chunk(b"IHDR", struct.pack("!IIBBBBB", width, height, 8, 0, 0, 0, 0))
    raw_rows = b"".join(b"\x00" + bytes([(shade + y * 2) % 256] * width) for y in range(height))
    idat = _chunk(b"IDAT", zlib.compress(raw_rows))
    iend = _chunk(b"IEND", b"")
    return signature + ihdr + idat + iend


def _build_restorative_chart(special_teeth: dict[int, dict]) -> dict:
    now_iso = datetime.now(UTC).isoformat()
    teeth = {}
    for idx, t_num in enumerate(sorted(FDI_PERMANENT_TEETH), start=1):
        spec = special_teeth.get(t_num, {})
        teeth[str(t_num)] = {
            "id": idx,
            "tooth_number": t_num,
            "current_condition": spec.get("condition", "healthy"),
            "severity": spec.get("severity", "none"),
            "surfaces": spec.get("surfaces"),
            "notes": spec.get("notes"),
            "updated_at": now_iso,
        }
    return {"teeth": teeth, "history": []}


def _build_perio_chart() -> dict:
    now_iso = datetime.now(UTC).isoformat()
    t16_depths = {"mb": 5, "b": 4, "db": 6, "ml": 4, "l": 3, "dl": 5}
    t36_depths = {"mb": 4, "b": 3, "db": 4, "ml": 3, "l": 3, "dl": 4}
    teeth = {
        "16": {
            "probing_depths": t16_depths,
            "sites": t16_depths,
            "recession": {"mb": 1, "b": 1, "db": 2, "ml": 0, "l": 0, "dl": 1},
            "bop": {"mb": True, "b": False, "db": True, "ml": False, "l": False, "dl": True},
            "mobility": 1,
            "furcation": 1,
        },
        "36": {
            "probing_depths": t36_depths,
            "sites": t36_depths,
            "recession": {"mb": 0, "b": 0, "db": 1, "ml": 0, "l": 0, "dl": 0},
            "bop": {"mb": True, "b": False, "db": False, "ml": False, "l": False, "dl": False},
            "mobility": 0,
            "furcation": 0,
        },
    }
    return {
        "teeth": teeth,
        "plaque_index": "Fair (28%)",
        "notes": "Baseline 6-site periodontal charting completed.",
        "summary": {
            "mean_ppd": 4.0,
            "bop_percentage": 33.3,
            "deepest_pocket": 6,
            "max_ppd": 6,
            "sites_ge_4mm": 8,
            "sites_ge_6mm": 1,
            "deep_pockets_ge_4mm": 8,
        },
        "snapshots": [
            {
                "recorded_at": now_iso,
                "recorded_by": "Dr. Vikram Mehta",
                "plaque_index": "Fair (28%)",
                "notes": "Baseline 6-site periodontal charting completed.",
            }
        ],
        "updated_at": now_iso,
    }


def seed_database(db=None):
    should_close = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        should_close = True

    print("Seeding PGI Dental Management System database...")

    # Clear tables in safe dependency order
    db.query(CareAndSystemLog).delete()
    db.query(Document).delete()
    db.query(ClinicalRecord).delete()
    db.query(Appointment).delete()
    db.query(Patient).delete()
    db.query(Student).delete()
    db.query(Doctor).delete()
    db.query(User).delete()
    db.commit()

    # Clear stale encrypted vault files before seeding fresh encrypted samples
    vault_dir = getattr(file_storage, "vault_dir", None)
    if vault_dir and Path(vault_dir).exists():
        for enc_file in Path(vault_dir).rglob("*.enc"):
            enc_file.unlink(missing_ok=True)

    pw_hash = hash_password("Dental@123")
    now = datetime.now(UTC)
    today = date.today()

    # 1. Users: 1 Faculty Admin, 3 Doctors (dr.mehta is_admin=True), 6 Students, 1 Receptionist, 1 Patient Portal User
    admin_user = User(
        email="admin@pgi.edu.in",
        username="admin",
        password_hash=pw_hash,
        full_name="Prof. Dr. Rajeshwar Verma",
        role="admin",
        phone="+91 172 275 6801",
        is_active=True,
        token_version=1,
        refresh_tokens_json=[],
    )
    db.add(admin_user)

    doc_specs = [
        ("dr.mehta@pgi.edu.in", "dr.mehta", "Dr. Vikram Mehta", "+91 98765 11001", "Conservative Dentistry & Endodontics", "Conservative Dentistry", "PGI-DEN-101", "Operatory 1", True),
        ("dr.sharma@pgi.edu.in", "dr.sharma", "Dr. Anjali Sharma", "+91 98765 11002", "Oral & Maxillofacial Surgery", "Oral Surgery", "PGI-DEN-102", "Operatory 4 (Surgery)", False),
        ("dr.kaur@pgi.edu.in", "dr.kaur", "Dr. Harpreet Kaur", "+91 98765 11003", "Periodontology & Oral Implantology", "Periodontology", "PGI-DEN-103", "Operatory 2", False),
    ]
    doctor_objs: list[Doctor] = []
    doctor_users: list[User] = []
    for email, uname, fname, phone, spec, dept, lic, op, is_adm in doc_specs:
        u = User(
            email=email,
            username=uname,
            password_hash=pw_hash,
            full_name=fname,
            role="doctor",
            phone=phone,
            is_active=True,
            token_version=1,
            refresh_tokens_json=[],
        )
        db.add(u)
        db.flush()
        d = Doctor(
            user_id=u.id,
            full_name=fname,
            email=email,
            phone=phone,
            specialization=spec,
            department=dept,
            license_number=lic,
            cabin_operatory=op,
            is_admin=is_adm,
            google_calendar_id=email,
            is_active=True,
        )
        db.add(d)
        db.flush()
        doctor_users.append(u)
        doctor_objs.append(d)

    # 2. 6 Students (flexible doctor_id: some linked, some None)
    student_specs = [
        ("student1@pgi.edu.in", "student1", "Rohan Malhotra", "+91 98765 22001", "PGI-BDS-2026-01", "Intern (BDS)", "Conservative Dentistry", doctor_objs[0].id),
        ("student2@pgi.edu.in", "student2", "Priya Nair", "+91 98765 22002", "PGI-MDS-2026-02", "MDS Year 2", "Oral Surgery", doctor_objs[1].id),
        ("student3@pgi.edu.in", "student3", "Kabir Gill", "+91 98765 22003", "PGI-MDS-2026-03", "MDS Year 1", "Periodontology", doctor_objs[2].id),
        ("student4@pgi.edu.in", "student4", "Meera Bansal", "+91 98765 22004", "PGI-BDS-2026-04", "BDS Final Year", "Oral Health Sciences", None),
        ("student5@pgi.edu.in", "student5", "Arjun Sidhu", "+91 98765 22005", "PGI-BDS-2026-05", "BDS Final Year", "Oral Health Sciences", None),
        ("student6@pgi.edu.in", "student6", "Simran Chawla", "+91 98765 22006", "PGI-MDS-2026-06", "MDS Year 3", "Conservative Dentistry", doctor_objs[0].id),
    ]
    student_objs: list[Student] = []
    for email, uname, fname, phone, roll, yr, dept, doc_id in student_specs:
        u = User(
            email=email,
            username=uname,
            password_hash=pw_hash,
            full_name=fname,
            role="student",
            phone=phone,
            is_active=True,
            token_version=1,
            refresh_tokens_json=[],
        )
        db.add(u)
        db.flush()
        s = Student(
            user_id=u.id,
            doctor_id=doc_id,
            full_name=fname,
            email=email,
            phone=phone,
            roll_number=roll,
            year_of_study=yr,
            department=dept,
            college_institution="PGI Oral Health Sciences Centre, Chandigarh",
            is_active=True,
        )
        db.add(s)
        db.flush()
        student_objs.append(s)

    # 3. 1 Receptionist
    reception_user = User(
        email="reception@pgi.edu.in",
        username="reception",
        password_hash=pw_hash,
        full_name="Simranpreet Kaur (Reception)",
        role="receptionist",
        phone="+91 172 275 6831",
        is_active=True,
        token_version=1,
        refresh_tokens_json=[],
    )
    db.add(reception_user)

    # 4. Patient Portal User (linked to Patient 1)
    patient_portal_user = User(
        email="patient@pgi.edu.in",
        username="patient",
        password_hash=pw_hash,
        full_name="Aarav Sharma",
        role="patient",
        phone="+91 98140 10001",
        is_active=True,
        token_version=1,
        refresh_tokens_json=[],
    )
    db.add(patient_portal_user)
    db.flush()

    # 5. 16 PGI Patients:
    # - 5 assigned to Student 1 (index 0..4)
    # - 5 assigned to Student 2 (index 5..9)
    # - 3 assigned to Doctors only (index 10..12)
    # - 3 unassigned including minor/geriatric/special cases (index 13..15)
    patients_specs = [
        # Student 1 (5 patients)
        ("Aarav", "Sharma", date(1988, 4, 12), "Male", "+91 98140 10001", "aarav.sharma@example.in", "House 42, Sector 15-A, Chandigarh", "O+", "en", ["Endodontics (RCT & Pulpitis)", "Dental Caries & Restorative"], ["emergency"], False, 7, "severe", False, None, None, "not_required", doctor_objs[0].id, student_objs[0].id, "in_treatment", "walk_in", "Penicillin allergy", "None", "Severe throbbing pain in upper right molar (16)"),
        ("Neha", "Thakur", date(1994, 7, 19), "Female", "+91 98140 10002", "neha.thakur@example.in", "Sector 22-B, Chandigarh", "A+", "hi", ["Dental Caries & Restorative"], [], False, 3, "mild", False, None, None, "not_required", doctor_objs[0].id, student_objs[0].id, "diagnosed", "walk_in", "None", "None", "Cold sensitivity on lower left molar"),
        ("Gurpreet", "Singh", date(1981, 11, 5), "Male", "+91 98140 10003", "gurpreet.s@example.in", "Phase 7, Mohali, Punjab", "B+", "pa", ["Periodontitis & Gingival"], ["diabetes", "tobacco_habit"], False, 4, "moderate", False, None, None, "not_required", doctor_objs[2].id, student_objs[0].id, "in_treatment", "phone_enquiry", "None", "Type 2 Diabetes", "Bleeding gums and loose lower incisors"),
        ("Pooja", "Bhatia", date(1997, 2, 28), "Female", "+91 98140 10004", "pooja.b@example.in", "Sector 9, Panchkula, Haryana", "AB+", "en", ["Orthodontics & Malocclusion"], ["orthodontic_followup"], False, 2, "mild", False, None, None, "not_required", doctor_objs[0].id, student_objs[0].id, "followup", "instagram", "None", "None", "Anterior crowding assessment"),
        ("Manish", "Kumar", date(1975, 9, 14), "Male", "+91 98140 10005", "manish.k@example.in", "Sector 38-D, Chandigarh", "O-", "hi", ["Prosthodontics & Implants"], ["hypertension"], False, 5, "moderate", False, None, None, "not_required", doctor_objs[1].id, student_objs[0].id, "registered", "whatsapp", "Aspirin", "Hypertension", "Missing lower molar requiring implant crown"),
        # Student 2 (5 patients)
        ("Sneha", "Kulkarni", date(2000, 5, 22), "Female", "+91 98140 10006", "sneha.k@example.in", "Sector 11, Chandigarh", "A-", "en", ["Oral & Maxillofacial Surgery"], ["emergency"], False, 8, "severe", False, None, None, "not_required", doctor_objs[1].id, student_objs[1].id, "in_treatment", "walk_in", "None", "None", "Impacted mandibular third molar pain"),
        ("Rajinder", "Gill", date(1970, 1, 9), "Male", "+91 98140 10007", "rajinder.g@example.in", "Kharar Road, Mohali", "B-", "pa", ["Oral & Maxillofacial Surgery", "Periodontitis & Gingival"], ["tobacco_habit"], False, 6, "moderate", False, None, None, "not_required", doctor_objs[1].id, student_objs[1].id, "diagnosed", "referral", "Sulfa drugs", "Chronic Gastritis", "Non-healing mucosal ulcer & mobile molar"),
        ("Kavita", "Joshi", date(1992, 6, 17), "Female", "+91 98140 10008", "kavita.j@example.in", "Sector 19-C, Chandigarh", "O+", "hi", ["Endodontics (RCT & Pulpitis)"], ["pregnant"], True, 5, "moderate", False, None, None, "not_required", doctor_objs[0].id, student_objs[1].id, "registered", "walk_in", "None", "Second Trimester Pregnancy", "Acute symptomatic pulpitis tooth 24"),
        ("Deepak", "Bansal", date(1986, 3, 11), "Male", "+91 98140 10009", "deepak.b@example.in", "Sector 44-A, Chandigarh", "A+", "en", ["Trauma & Emergency"], ["emergency"], False, 7, "severe", False, None, None, "not_required", doctor_objs[1].id, student_objs[1].id, "in_treatment", "walk_in", "None", "None", "Fractured maxillary central incisor"),
        ("Harjinder", "Kaur", date(1990, 12, 3), "Female", "+91 98140 10010", "harjinder.k@example.in", "Zirakpur, Punjab", "AB-", "pa", ["Periodontitis & Gingival"], [], False, 3, "mild", False, None, None, "not_required", doctor_objs[2].id, student_objs[1].id, "followup", "facebook", "None", "Hypothyroidism", "Routine periodontal pocket maintenance"),
        # Doctor-only assigned (3 patients)
        ("Vikramaditya", "Rao", date(1979, 8, 25), "Male", "+91 98140 10011", "vikram.rao@example.in", "Sector 8-B, Chandigarh", "O+", "en", ["Prosthodontics & Implants", "Endodontics (RCT & Pulpitis)"], [], False, 2, "mild", False, None, None, "not_required", doctor_objs[0].id, None, "in_treatment", "referral", "None", "None", "Full mouth ceramic bridge evaluation"),
        ("Ananya", "Deshmukh", date(1996, 10, 1), "Female", "+91 98140 10012", "ananya.d@example.in", "Sector 16, Panchkula", "B+", "en", ["Oral Medicine & Pathology"], [], False, 4, "moderate", False, None, None, "not_required", doctor_objs[1].id, None, "diagnosed", "walk_in", "Latex", "Asthma", "Recurrent aphthous stomatitis"),
        ("Sukhdev", "Sandhu", date(1983, 2, 14), "Male", "+91 98140 10013", "sukhdev.s@example.in", "Sector 35-C, Chandigarh", "A+", "pa", ["Periodontitis & Gingival"], ["diabetes"], False, 5, "moderate", False, None, None, "not_required", doctor_objs[2].id, None, "slipping", "phone_enquiry", "None", "Type 2 Diabetes", "Missed periodontal recall follow-up"),
        # Unassigned (3 patients: minor, geriatric, special case)
        ("Aryan", "Verma", date(today.year - 11, 6, 10), "Male", "+91 98140 10014", "aryan.parent@example.in", "Sector 20-A, Chandigarh", "O+", "hi", ["Pediatric & Preventive", "Dental Caries & Restorative"], ["pediatric"], False, 4, "moderate", True, "Sunita Verma (Mother)", "+91 98140 90014", "pending", None, None, "registered", "walk_in", "None", "None", "Primary molar caries & space maintainer check"),
        ("Balwant", "Khanna", date(today.year - 70, 3, 18), "Male", "+91 98140 10015", "balwant.k@example.in", "Sector 7, Chandigarh", "B+", "pa", ["Prosthodontics & Implants", "Oral Medicine & Pathology"], ["geriatric", "hypertension", "medically_compromised"], False, 7, "severe", False, None, None, "not_required", None, None, "registered", "walk_in", "NSAIDs", "Hypertension, Post-CABG", "Complete denture soreness and ridge resorption"),
        ("Riya", "Chopra", date(1999, 9, 2), "Female", "+91 98140 10016", "riya.special@example.in", "Sector 21-D, Chandigarh", "AB+", "en", ["Special Care Dentistry", "Trauma & Emergency"], ["special_case", "medically_compromised", "emergency"], True, 8, "critical", True, "Meenakshi Chopra (Guardian)", "+91 98140 90016", "signed", None, None, "diagnosed", "referral", "None", "Cerebral Palsy, Seizure Disorder", "Acute dental abscess & emergency pain management"),
    ]

    patient_objs: list[Patient] = []
    for idx, spec in enumerate(patients_specs, start=1001):
        (
            fn, ln, dob, gender, phone, email, addr, bg, lang, cats, kws, special_flag,
            pain, sev, consent_req, g_name, g_phone, consent_st, doc_id, stu_id,
            stage, channel, allergy, med_cond, complaint,
        ) = spec

        dental_chart = {}
        perio_chart = {}
        shared_notices = []
        if idx == 1001:
            dental_chart = _build_restorative_chart({
                16: {"condition": "root_canal", "severity": "severe", "surfaces": "MOD", "notes": "RCT initiated at PGI Endodontics"},
                18: {"condition": "missing", "notes": "Extracted 2 years ago"},
                26: {"condition": "filled", "surfaces": "O", "notes": "Composite restoration intact"},
                36: {"condition": "caries", "severity": "mild", "surfaces": "O", "notes": "Incipient occlusal caries"},
            })
            perio_chart = _build_perio_chart()
            shared_notices = [
                {
                    "id": "notice-1",
                    "category": "scan_request",
                    "title": "Pre-Visit Diagnostic Scans Required",
                    "message": "Please get a Digital OPG X-Ray and HbA1c Blood Test done and bring the films/reports on your next visit.",
                    "created_at": (now - timedelta(days=2)).isoformat(),
                },
                {
                    "id": "notice-2",
                    "category": "care_instruction",
                    "title": "Post-Pulpectomy Advisory",
                    "message": "Avoid biting hard foods on the upper right side until crown placement is complete.",
                    "created_at": (now - timedelta(days=1)).isoformat(),
                },
            ]
        elif idx == 1006:
            dental_chart = _build_restorative_chart({
                48: {"condition": "impacted", "severity": "severe", "notes": "Mesioangular impaction requiring surgical extraction"},
            })

        p = Patient(
            user_id=patient_portal_user.id if idx == 1001 else None,
            doctor_id=doc_id,
            student_id=stu_id,
            patient_code=f"P-{idx}",
            cr_number=f"PGI-CR-2026-{idx}",
            full_name=f"{fn} {ln}",
            first_name=fn,
            last_name=ln,
            date_of_birth=dob,
            gender=gender,
            phone=phone,
            email=email,
            address=addr,
            blood_group=bg,
            emergency_contact_name=g_name or f"{ln} Family",
            emergency_contact_phone=g_phone or phone,
            preferred_language=lang,
            disease_categories=cats,
            case_keywords=kws,
            special_case_flag=special_flag,
            pain_scale=pain,
            severity_level=sev,
            parent_consent_required=consent_req,
            parent_guardian_name=g_name,
            parent_guardian_phone=g_phone,
            parent_consent_status=consent_st,
            card_verification_status="verified" if idx <= 1010 else "pending",
            medical_history_json={
                "allergies": allergy,
                "medical_conditions": med_cond,
                "current_medications": "As prescribed",
                "past_surgeries": "None",
                "bleeding_disorders": False,
                "is_pregnant": "pregnant" in kws,
                "notes": "Verified at PGI intake.",
            },
            dental_history_json={
                "chief_complaint": complaint,
                "past_dental_treatments": "Routine restorations",
                "brushing_frequency": "Twice daily",
                "flossing": idx % 2 == 0,
                "habits": "Tobacco chewing" if "tobacco_habit" in kws else "None",
                "dental_anxiety_level": "Moderate" if special_flag else "Mild",
                "notes": "PGI Dental baseline history.",
            },
            dental_chart_json=dental_chart,
            perio_chart_json=perio_chart,
            misc_records_json={
                "Endodontics (RCT & Pulpitis)": "Apex locator reading 21.5mm MB1, 21.0mm DB, 22.0mm Palatal."
            } if idx == 1001 else {},
            patient_shared_notices_json=shared_notices,
            attendance_status="checked_in" if idx == 1001 else ("missed" if idx == 1013 else "not_arrived"),
            tracker_stage=stage,
            source_channel=channel,
            is_deleted=False,
            created_at=now - timedelta(days=(idx - 1000) * 2),
        )
        db.add(p)
        db.flush()
        patient_objs.append(p)

    # 6. Encrypted sample PNG X-rays / photos in backend/uploads/vault/
    # Patient 1 has ONLY 1 shared X-ray + 1 unshared surgery photo
    xray_png = _make_sample_png(32, 32, shade=140)
    surgery_png = _make_sample_png(32, 32, shade=90)
    card_png = _make_sample_png(32, 32, shade=210)

    stored_xray = file_storage.save_encrypted_bytes(
        patient_objs[0].id,
        "aarav_opg_2026.png",
        xray_png,
        mime_type="image/png",
        document_type="opg",
    )
    doc_xray_shared = Document(
        patient_id=patient_objs[0].id,
        uploaded_by_user_id=doctor_users[0].id,
        document_type="opg",
        title="OPG Panoramic Radiograph — Tooth 16",
        description="Pre-endodontic panoramic scan showing periapical radiolucency on 16.",
        disease_category="Endodontics (RCT & Pulpitis)",
        treatment_stage="pre_treatment",
        media_date=today - timedelta(days=5),
        is_shared_with_patient=True,
        storage_key=stored_xray.storage_key,
        original_filename=stored_xray.original_filename,
        mime_type=stored_xray.mime_type,
        file_size_bytes=stored_xray.file_size_bytes,
        is_encrypted=True,
        encryption_iv=stored_xray.encryption_iv,
        sha256_checksum=stored_xray.sha256_checksum,
    )
    db.add(doc_xray_shared)

    stored_surg = file_storage.save_encrypted_bytes(
        patient_objs[0].id,
        "aarav_access_cavity_surgery.png",
        surgery_png,
        mime_type="image/png",
        document_type="surgery_photo",
    )
    doc_surgery_unshared = Document(
        patient_id=patient_objs[0].id,
        uploaded_by_user_id=doctor_users[0].id,
        document_type="surgery_photo",
        title="Access Cavity & Canal Orifice Intraoperative Photo",
        description="Clinical surgical photo (doctor/student internal view only).",
        disease_category="Endodontics (RCT & Pulpitis)",
        treatment_stage="surgery",
        media_date=today - timedelta(days=3),
        is_shared_with_patient=False,
        storage_key=stored_surg.storage_key,
        original_filename=stored_surg.original_filename,
        mime_type=stored_surg.mime_type,
        file_size_bytes=stored_surg.file_size_bytes,
        is_encrypted=True,
        encryption_iv=stored_surg.encryption_iv,
        sha256_checksum=stored_surg.sha256_checksum,
    )
    db.add(doc_surgery_unshared)

    stored_card = file_storage.save_encrypted_bytes(
        patient_objs[0].id,
        "pgi_cr_card_1001.png",
        card_png,
        mime_type="image/png",
        document_type="patient_card",
    )
    doc_card = Document(
        patient_id=patient_objs[0].id,
        uploaded_by_user_id=doctor_users[0].id,
        document_type="patient_card",
        title="PGI CR Registration Card",
        description="Official PGIMER registration card",
        treatment_stage="initial_assessment",
        media_date=today - timedelta(days=7),
        is_shared_with_patient=True,
        storage_key=stored_card.storage_key,
        original_filename=stored_card.original_filename,
        mime_type=stored_card.mime_type,
        file_size_bytes=stored_card.file_size_bytes,
        is_encrypted=True,
        encryption_iv=stored_card.encryption_iv,
        sha256_checksum=stored_card.sha256_checksum,
    )
    db.add(doc_card)
    db.flush()
    patient_objs[0].card_doc_id = doc_card.id

    # Patient 6 (Student 2) encrypted X-ray for IDOR tests
    stored_p6_xray = file_storage.save_encrypted_bytes(
        patient_objs[5].id,
        "sneha_impaction_xray.png",
        xray_png,
        mime_type="image/png",
        document_type="xray",
    )
    db.add(
        Document(
            patient_id=patient_objs[5].id,
            uploaded_by_user_id=doctor_users[1].id,
            document_type="xray",
            title="Mandibular 48 Impaction IOPA",
            description="Pre-surgical impaction radiograph",
            disease_category="Oral & Maxillofacial Surgery",
            treatment_stage="pre_treatment",
            media_date=today - timedelta(days=2),
            is_shared_with_patient=False,
            storage_key=stored_p6_xray.storage_key,
            original_filename=stored_p6_xray.original_filename,
            mime_type=stored_p6_xray.mime_type,
            file_size_bytes=stored_p6_xray.file_size_bytes,
            is_encrypted=True,
            encryption_iv=stored_p6_xray.encryption_iv,
            sha256_checksum=stored_p6_xray.sha256_checksum,
        )
    )

    # 7. Appointments: Past, Today (for Attendance Desk), Future, and Missed Appointments
    appts_data = [
        # Completed past
        (patient_objs[0], doctor_objs[0], student_objs[0], "Operatory 1", "Root Canal Treatment", today - timedelta(days=5), time(9, 30), time(10, 30), "completed", "completed", False, None, "Emergency RCT initiation tooth 16"),
        (patient_objs[5], doctor_objs[1], student_objs[1], "Operatory 4 (Surgery)", "Extraction / Oral Surgery", today - timedelta(days=2), time(11, 0), time(12, 0), "completed", "completed", False, None, "Surgical extraction 48"),
        # Today's schedule (for Attendance Desk & Smart Calendar)
        (patient_objs[0], doctor_objs[0], student_objs[0], "Operatory 1", "Root Canal Treatment", today, time(10, 0), time(11, 0), "checked_in", "checked_in", False, None, "RCT obturation stage tooth 16"),
        (patient_objs[1], doctor_objs[0], student_objs[0], "Operatory 1", "Filling / Restoration", today, time(11, 30), time(12, 15), "confirmed", "pending", False, None, "Composite restoration tooth 36"),
        (patient_objs[2], doctor_objs[2], student_objs[0], "Operatory 2", "Periodontal Review & Recall", today, time(14, 0), time(14, 30), "scheduled", "pending", False, None, "Diabetic periodontal pocket evaluation"),
        (patient_objs[6], doctor_objs[1], student_objs[1], "Operatory 4 (Surgery)", "Extraction / Oral Surgery", today, time(15, 0), time(15, 45), "confirmed", "pending", False, None, "Post-op check and biopsy review"),
        # Upcoming future
        (patient_objs[0], doctor_objs[0], student_objs[0], "Operatory 1", "Crown Preparation & Fitting", today + timedelta(days=4), time(10, 0), time(11, 0), "scheduled", "pending", False, None, "Zirconia crown prep tooth 16"),
        (patient_objs[10], doctor_objs[0], None, "Operatory 3", "Crown Preparation & Fitting", today + timedelta(days=2), time(9, 30), time(10, 30), "confirmed", "pending", False, None, "Ceramic bridge impression"),
        # Missed appointments
        (patient_objs[12], doctor_objs[2], None, "Operatory 2", "Periodontal Review & Recall", today - timedelta(days=3), time(16, 0), time(16, 30), "no_show", "missed", True, "Patient did not arrive; unreachable by phone", "Missed periodontal recall"),
        (patient_objs[4], doctor_objs[1], student_objs[0], "Operatory 4 (Surgery)", "Routine Checkup & Consultation", today - timedelta(days=1), time(12, 0), time(12, 30), "no_show", "missed", True, "Transport delay in Chandigarh", "Missed implant evaluation"),
    ]
    created_appts: list[Appointment] = []
    for p, d, s, op, atype, adate, st, et, status_v, att_v, missed_v, m_reason, rsn in appts_data:
        appt = Appointment(
            patient_id=p.id,
            doctor_id=d.id,
            student_id=s.id if s else None,
            operatory=op,
            appointment_type=atype,
            appointment_date=adate,
            start_time=st,
            end_time=et,
            status=status_v,
            attendance_status=att_v,
            is_missed=missed_v,
            missed_reason=m_reason,
            reason=rsn,
        )
        db.add(appt)
        db.flush()
        created_appts.append(appt)

    # 8. Clinical Records: Visits, Treatment Plans, Surgical Logs, Prescriptions, and 6 Rx Templates
    v1 = ClinicalRecord(
        patient_id=patient_objs[0].id,
        doctor_id=doctor_objs[0].id,
        student_id=student_objs[0].id,
        appointment_id=created_appts[0].id,
        record_type="visit",
        record_date=today - timedelta(days=5),
        title="Acute Irreversible Pulpitis — Tooth 16",
        status="completed",
        language="en",
        is_visible_to_patient=False,
        payload_json={
            "vitals_blood_pressure": "124/80",
            "vitals_pulse": 76,
            "chief_complaint": "Severe throbbing pain in upper right back tooth (16) aggravated by hot liquids.",
            "general_exam_notes": "Patient alert, oriented, no facial asymmetry or trismus.",
            "extraoral_findings": "Mild right submandibular lymphadenopathy, tender on palpation.",
            "tmj_status": "Normal bilateral excursion, no clicking.",
            "lymph_nodes": "Right submandibular node palpable (1cm).",
            "intraoral_hard_tissue": "Deep disto-occlusal caries on tooth 16; tender to vertical percussion.",
            "intraoral_soft_tissue": "Mild gingival erythema around 16; mucosa otherwise normal.",
            "occlusion_status": "Class I molar relation.",
            "oral_findings": "Pulpal exposure on caries excavation.",
            "gum_condition": "Localized mild marginal gingivitis.",
            "hygiene_index": "Fair",
            "diagnosis": "Acute Irreversible Pulpitis with Symptomatic Apical Periodontitis (16)",
            "clinical_notes": "Private internal EMR note: Access opening done under LA; working length confirmed via apex locator.",
            "pain_scale": 7,
            "severity_level": "severe",
        },
    )
    db.add(v1)

    tp1 = ClinicalRecord(
        patient_id=patient_objs[0].id,
        doctor_id=doctor_objs[0].id,
        student_id=student_objs[0].id,
        record_type="treatment_plan",
        record_date=today - timedelta(days=5),
        title="Endodontic & Crown Rehabilitation — Tooth 16",
        status="active",
        language="en",
        is_visible_to_patient=False,
        payload_json={
            "notes": "Multi-visit RCT followed by Zirconia crown; composite filling on 36.",
            "items": [
                {
                    "id": 1,
                    "procedure_name": "Root Canal Therapy (Molar)",
                    "tooth_number": 16,
                    "status": "in_progress",
                    "visit_id": None,
                    "notes": "Biomechanical preparation completed; Ca(OH)2 dressing placed.",
                    "completed_at": None,
                    "created_at": now.isoformat(),
                },
                {
                    "id": 2,
                    "procedure_name": "Zirconia Aesthetic Crown",
                    "tooth_number": 16,
                    "status": "planned",
                    "visit_id": None,
                    "notes": "Post-obturation full coverage crown.",
                    "completed_at": None,
                    "created_at": now.isoformat(),
                },
                {
                    "id": 3,
                    "procedure_name": "Composite Resin Filling (1-2 surfaces)",
                    "tooth_number": 36,
                    "status": "planned",
                    "visit_id": None,
                    "notes": "Preventive resin restoration.",
                    "completed_at": None,
                    "created_at": now.isoformat(),
                },
            ],
        },
    )
    db.add(tp1)

    surg1 = ClinicalRecord(
        patient_id=patient_objs[0].id,
        doctor_id=doctor_objs[0].id,
        student_id=student_objs[0].id,
        record_type="surgical_log",
        record_date=today - timedelta(days=3),
        title="Endodontic Access & Pulpectomy — Tooth 16",
        status="completed",
        language="en",
        is_visible_to_patient=False,
        payload_json={
            "procedure_name": "Emergency Pulpectomy & Canal Debridement",
            "tooth_numbers": [16],
            "surgeon_name": "Dr. Vikram Mehta",
            "anesthesia_type": "2% Lignocaine with 1:80,000 Adrenaline (PSA + GP Nerve Block)",
            "operative_notes": "4 canals negotiated (MB1, MB2, DB, Palatal). Copious 3% NaOCl irrigation.",
            "post_op_instructions": "Avoid hard chewing on right side; complete antibiotic course.",
            "suture_removal_date": None,
            "linked_document_ids": [doc_surgery_unshared.id],
        },
    )
    db.add(surg1)

    surg2 = ClinicalRecord(
        patient_id=patient_objs[5].id,
        doctor_id=doctor_objs[1].id,
        student_id=student_objs[1].id,
        record_type="surgical_log",
        record_date=today - timedelta(days=2),
        title="Surgical Disimpaction — Tooth 48",
        status="completed",
        language="en",
        is_visible_to_patient=False,
        payload_json={
            "procedure_name": "Surgical Extraction / Impaction",
            "tooth_numbers": [48],
            "surgeon_name": "Dr. Anjali Sharma",
            "anesthesia_type": "Inferior Alveolar & Lingual Nerve Block",
            "operative_notes": "Ward's incision, buccal bone guttering, tooth sectioned and elevated intact. 3-0 silk sutures placed.",
            "post_op_instructions": "Ice pack 15 min on/off for 24h. Soft cold diet. No spitting/straw.",
            "suture_removal_date": (today + timedelta(days=5)).isoformat(),
            "linked_document_ids": [],
        },
    )
    db.add(surg2)

    rx1 = ClinicalRecord(
        patient_id=patient_objs[0].id,
        doctor_id=doctor_objs[0].id,
        student_id=student_objs[0].id,
        record_type="prescription",
        record_date=today - timedelta(days=5),
        title="Acute Pulpitis Medication Schedule",
        status="issued",
        language="en",
        is_visible_to_patient=True,
        payload_json={
            "prescription_number": "RX-2026-1001",
            "template_name": "Acute Pulpitis",
            "diagnosis_summary": "Acute Irreversible Pulpitis — Tooth 16",
            "general_instructions": "Complete full antibiotic course. Avoid chewing on upper right side.",
            "treatment_instructions": "Take all medicines after meals. Report immediately if facial swelling increases.",
            "localized_summary": "Complete 5-day course; avoid hot/hard foods on right side.",
            "medications": [
                {
                    "medicine_name": "Augmentin 625mg",
                    "dosage": "625 mg",
                    "frequency": "1-0-1",
                    "duration": "5 days",
                    "timing": "After Food",
                    "instructions": "Complete full 5-day course.",
                    "localized_instructions": "1 tablet morning & night after meals for 5 days.",
                },
                {
                    "medicine_name": "Ibuprofen 400mg",
                    "dosage": "400 mg",
                    "frequency": "1-0-1",
                    "duration": "3 days",
                    "timing": "After Food",
                    "instructions": "Take for pain relief after meals.",
                    "localized_instructions": "1 tablet morning & night after food.",
                },
                {
                    "medicine_name": "Chlorhexidine 0.2% Mouthwash",
                    "dosage": "15 ml",
                    "frequency": "1-0-1",
                    "duration": "7 days",
                    "timing": "After Brushing",
                    "instructions": "Swish for 30 seconds and spit.",
                    "localized_instructions": "Rinse twice daily after brushing.",
                },
            ],
        },
    )
    db.add(rx1)

    # 6 Auto-Prescription Templates (patient_id=None)
    rx_templates = [
        (
            "Acute Pulpitis",
            "Acute Irreversible Pulpitis / Endodontic Pain",
            [
                {"medicine_name": "Augmentin 625mg", "dosage": "625 mg", "frequency": "1-0-1", "duration": "5 days", "timing": "After Food", "instructions": "Complete antibiotic course."},
                {"medicine_name": "Ketorolac 10mg", "dosage": "10 mg", "frequency": "1-0-1", "duration": "3 days", "timing": "After Food", "instructions": "For severe dental pain."},
                {"medicine_name": "Pantoprazole 40mg", "dosage": "40 mg", "frequency": "1-0-0", "duration": "5 days", "timing": "Before Food", "instructions": "30 mins before breakfast."},
            ],
            "Avoid chewing hard food on affected side until root canal completion.",
        ),
        (
            "Post-Extraction",
            "Post-Extraction Socket Healing Protocol",
            [
                {"medicine_name": "Amoxicillin 500mg", "dosage": "500 mg", "frequency": "1-1-1", "duration": "5 days", "timing": "After Food", "instructions": "Complete 5-day course."},
                {"medicine_name": "Ibuprofen 400mg", "dosage": "400 mg", "frequency": "1-0-1", "duration": "3 days", "timing": "After Food", "instructions": "Pain and inflammation control."},
                {"medicine_name": "Chlorhexidine 0.2% Mouthwash", "dosage": "15 ml", "frequency": "1-0-1", "duration": "7 days", "timing": "After Brushing", "instructions": "Start gentle rinse 24 hours after extraction."},
            ],
            "Bite on sterile gauze for 45 mins. Soft cold diet for 24 hours. No straw or spitting.",
        ),
        (
            "Periodontal Infection",
            "Acute Periodontitis / Gingival Abscess",
            [
                {"medicine_name": "Amoxicillin 500mg", "dosage": "500 mg", "frequency": "1-1-1", "duration": "5 days", "timing": "After Food", "instructions": "Full course."},
                {"medicine_name": "Metronidazole 400mg", "dosage": "400 mg", "frequency": "1-1-1", "duration": "5 days", "timing": "After Food", "instructions": "Avoid alcohol during course."},
                {"medicine_name": "Chlorhexidine 0.2% Mouthwash", "dosage": "15 ml", "frequency": "1-0-1", "duration": "14 days", "timing": "After Brushing", "instructions": "Gentle gum rinse."},
            ],
            "Warm saline rinses twice daily; gentle soft-bristle brushing.",
        ),
        (
            "Dental Abscess",
            "Odontogenic Periapical / Fascial Space Infection",
            [
                {"medicine_name": "Augmentin 625mg", "dosage": "625 mg", "frequency": "1-0-1", "duration": "7 days", "timing": "After Food", "instructions": "Take strictly on schedule."},
                {"medicine_name": "Metronidazole 400mg", "dosage": "400 mg", "frequency": "1-1-1", "duration": "5 days", "timing": "After Food", "instructions": "Anaerobic coverage."},
                {"medicine_name": "Paracetamol 650mg", "dosage": "650 mg", "frequency": "1-1-1", "duration": "3 days", "timing": "After Food", "instructions": "For fever and pain."},
            ],
            "Report immediately if fever persists, swallowing difficulty, or swelling increases.",
        ),
        (
            "Aphthous Ulcer",
            "Recurrent Aphthous Stomatitis / Oral Ulcer",
            [
                {"medicine_name": "Triamcinolone Acetonide Oral Paste", "dosage": "0.1%", "frequency": "1-0-1", "duration": "7 days", "timing": "After Food", "instructions": "Apply thin layer onto ulcer after meals & bedtime."},
                {"medicine_name": "Chlorhexidine 0.2% Mouthwash", "dosage": "15 ml", "frequency": "1-0-1", "duration": "7 days", "timing": "After Brushing", "instructions": "Alcohol-free gentle rinse."},
            ],
            "Avoid spicy, acidic, or very hot foods until ulcer heals.",
        ),
        (
            "Pediatric Pain Relief",
            "Pediatric Dental Pain & Inflammation",
            [
                {"medicine_name": "Pediatric Paracetamol Syrup 250mg/5ml", "dosage": "5 ml", "frequency": "1-1-1", "duration": "3 days", "timing": "After Food", "instructions": "Shake bottle well; weight-verified pediatric dose."},
            ],
            "Ensure soft diet and hydration; supervised tooth brushing twice daily.",
        ),
    ]
    for tpl_name, diag_sum, meds, instr in rx_templates:
        db.add(
            ClinicalRecord(
                patient_id=None,
                doctor_id=doctor_objs[0].id,
                record_type="rx_template",
                record_date=today,
                title=tpl_name,
                status="active",
                language="en",
                is_visible_to_patient=False,
                payload_json={
                    "template_name": tpl_name,
                    "diagnosis_summary": diag_sum,
                    "general_instructions": instr,
                    "medications": meds,
                },
            )
        )

    # 9. Care & System Logs: Follow-ups, Recalls, Enquiries, Sandbox Notifications, Clinic Config, Audit
    db.add_all([
        CareAndSystemLog(
            event_type="followup",
            patient_id=patient_objs[0].id,
            actor_user_id=doctor_users[0].id,
            assigned_doctor_id=doctor_objs[0].id,
            assigned_student_id=student_objs[0].id,
            status="pending",
            scheduled_date=today + timedelta(days=2),
            channel="system",
            language="en",
            title="Evaluate percussion sensitivity & obturate tooth 16",
            payload_json={"reason": "RCT Step 2 Obturation Check", "notes": "Check OPG film brought by patient."},
        ),
        CareAndSystemLog(
            event_type="followup",
            patient_id=patient_objs[5].id,
            actor_user_id=doctor_users[1].id,
            assigned_doctor_id=doctor_objs[1].id,
            assigned_student_id=student_objs[1].id,
            status="pending",
            scheduled_date=today - timedelta(days=1),  # Overdue followup
            channel="system",
            language="en",
            title="Suture removal & socket healing check (Tooth 48)",
            payload_json={"reason": "Post-op surgical review", "notes": "Assess healing and remove 3-0 silk sutures."},
        ),
        CareAndSystemLog(
            event_type="followup",
            patient_id=patient_objs[12].id,
            actor_user_id=doctor_users[2].id,
            assigned_doctor_id=doctor_objs[2].id,
            status="pending",
            scheduled_date=today - timedelta(days=10),  # >7 days overdue followup for slipping tracker
            channel="system",
            language="pa",
            title="Periodontal scaling recall (>7 days overdue)",
            payload_json={"reason": "Overdue periodontal maintenance", "notes": "Contact patient for periodontal review."},
        ),
        CareAndSystemLog(
            event_type="recall",
            patient_id=patient_objs[2].id,
            actor_user_id=doctor_users[2].id,
            assigned_doctor_id=doctor_objs[2].id,
            status="pending",
            scheduled_date=today + timedelta(days=90),
            channel="sms",
            language="pa",
            title="90-Day Diabetic Periodontal Maintenance Recall",
            payload_json={"recall_type": "perio_maintenance", "interval_days": 90},
        ),
        CareAndSystemLog(
            event_type="recall",
            patient_id=patient_objs[10].id,
            actor_user_id=doctor_users[0].id,
            assigned_doctor_id=doctor_objs[0].id,
            status="pending",
            scheduled_date=today + timedelta(days=180),
            channel="sms",
            language="en",
            title="6-Month Routine Dental Check-up Recall",
            payload_json={"recall_type": "routine_checkup", "interval_days": 180},
        ),
        CareAndSystemLog(
            event_type="enquiry",
            patient_id=None,
            actor_user_id=doctor_users[0].id,
            assigned_doctor_id=doctor_objs[0].id,
            assigned_student_id=student_objs[0].id,
            status="open",
            scheduled_date=today,
            channel="phone",
            language="hi",
            title="Telephonic Enquiry — Root Canal Consultation",
            created_at=now - timedelta(days=5),  # >3 days uncontacted open enquiry
            payload_json={
                "caller_name": "Suresh Aggarwal",
                "phone": "+91 98140 55111",
                "source_channel": "phone_enquiry",
                "chief_complaint": "Swelling and pain in lower molar for 3 days",
                "notes": "Requested morning OPD slot at PGI Dental.",
            },
        ),
        CareAndSystemLog(
            event_type="enquiry",
            patient_id=None,
            actor_user_id=doctor_users[1].id,
            assigned_doctor_id=doctor_objs[1].id,
            status="contacted",
            scheduled_date=today + timedelta(days=1),
            channel="whatsapp",
            language="en",
            title="WhatsApp Enquiry — Wisdom Tooth Extraction",
            payload_json={
                "caller_name": "Nikhil Garg",
                "phone": "+91 98140 55222",
                "source_channel": "whatsapp",
                "chief_complaint": "Impacted wisdom tooth pain",
                "notes": "Shared PGI OPD timing and CR registration instructions.",
            },
        ),
        CareAndSystemLog(
            event_type="notification",
            patient_id=patient_objs[0].id,
            actor_user_id=doctor_users[0].id,
            assigned_doctor_id=doctor_objs[0].id,
            status="sent_sandbox",
            scheduled_date=today,
            channel="sms",
            language="en",
            title="Pre-Appointment Reminder",
            payload_json={
                "sender_id": "PGIDNT",
                "recipient": patient_objs[0].phone,
                "category": "pre_appointment",
                "message_body": "PGI Dental Branch: Your appointment with Dr. Vikram Mehta is confirmed at Operatory 1. Please bring your CR card & OPG film.",
            },
        ),
        CareAndSystemLog(
            event_type="clinic_config",
            actor_user_id=admin_user.id,
            status="active",
            channel="system",
            language="en",
            title="PGI Dental Branch System Configuration",
            payload_json={
                "clinic_name": "PGI Dental Branch — Oral Health Sciences Centre",
                "sms_sender_id": "PGIDNT",
                "sms_provider": "sandbox",
                "whatsapp_number": "+911722756831",
                "instagram_url": "https://instagram.com/pgimer_dental",
                "facebook_url": "https://facebook.com/pgimer.oralhealth",
                "recall_defaults": {
                    "routine_checkup_days": 180,
                    "suture_removal_days": 7,
                    "crown_check_days": 14,
                    "rct_followup_days": 30,
                    "perio_maintenance_days": 90,
                },
            },
        ),
        CareAndSystemLog(
            event_type="audit",
            actor_user_id=admin_user.id,
            status="logged",
            channel="system",
            language="en",
            title="SYSTEM_SEED",
            payload_json={
                "action": "SYSTEM_SEED",
                "user_email": admin_user.email,
                "entity_name": "System",
                "entity_id": "seed",
                "details": "Initialized PGI Dental 8-table schema with 16 patients, 3 doctors, 6 students, and encrypted vault samples.",
                "ip_address": "127.0.0.1",
                "user_agent": "PGISeedScript/2.0",
            },
        ),
    ])

    db.commit()
    if should_close:
        db.close()

    print("PGI Dental Management System seeding completed successfully!")
    print("Accounts (password for all: Dental@123):")
    print("  Faculty Admin : admin@pgi.edu.in")
    print("  Admin Doctor  : dr.mehta@pgi.edu.in (is_admin=True)")
    print("  Doctors       : dr.sharma@pgi.edu.in, dr.kaur@pgi.edu.in")
    print("  Students      : student1@pgi.edu.in .. student6@pgi.edu.in")
    print("  Receptionist  : reception@pgi.edu.in")
    print("  Patient Portal: patient@pgi.edu.in (linked to Patient 1)")


if __name__ == "__main__":
    seed_database()
