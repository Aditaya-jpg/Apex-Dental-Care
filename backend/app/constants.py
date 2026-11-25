"""Domain constants and non-billing catalogs for PGI Dental Management System."""

FDI_PERMANENT_TEETH: set[int] = {
    11, 12, 13, 14, 15, 16, 17, 18,
    21, 22, 23, 24, 25, 26, 27, 28,
    31, 32, 33, 34, 35, 36, 37, 38,
    41, 42, 43, 44, 45, 46, 47, 48,
}

DISEASE_CATEGORIES: list[str] = [
    "Dental Caries & Restorative",
    "Endodontics (RCT & Pulpitis)",
    "Periodontitis & Gingival",
    "Oral & Maxillofacial Surgery",
    "Prosthodontics & Implants",
    "Orthodontics & Malocclusion",
    "Pediatric & Preventive",
    "Oral Medicine & Pathology",
    "Trauma & Emergency",
    "Special Care Dentistry",
]

CASE_KEYWORDS_PRESETS: list[str] = [
    "pediatric",
    "geriatric",
    "special_case",
    "medically_compromised",
    "pregnant",
    "emergency",
    "diabetes",
    "hypertension",
    "tobacco_habit",
    "orthodontic_followup",
]

SEVERITY_LEVELS: list[str] = [
    "none",
    "mild",
    "moderate",
    "severe",
    "critical",
]

TREATMENT_STAGES: list[str] = [
    "initial_assessment",
    "pre_treatment",
    "mid_treatment",
    "surgery",
    "post_treatment",
    "follow_up",
]

PHOTO_TYPES: list[str] = [
    "intraoral_photo",
    "extraoral_photo",
    "iop_photo",
    "profile_photo",
    "surgery_photo",
    "misc_photo",
]

IMAGING_TYPES: list[str] = [
    "xray",
    "opg",
    "cbct",
]

DOCUMENT_TYPES: list[str] = [
    *IMAGING_TYPES,
    *PHOTO_TYPES,
    "patient_card",
    "parent_consent",
    "lab_report",
    "other",
]

OPERATORIES: list[str] = [
    "Operatory 1",
    "Operatory 2",
    "Operatory 3",
    "Operatory 4 (Surgery)",
    "Operatory 5 (Pediatric)",
]

PROCEDURE_CATALOG: list[dict[str, str | int]] = [
    {
        "id": 1,
        "code": "CONS-01",
        "name": "Comprehensive Oral Examination",
        "category": "Preventive",
        "description": "Full oral cavity checkup, general and intraoral exam, periodontal screening",
    },
    {
        "id": 2,
        "code": "CLEAN-01",
        "name": "Dental Prophylaxis & Scaling",
        "category": "Preventive",
        "description": "Ultrasonic scaling and polishing for plaque and calculus removal",
    },
    {
        "id": 3,
        "code": "FILL-COMP",
        "name": "Composite Resin Filling (1-2 surfaces)",
        "category": "Restorative",
        "description": "Tooth-colored aesthetic resin restoration",
    },
    {
        "id": 4,
        "code": "FILL-COMP-L",
        "name": "Composite Resin Filling (Complex/MOD)",
        "category": "Restorative",
        "description": "Multi-surface composite restoration",
    },
    {
        "id": 5,
        "code": "RCT-ANT",
        "name": "Root Canal Therapy (Anterior)",
        "category": "Endodontics",
        "description": "Chemo-mechanical canal preparation, disinfection, and obturation",
    },
    {
        "id": 6,
        "code": "RCT-MOL",
        "name": "Root Canal Therapy (Molar)",
        "category": "Endodontics",
        "description": "Multi-canal molar endodontic treatment",
    },
    {
        "id": 7,
        "code": "CRN-PFM",
        "name": "Porcelain-Fused-to-Metal (PFM) Crown",
        "category": "Prosthodontics",
        "description": "Full-coverage PFM crown restoration",
    },
    {
        "id": 8,
        "code": "CRN-ZIRC",
        "name": "Zirconia Aesthetic Crown",
        "category": "Prosthodontics",
        "description": "Monolithic CAD/CAM zirconia crown",
    },
    {
        "id": 9,
        "code": "EXT-SIMP",
        "name": "Simple Tooth Extraction",
        "category": "Surgery",
        "description": "Routine forceps extraction under local anaesthesia",
    },
    {
        "id": 10,
        "code": "EXT-SURG",
        "name": "Surgical Extraction / Impaction",
        "category": "Surgery",
        "description": "Surgical mucoperiosteal flap elevation, bone guttering, and suturing",
    },
    {
        "id": 11,
        "code": "PERIO-FLAP",
        "name": "Periodontal Flap Surgery",
        "category": "Periodontics",
        "description": "Open flap debridement for deep periodontal pockets",
    },
    {
        "id": 12,
        "code": "XRAY-PA",
        "name": "Periapical Digital Radiograph (IOPA)",
        "category": "Diagnostic",
        "description": "High-resolution digital periapical sensor radiograph",
    },
    {
        "id": 13,
        "code": "XRAY-OPG",
        "name": "Panoramic Radiograph (OPG)",
        "category": "Diagnostic",
        "description": "Full mouth panoramic digital radiograph",
    },
    {
        "id": 14,
        "code": "XRAY-CBCT",
        "name": "Cone Beam CT (CBCT) Volumetric Scan",
        "category": "Diagnostic",
        "description": "3D volumetric maxillofacial CBCT imaging",
    },
]

MEDICINE_CATALOG: list[dict[str, str | int]] = [
    {
        "id": 1,
        "name": "Amoxicillin 500mg",
        "generic_name": "Amoxicillin",
        "dosage_form": "Capsule",
        "default_dosage": "500 mg",
        "instructions": "Take 1 capsule 3 times daily for 5-7 days after meals.",
    },
    {
        "id": 2,
        "name": "Augmentin 625mg",
        "generic_name": "Amoxicillin + Clavulanic Acid",
        "dosage_form": "Tablet",
        "default_dosage": "625 mg",
        "instructions": "Take 1 tablet twice daily after food for 5 days.",
    },
    {
        "id": 3,
        "name": "Ibuprofen 400mg",
        "generic_name": "Ibuprofen",
        "dosage_form": "Tablet",
        "default_dosage": "400 mg",
        "instructions": "Take 1 tablet every 8 hours after food as needed for pain/swelling.",
    },
    {
        "id": 4,
        "name": "Paracetamol 650mg",
        "generic_name": "Acetaminophen",
        "dosage_form": "Tablet",
        "default_dosage": "650 mg",
        "instructions": "Take 1 tablet every 6 hours for mild pain or fever.",
    },
    {
        "id": 5,
        "name": "Ketorolac 10mg",
        "generic_name": "Ketorolac Tromethamine",
        "dosage_form": "Tablet",
        "default_dosage": "10 mg",
        "instructions": "Take 1 tablet every 6-8 hours for severe acute pain (max 5 days).",
    },
    {
        "id": 6,
        "name": "Metronidazole 400mg",
        "generic_name": "Metronidazole",
        "dosage_form": "Tablet",
        "default_dosage": "400 mg",
        "instructions": "Take 1 tablet 3 times daily after meals for anaerobic infection.",
    },
    {
        "id": 7,
        "name": "Chlorhexidine 0.2% Mouthwash",
        "generic_name": "Chlorhexidine Gluconate",
        "dosage_form": "Mouthwash",
        "default_dosage": "15 ml",
        "instructions": "Rinse mouth twice daily for 30-60 seconds after brushing for 7 days.",
    },
    {
        "id": 8,
        "name": "Triamcinolone Acetonide Oral Paste",
        "generic_name": "Triamcinolone",
        "dosage_form": "Gel",
        "default_dosage": "0.1%",
        "instructions": "Apply small dab to oral ulcer before bedtime.",
    },
    {
        "id": 9,
        "name": "Pantoprazole 40mg",
        "generic_name": "Pantoprazole",
        "dosage_form": "Tablet",
        "default_dosage": "40 mg",
        "instructions": "Take 1 tablet 30 minutes before breakfast for gastric protection.",
    },
    {
        "id": 10,
        "name": "Pediatric Paracetamol Syrup 250mg/5ml",
        "generic_name": "Acetaminophen Suspension",
        "dosage_form": "Syrup",
        "default_dosage": "5 ml",
        "instructions": "Give weight-adjusted dose every 6 hours as needed for pediatric pain/fever.",
    },
]

APPOINTMENT_TYPES: list[dict[str, str | int]] = [
    {"id": 1, "name": "Routine Checkup & Consultation", "duration_minutes": 30, "color_code": "#10b981"},
    {"id": 2, "name": "Teeth Cleaning / Scaling", "duration_minutes": 45, "color_code": "#06b6d4"},
    {"id": 3, "name": "Filling / Restoration", "duration_minutes": 45, "color_code": "#3b82f6"},
    {"id": 4, "name": "Root Canal Treatment", "duration_minutes": 60, "color_code": "#8b5cf6"},
    {"id": 5, "name": "Extraction / Oral Surgery", "duration_minutes": 45, "color_code": "#ef4444"},
    {"id": 6, "name": "Crown Preparation & Fitting", "duration_minutes": 60, "color_code": "#f59e0b"},
    {"id": 7, "name": "Emergency Dental Care", "duration_minutes": 30, "color_code": "#dc2626"},
    {"id": 8, "name": "Periodontal Review & Recall", "duration_minutes": 30, "color_code": "#14b8a6"},
]
