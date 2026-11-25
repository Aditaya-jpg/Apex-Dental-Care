"""Multilingual clinical translations (English, Hindi Devanagari, Punjabi Gurmukhi) for PGI Dental."""

from __future__ import annotations

import re
from typing import Any

SUPPORTED_LANGUAGES = ("en", "hi", "pa")


def normalize_language(language: str | None) -> str:
    lang = (language or "en").strip().lower()
    return lang if lang in SUPPORTED_LANGUAGES else "en"


PRESCRIPTION_LABELS: dict[str, dict[str, str]] = {
    "en": {
        "clinic_subtitle": "Oral Health Sciences Centre, PGIMER Chandigarh",
        "prescription_title": "DIGITAL DENTAL PRESCRIPTION",
        "prescribing_doctor": "Prescribing Doctor",
        "reg_license": "Reg/License",
        "prescription_no": "Prescription #",
        "date": "Date",
        "language": "Language",
        "patient": "Patient",
        "cr_number": "CR / Code",
        "dob": "DOB",
        "phone": "Phone",
        "diagnosis": "Diagnosis / Clinical Summary",
        "medications_heading": "Rx MEDICATION & DOSAGE SCHEDULE",
        "col_num": "#",
        "col_medicine": "Medicine Name",
        "col_dosage": "Dosage",
        "col_frequency": "Frequency",
        "col_duration": "Duration",
        "col_instructions": "Timing & Instructions",
        "general_advice": "General Advice & Instructions",
        "care_instructions": "Care Instructions",
        "valid_note": "* Valid for 30 days from date of issue.",
        "keep_safe_note": "* Keep medications out of reach of children.",
        "signature_label": "Authorized PGI Doctor Signature",
    },
    "hi": {
        "clinic_subtitle": "मौखिक स्वास्थ्य विज्ञान केंद्र, पीजीआईएमईआर चंडीगढ़",
        "prescription_title": "डिजिटल दंत चिकित्सा पर्चा (प्रिस्क्रिप्शन)",
        "prescribing_doctor": "चिकित्सक (डॉक्टर)",
        "reg_license": "पंजीकरण संख्या",
        "prescription_no": "पर्चा संख्या",
        "date": "दिनांक",
        "language": "भाषा",
        "patient": "रोगी",
        "cr_number": "सीआर / कोड",
        "dob": "जन्म तिथि",
        "phone": "फ़ोन",
        "diagnosis": "निदान / नैदानिक सारांश",
        "medications_heading": "Rx दवाएं एवं खुराक तालिका",
        "col_num": "क्र.",
        "col_medicine": "दवा का नाम",
        "col_dosage": "खुराक",
        "col_frequency": "आवृत्ति",
        "col_duration": "अवधि",
        "col_instructions": "समय एवं निर्देश",
        "general_advice": "सामान्य सलाह एवं निर्देश",
        "care_instructions": "उपचार देखभाल निर्देश",
        "valid_note": "* जारी होने की तिथि से 30 दिनों तक मान्य।",
        "keep_safe_note": "* सभी दवाएं बच्चों की पहुंच से दूर रखें।",
        "signature_label": "अधिकृत पीजीआई चिकित्सक हस्ताक्षर",
    },
    "pa": {
        "clinic_subtitle": "ਮੌਖਿਕ ਸਿਹਤ ਵਿਗਿਆਨ ਕੇਂਦਰ, ਪੀਜੀਆਈਐਮਈਆਰ ਚੰਡੀਗੜ੍ਹ",
        "prescription_title": "ਡਿਜੀਟਲ ਦੰਦਾਂ ਦਾ ਪਰਚਾ (ਪ੍ਰਿਸਕ੍ਰਿਪਸ਼ਨ)",
        "prescribing_doctor": "ਡਾਕਟਰ",
        "reg_license": "ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਨੰ.",
        "prescription_no": "ਪਰਚਾ ਨੰ.",
        "date": "ਮਿਤੀ",
        "language": "ਭਾਸ਼ਾ",
        "patient": "ਮਰੀਜ਼",
        "cr_number": "ਸੀਆਰ / ਕੋਡ",
        "dob": "ਜਨਮ ਮਿਤੀ",
        "phone": "ਫ਼ੋਨ",
        "diagnosis": "ਜਾਂਚ / ਕਲੀਨਿਕਲ ਸਾਰ",
        "medications_heading": "Rx ਦਵਾਈਆਂ ਅਤੇ ਖੁਰਾਕ ਸੂਚੀ",
        "col_num": "ਨੰ.",
        "col_medicine": "ਦਵਾਈ ਦਾ ਨਾਮ",
        "col_dosage": "ਖੁਰਾਕ",
        "col_frequency": "ਸਮਾਂ-ਅੰਤਰਾਲ",
        "col_duration": "ਮਿਆਦ",
        "col_instructions": "ਸਮਾਂ ਅਤੇ ਹਦਾਇਤਾਂ",
        "general_advice": "ਆਮ ਸਲਾਹ ਅਤੇ ਹਦਾਇਤਾਂ",
        "care_instructions": "ਇਲਾਜ ਸੰਭਾਲ ਹਦਾਇਤਾਂ",
        "valid_note": "* ਜਾਰੀ ਕਰਨ ਦੀ ਮਿਤੀ ਤੋਂ 30 ਦਿਨਾਂ ਲਈ ਵੈਧ।",
        "keep_safe_note": "* ਦਵਾਈਆਂ ਬੱਚਿਆਂ ਦੀ ਪਹੁੰਚ ਤੋਂ ਦੂਰ ਰੱਖੋ।",
        "signature_label": "ਅਧਿਕਾਰਤ ਪੀਜੀਆਈ ਡਾਕਟਰ ਦਸਤਖਤ",
    },
}

TIMING_TRANSLATIONS: dict[str, dict[str, str]] = {
    "after food": {
        "en": "After Food",
        "hi": "भोजन के बाद",
        "pa": "ਭੋਜਨ ਤੋਂ ਬਾਅਦ",
    },
    "after meals": {
        "en": "After Meals",
        "hi": "भोजन के बाद",
        "pa": "ਭੋਜਨ ਤੋਂ ਬਾਅਦ",
    },
    "before food": {
        "en": "Before Food",
        "hi": "भोजन से पहले",
        "pa": "ਭੋਜਨ ਤੋਂ ਪਹਿਲਾਂ",
    },
    "before breakfast": {
        "en": "Before Breakfast",
        "hi": "नाश्ते से पहले",
        "pa": "ਨਾਸ਼ਤੇ ਤੋਂ ਪਹਿਲਾਂ",
    },
    "with food": {
        "en": "With Food",
        "hi": "भोजन के साथ",
        "pa": "ਭੋਜਨ ਦੇ ਨਾਲ",
    },
    "before bedtime": {
        "en": "Before Bedtime",
        "hi": "सोने से पहले",
        "pa": "ਸੌਣ ਤੋਂ ਪਹਿਲਾਂ",
    },
    "after brushing": {
        "en": "After Brushing",
        "hi": "ब्रश करने के बाद",
        "pa": "ਬਰੱਸ਼ ਕਰਨ ਤੋਂ ਬਾਅਦ",
    },
    "as needed (prn)": {
        "en": "As Needed (PRN)",
        "hi": "आवश्यकतानुसार",
        "pa": "ਲੋੜ ਅਨੁਸਾਰ",
    },
    "sos": {
        "en": "As Needed (SOS)",
        "hi": "जरूरत पड़ने पर",
        "pa": "ਲੋੜ ਪੈਣ ਤੇ",
    },
}

FREQUENCY_TRANSLATIONS: dict[str, dict[str, str]] = {
    "1-0-1": {
        "en": "1-0-1 (Morning & Night)",
        "hi": "1-0-1 (सुबह और रात)",
        "pa": "1-0-1 (ਸਵੇਰੇ ਅਤੇ ਰਾਤ)",
    },
    "1-1-1": {
        "en": "1-1-1 (Morning, Afternoon & Night)",
        "hi": "1-1-1 (सुबह, दोपहर और रात)",
        "pa": "1-1-1 (ਸਵੇਰੇ, ਦੁਪਹਿਰ ਅਤੇ ਰਾਤ)",
    },
    "1-0-0": {
        "en": "1-0-0 (Once Daily Morning)",
        "hi": "1-0-0 (केवल सुबह)",
        "pa": "1-0-0 (ਸਿਰਫ਼ ਸਵੇਰੇ)",
    },
    "0-0-1": {
        "en": "0-0-1 (Once Daily Night)",
        "hi": "0-0-1 (केवल रात को)",
        "pa": "0-0-1 (ਸਿਰਫ਼ ਰਾਤ ਨੂੰ)",
    },
    "0-1-0": {
        "en": "0-1-0 (Once Daily Afternoon)",
        "hi": "0-1-0 (केवल दोपहर में)",
        "pa": "0-1-0 (ਸਿਰਫ਼ ਦੁਪਹਿਰ ਨੂੰ)",
    },
    "sos": {
        "en": "SOS (As needed for pain)",
        "hi": "SOS (दर्द होने पर आवश्यकतानुसार)",
        "pa": "SOS (ਦਰਦ ਹੋਣ ਤੇ ਲੋੜ ਅਨੁਸਾਰ)",
    },
    "twice daily": {
        "en": "Twice daily",
        "hi": "दिन में दो बार",
        "pa": "ਦਿਨ ਵਿੱਚ ਦੋ ਵਾਰ",
    },
    "three times daily": {
        "en": "Three times daily",
        "hi": "दिन में तीन बार",
        "pa": "ਦਿਨ ਵਿੱਚ ਤਿੰਨ ਵਾਰ",
    },
    "once daily": {
        "en": "Once daily",
        "hi": "दिन में एक बार",
        "pa": "ਦਿਨ ਵਿੱਚ ਇੱਕ ਵਾਰ",
    },
}

DURATION_UNITS: dict[str, dict[str, str]] = {
    "day": {"en": "day", "hi": "दिन", "pa": "ਦਿਨ"},
    "days": {"en": "days", "hi": "दिन", "pa": "ਦਿਨ"},
    "week": {"en": "week", "hi": "सप्ताह", "pa": "ਹਫ਼ਤਾ"},
    "weeks": {"en": "weeks", "hi": "सप्ताह", "pa": "ਹਫ਼ਤੇ"},
    "month": {"en": "month", "hi": "महीना", "pa": "ਮਹੀਨਾ"},
    "months": {"en": "months", "hi": "महीने", "pa": "ਮਹੀਨੇ"},
}

PRE_APPOINTMENT_INSTRUCTIONS: list[dict[str, Any]] = [
    {
        "key": "routine_checkup",
        "category": "pre_appointment",
        "title": {
            "en": "Routine Dental Checkup Preparation",
            "hi": "नियमित दंत जांच की तैयारी",
            "pa": "ਨਿਯਮਤ ਦੰਦਾਂ ਦੀ ਜਾਂਚ ਦੀ ਤਿਆਰੀ",
        },
        "text": {
            "en": "Brush and floss gently before your appointment. Arrive 15 minutes early at PGI Dental Registration Desk.",
            "hi": "अपॉइंटमेंट से पहले हल्के हाथ से ब्रश करें। पीजीआई दंत पंजीकरण काउंटर पर 15 मिनट पहले पहुंचें।",
            "pa": "ਮੁਲਾਕਾਤ ਤੋਂ ਪਹਿਲਾਂ ਹਲਕੇ ਹੱਥ ਨਾਲ ਬਰੱਸ਼ ਕਰੋ। ਪੀਜੀਆਈ ਦੰਦ ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਕਾਊਂਟਰ ਤੇ 15 ਮਿੰਟ ਪਹਿਲਾਂ ਪਹੁੰਚੋ।",
        },
    },
    {
        "key": "surgical_extraction_prep",
        "category": "pre_appointment",
        "title": {
            "en": "Oral Surgery / Extraction Preparation",
            "hi": "दंत शल्य चिकित्सा / दांत निकालने से पहले निर्देश",
            "pa": "ਦੰਦਾਂ ਦੀ ਸਰਜਰੀ / ਦੰਦ ਕਢਵਾਉਣ ਤੋਂ ਪਹਿਲਾਂ ਹਦਾਇਤਾਂ",
        },
        "text": {
            "en": "Eat a light meal 1-2 hours before local anesthesia surgery. Take your routine blood pressure/diabetes medicines unless advised otherwise, and bring an attendant.",
            "hi": "लोकल एनेस्थीसिया सर्जरी से 1-2 घंटे पहले हल्का भोजन करें। डॉक्टर की सलाह के बिना बीपी या शुगर की नियमित दवा बंद न करें और साथ में एक परिजन अवश्य लाएं।",
            "pa": "ਲੋਕਲ ਅਨੱਸਥੀਸੀਆ ਸਰਜਰੀ ਤੋਂ 1-2 ਘੰਟੇ ਪਹਿਲਾਂ ਹਲਕਾ ਭੋਜਨ ਕਰੋ। ਡਾਕਟਰ ਦੀ ਸਲਾਹ ਤੋਂ ਬਿਨਾਂ ਬੀਪੀ ਜਾਂ ਸ਼ੂਗਰ ਦੀ ਨਿਯਮਤ ਦਵਾਈ ਨਾ ਰੋਕੋ ਅਤੇ ਨਾਲ ਇੱਕ ਸਹਾਇਕ ਜ਼ਰੂਰ ਲਿਆਓ।",
        },
    },
    {
        "key": "diabetic_hypertensive_check",
        "category": "pre_appointment",
        "title": {
            "en": "Diabetic & Hypertensive Pre-Visit Check",
            "hi": "मधुमेह एवं रक्तचाप रोगियों के लिए पूर्व-जांच निर्देश",
            "pa": "ਸ਼ੂਗਰ ਅਤੇ ਬਲੱਡ ਪ੍ਰੈਸ਼ਰ ਮਰੀਜ਼ਾਂ ਲਈ ਪਹਿਲਾਂ ਜਾਂਚ ਹਦਾਇਤਾਂ",
        },
        "text": {
            "en": "Carry your latest Fasting/PP Blood Sugar, HbA1c report, and current medication list. Do not skip morning insulin or BP tablets before your dental visit.",
            "hi": "अपनी ताजा ब्लड शुगर, एचबीए1सी रिपोर्ट और वर्तमान दवाओं की सूची साथ लाएं। अपॉइंटमेंट से पहले सुबह की शुगर या बीपी की दवा न छोड़ें।",
            "pa": "ਆਪਣੀ ਤਾਜ਼ਾ ਬਲੱਡ ਸ਼ੂਗਰ, ਐਚਬੀਏ1ਸੀ ਰਿਪੋਰਟ ਅਤੇ ਮੌਜੂਦਾ ਦਵਾਈਆਂ ਦੀ ਸੂਚੀ ਨਾਲ ਲਿਆਓ। ਮੁਲਾਕਾਤ ਤੋਂ ਪਹਿਲਾਂ ਸਵੇਰ ਦੀ ਸ਼ੂਗਰ ਜਾਂ ਬੀਪੀ ਦੀ ਦਵਾਈ ਨਾ ਛੱਡੋ।",
        },
    },
    {
        "key": "bring_cr_card_xrays",
        "category": "pre_appointment",
        "title": {
            "en": "Bring PGI CR Card & Previous Scans",
            "hi": "पीजीआई सीआर कार्ड और पुराने एक्स-रे साथ लाएं",
            "pa": "ਪੀਜੀਆਈ ਸੀਆਰ ਕਾਰਡ ਅਤੇ ਪੁਰਾਣੇ ਐਕਸ-ਰੇ ਨਾਲ ਲਿਆਓ",
        },
        "text": {
            "en": "Please carry your official PGI CR Number Card, previous OPG/IOPA X-rays, CBCT films, and earlier prescriptions to every visit.",
            "hi": "कृपया प्रत्येक विजिट पर अपना पीजीआई सीआर कार्ड, पुराने ओपीजी/एक्स-रे, सीबीसीटी रिपोर्ट और पिछला पर्चा अवश्य साथ लाएं।",
            "pa": "ਕਿਰਪਾ ਕਰਕੇ ਹਰ ਮੁਲਾਕਾਤ ਤੇ ਆਪਣਾ ਪੀਜੀਆਈ ਸੀਆਰ ਕਾਰਡ, ਪੁਰਾਣੇ ਓਪੀਜੀ/ਐਕਸ-ਰੇ, ਸੀਬੀਸੀਟੀ ਰਿਪੋਰਟ ਅਤੇ ਪਿਛਲਾ ਪਰਚਾ ਜ਼ਰੂਰ ਨਾਲ ਲਿਆਓ।",
        },
    },
]

POST_TREATMENT_INSTRUCTIONS: list[dict[str, Any]] = [
    {
        "key": "post_extraction",
        "category": "post_treatment",
        "title": {
            "en": "Post-Extraction Care Instructions",
            "hi": "दांत निकालने के बाद की देखभाल",
            "pa": "ਦੰਦ ਕਢਵਾਉਣ ਤੋਂ ਬਾਅਦ ਦੀ ਸੰਭਾਲ",
        },
        "text": {
            "en": "Bite firmly on the sterile gauze pack for 45 minutes. Do not spit, rinse vigorously, or use a straw for 24 hours. Eat soft cold foods and apply an ice pack externally.",
            "hi": "रुई की पट्टी को 45 मिनट तक हल्के दबाव से दबाकर रखें। 24 घंटे तक थूकें नहीं, जोर से कुल्ला न करें और स्ट्रॉ का उपयोग न करें। नरम व ठंडा भोजन लें तथा बाहर से बर्फ से सिकाई करें।",
            "pa": "ਰੂੰ ਦੀ ਗੱਦੀ ਨੂੰ 45 ਮਿੰਟ ਤੱਕ ਹਲਕੇ ਦਬਾਅ ਨਾਲ ਦਬਾ ਕੇ ਰੱਖੋ। 24 ਘੰਟੇ ਤੱਕ ਥੁੱਕੋ ਨਾ, ਜ਼ੋਰ ਨਾਲ ਕੁਰਲੀ ਨਾ ਕਰੋ ਅਤੇ ਸਟ੍ਰਾ ਦੀ ਵਰਤੋਂ ਨਾ ਕਰੋ। ਨਰਮ ਤੇ ਠੰਡਾ ਭੋਜਨ ਖਾਓ ਅਤੇ ਬਾਹਰੋਂ ਬਰਫ਼ ਨਾਲ ਸਿਕਾਈ ਕਰੋ।",
        },
    },
    {
        "key": "post_rct",
        "category": "post_treatment",
        "title": {
            "en": "Post-Root Canal Treatment (RCT) Care",
            "hi": "रूट कैनाल उपचार (आरसीटी) के बाद निर्देश",
            "pa": "ਰੂਟ ਕੈਨਾਲ ਇਲਾਜ (ਆਰਸੀਟੀ) ਤੋਂ ਬਾਅਦ ਹਦਾਇਤਾਂ",
        },
        "text": {
            "en": "Avoid chewing hard or sticky foods on the treated tooth until the permanent crown is placed. Mild soreness for 24-48 hours is normal; take prescribed medicines on schedule.",
            "hi": "स्थायी कैप (क्राउन) लगने तक उपचारित दांत की तरफ सख्त या चिपचिपा भोजन न चबाएं। 24-48 घंटे हल्का दर्द सामान्य है; निर्धारित दवाएं समय पर लें।",
            "pa": "ਪੱਕਾ ਕ੍ਰਾਊਨ ਲੱਗਣ ਤੱਕ ਇਲਾਜ ਕੀਤੇ ਦੰਦ ਵਾਲੇ ਪਾਸੇ ਸਖ਼ਤ ਜਾਂ ਚਿਪਚਿਪਾ ਭੋਜਨ ਨਾ ਚਬਾਓ। 24-48 ਘੰਟੇ ਹਲਕਾ ਦਰਦ ਆਮ ਗੱਲ ਹੈ; ਦਿੱਤੀਆਂ ਦਵਾਈਆਂ ਸਮੇਂ ਸਿਰ ਲਓ।",
        },
    },
    {
        "key": "post_scaling",
        "category": "post_treatment",
        "title": {
            "en": "Post-Scaling & Periodontal Cleaning Care",
            "hi": "दांतों की सफाई (स्केलिंग) के बाद देखभाल",
            "pa": "ਦੰਦਾਂ ਦੀ ਸਫਾਈ (ਸਕੇਲਿੰਗ) ਤੋਂ ਬਾਅਦ ਸੰਭਾਲ",
        },
        "text": {
            "en": "Avoid extremely hot, cold, or staining foods/beverages for 24 hours. Rinse gently with warm saline water twice daily and brush with a soft-bristle brush.",
            "hi": "24 घंटे तक बहुत गर्म, ठंडे या रंग छोड़ने वाले पेय पदार्थों से बचें। दिन में दो बार गुनगुने नमक वाले पानी से कुल्ला करें और मुलायम ब्रश का उपयोग करें।",
            "pa": "24 ਘੰਟੇ ਤੱਕ ਬਹੁਤ ਗਰਮ, ਠੰਡੇ ਜਾਂ ਦਾਗ਼ ਲਾਉਣ ਵਾਲੇ ਪੀਣ ਵਾਲੇ ਪਦਾਰਥਾਂ ਤੋਂ ਬਚੋ। ਦਿਨ ਵਿੱਚ ਦੋ ਵਾਰ ਕੋਸੇ ਨਮਕ ਵਾਲੇ ਪਾਣੀ ਨਾਲ ਕੁਰਲੀ ਕਰੋ ਅਤੇ ਨਰਮ ਬਰੱਸ਼ ਵਰਤੋ।",
        },
    },
    {
        "key": "post_oral_surgery",
        "category": "post_treatment",
        "title": {
            "en": "Post-Oral Surgery & Sutures Care",
            "hi": "मुख शल्य चिकित्सा और टांकों की देखभाल",
            "pa": "ਮੂੰਹ ਦੀ ਸਰਜਰੀ ਅਤੇ ਟਾਂਕਿਆਂ ਦੀ ਸੰਭਾਲ",
        },
        "text": {
            "en": "Keep the surgical site clean with gentle warm saline rinses starting 24 hours post-op. Complete your antibiotic course, avoid smoking/tobacco completely, and return for suture removal on the scheduled date.",
            "hi": "सर्जरी के 24 घंटे बाद से हल्के गुनगुने नमक के पानी से सफाई रखें। एंटीबायोटिक दवा का पूरा कोर्स करें, तंबाकू व धूम्रपान बिल्कुल न करें और तय तिथि पर टांके कटवाने आएं।",
            "pa": "ਸਰਜਰੀ ਦੇ 24 ਘੰਟੇ ਬਾਅਦ ਤੋਂ ਹਲਕੇ ਕੋਸੇ ਨਮਕ ਵਾਲੇ ਪਾਣੀ ਨਾਲ ਸਫਾਈ ਰੱਖੋ। ਐਂਟੀਬਾਇਓਟਿਕ ਦਵਾਈ ਦਾ ਪੂਰਾ ਕੋਰਸ ਕਰੋ, ਤੰਬਾਕੂ ਅਤੇ ਸਿਗਰਟਨੋਸ਼ੀ ਬਿਲਕੁਲ ਨਾ ਕਰੋ ਅਤੇ ਨਿਰਧਾਰਤ ਮਿਤੀ ਤੇ ਟਾਂਕੇ ਕਟਵਾਉਣ ਆਓ।",
        },
    },
]

APPOINTMENT_NOTIFICATIONS: dict[str, dict[str, str]] = {
    "confirmed": {
        "en": "PGI Dental: Dear {patient_name}, your appointment with {doctor_name} on {date} at {time} ({operatory}) is confirmed. Pre-visit tip: {pre_tip}",
        "hi": "पीजीआई डेंटल: प्रिय {patient_name}, {doctor_name} के साथ आपकी अपॉइंटमेंट {date} को {time} बजे ({operatory}) निश्चित हुई है। निर्देश: {pre_tip}",
        "pa": "ਪੀਜੀਆਈ ਡੈਂਟਲ: ਪਿਆਰੇ {patient_name}, {doctor_name} ਨਾਲ ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ {date} ਨੂੰ {time} ਵਜੇ ({operatory}) ਪੱਕੀ ਹੋ ਗਈ ਹੈ। ਹਦਾਇਤ: {pre_tip}",
    },
    "updated": {
        "en": "PGI Dental: Dear {patient_name}, your appointment has been updated to {date} at {time} with {doctor_name} ({operatory}).",
        "hi": "पीजीआई डेंटल: प्रिय {patient_name}, आपकी अपॉइंटमेंट का समय बदलकर {date} को {time} बजे ({doctor_name}, {operatory}) कर दिया गया है।",
        "pa": "ਪੀਜੀਆਈ ਡੈਂਟਲ: ਪਿਆਰੇ {patient_name}, ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ ਦਾ ਸਮਾਂ ਬਦਲ ਕੇ {date} ਨੂੰ {time} ਵਜੇ ({doctor_name}, {operatory}) ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ।",
    },
    "cancelled": {
        "en": "PGI Dental: Dear {patient_name}, your appointment scheduled on {date} at {time} has been cancelled. {reason_text}Please contact PGI Dental Desk to reschedule.",
        "hi": "पीजीआई डेंटल: प्रिय {patient_name}, {date} को {time} बजे वाली आपकी अपॉइंटमेंट रद्द कर दी गई है। {reason_text}नई तिथि के लिए पीजीआई डेंटल डेस्क से संपर्क करें।",
        "pa": "ਪੀਜੀਆਈ ਡੈਂਟਲ: ਪਿਆਰੇ {patient_name}, {date} ਨੂੰ {time} ਵਜੇ ਵਾਲੀ ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ ਰੱਦ ਕਰ ਦਿੱਤੀ ਗਈ ਹੈ। {reason_text}ਨਵੀਂ ਮਿਤੀ ਲਈ ਪੀਜੀਆਈ ਡੈਂਟਲ ਡੈਸਕ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।",
    },
    "missed_recall": {
        "en": "PGI Dental Recall: Dear {patient_name}, we noticed you missed your visit on {date}. Please visit or call PGI Dental Branch to resume your care safely.",
        "hi": "पीजीआई डेंटल रिकॉल: प्रिय {patient_name}, {date} को आपकी विजिट छूट गई थी। कृपया अपना उपचार जारी रखने के लिए पीजीआई डेंटल ब्रांच में संपर्क करें।",
        "pa": "ਪੀਜੀਆਈ ਡੈਂਟਲ ਰੀਕਾਲ: ਪਿਆਰੇ {patient_name}, {date} ਨੂੰ ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ ਰਹਿ ਗਈ ਸੀ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਇਲਾਜ ਜਾਰੀ ਰੱਖਣ ਲਈ ਪੀਜੀਆਈ ਡੈਂਟਲ ਬ੍ਰਾਂਚ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।",
    },
    "recall_due": {
        "en": "PGI Dental Recall: Dear {patient_name}, your {recall_title} is due on {date}. Please visit PGI Dental Branch with your CR Card.",
        "hi": "पीजीआई डेंटल रिकॉल: प्रिय {patient_name}, आपकी {recall_title} की जांच {date} को देय है। कृपया अपने सीआर कार्ड के साथ पीजीआई डेंटल पधारें।",
        "pa": "ਪੀਜੀਆਈ ਡੈਂਟਲ ਰੀਕਾਲ: ਪਿਆਰੇ {patient_name}, ਤੁਹਾਡੀ {recall_title} ਦੀ ਜਾਂਚ {date} ਨੂੰ ਨਿਰਧਾਰਤ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੇ ਸੀਆਰ ਕਾਰਡ ਸਮੇਤ ਪੀਜੀਆਈ ਡੈਂਟਲ ਪਹੁੰਚੋ।",
    },
}

PREVENTIVE_CARE_TEMPLATES: dict[str, dict[str, Any]] = {
    "pediatric_hygiene": {
        "title": {
            "en": "Pediatric Oral Hygiene & Fluoride Care",
            "hi": "बाल दंत स्वच्छता एवं फ्लोराइड देखभाल",
            "pa": "ਬੱਚਿਆਂ ਦੀ ਦੰਦ ਸਫਾਈ ਅਤੇ ਫਲੋਰਾਈਡ ਸੰਭਾਲ",
        },
        "message": {
            "en": "Supervise brushing twice daily with a pea-sized fluoride toothpaste, limit sugary snacks, and schedule 6-month pediatric dental checkups.",
            "hi": "बच्चे को दिन में दो बार मटर के दाने बराबर फ्लोराइड टूथपेस्ट से ब्रश करवाएं, मीठे स्नैक्स कम दें और हर 6 महीने में जांच करवाएं।",
            "pa": "ਬੱਚੇ ਨੂੰ ਦਿਨ ਵਿੱਚ ਦੋ ਵਾਰ ਮਟਰ ਦੇ ਦਾਣੇ ਜਿੰਨੇ ਫਲੋਰਾਈਡ ਟੂਥਪੇਸਟ ਨਾਲ ਬਰੱਸ਼ ਕਰਵਾਓ, ਮਿੱਠੇ ਸਨੈਕਸ ਘਟਾਓ ਅਤੇ ਹਰ 6 ਮਹੀਨੇ ਬਾਅਦ ਜਾਂਚ ਕਰਵਾਓ।",
        },
    },
    "geriatric_oral_care": {
        "title": {
            "en": "Senior & Denture Oral Care",
            "hi": "वरिष्ठ नागरिक एवं डेंचर (नकली दांत) देखभाल",
            "pa": "ਬਜ਼ੁਰਗਾਂ ਅਤੇ ਡੈਂਚਰ (ਨਕਲੀ ਦੰਦਾਂ) ਦੀ ਸੰਭਾਲ",
        },
        "message": {
            "en": "Keep mouth hydrated, clean dentures daily with a soft denture brush, remove dentures overnight, and visit PGI if any sore spots appear.",
            "hi": "मुंह को सूखने न दें, डेंचर को रोजाना मुलायम ब्रश से साफ करें, रात को सोते समय डेंचर उतारकर पानी में रखें और किसी भी छाले पर तुरंत जांच कराएं।",
            "pa": "ਮੂੰਹ ਨੂੰ ਸੁੱਕਣ ਨਾ ਦਿਓ, ਡੈਂਚਰ ਨੂੰ ਰੋਜ਼ਾਨਾ ਨਰਮ ਬਰੱਸ਼ ਨਾਲ ਸਾਫ਼ ਕਰੋ, ਰਾਤ ਨੂੰ ਸੌਣ ਵੇਲੇ ਡੈਂਚਰ ਉਤਾਰ ਕੇ ਪਾਣੀ ਵਿੱਚ ਰੱਖੋ ਅਤੇ ਕਿਸੇ ਵੀ ਜ਼ਖ਼ਮ ਤੇ ਤੁਰੰਤ ਜਾਂਚ ਕਰਵਾਓ।",
        },
    },
    "diabetic_gum_care": {
        "title": {
            "en": "Diabetic Gum & Infection Prevention",
            "hi": "मधुमेह रोगियों के लिए मसूड़ों की देखभाल",
            "pa": "ਸ਼ੂਗਰ ਮਰੀਜ਼ਾਂ ਲਈ ਮਸੂੜਿਆਂ ਦੀ ਸੰਭਾਲ",
        },
        "message": {
            "en": "Diabetes increases gum infection risk. Maintain HbA1c control, floss daily, and complete periodontal maintenance visits every 3 months.",
            "hi": "मधुमेह से मसूड़ों के संक्रमण का खतरा बढ़ता है। ब्लड शुगर नियंत्रित रखें, रोजाना फ्लॉस करें और हर 3 महीने में मसूड़ों की जांच कराएं।",
            "pa": "ਸ਼ੂਗਰ ਨਾਲ ਮਸੂੜਿਆਂ ਦੀ ਇਨਫੈਕਸ਼ਨ ਦਾ ਖ਼ਤਰਾ ਵਧਦਾ ਹੈ। ਬਲੱਡ ਸ਼ੂਗਰ ਕਾਬੂ ਵਿੱਚ ਰੱਖੋ, ਰੋਜ਼ਾਨਾ ਫਲੌਸ ਕਰੋ ਅਤੇ ਹਰ 3 ਮਹੀਨੇ ਬਾਅਦ ਮਸੂੜਿਆਂ ਦੀ ਜਾਂਚ ਕਰਵਾਓ।",
        },
    },
    "hypertension_oral_care": {
        "title": {
            "en": "Hypertension & Cardiac Dental Precautions",
            "hi": "उच्च रक्तचाप रोगियों के लिए दंत सावधानियां",
            "pa": "ਹਾਈ ਬਲੱਡ ਪ੍ਰੈਸ਼ਰ ਮਰੀਜ਼ਾਂ ਲਈ ਦੰਦਾਂ ਦੀਆਂ ਸਾਵਧਾਨੀਆਂ",
        },
        "message": {
            "en": "Take morning blood pressure medicines regularly, avoid sudden standing after dental chair recline, and always inform your dentist about blood thinners.",
            "hi": "सुबह की रक्तचाप की दवा नियमित लें और दांत के डॉक्टर को हमेशा अपनी ब्लड थिनर दवाओं की जानकारी दें।",
            "pa": "ਸਵੇਰ ਦੀ ਬਲੱਡ ਪ੍ਰੈਸ਼ਰ ਦੀ ਦਵਾਈ ਨਿਯਮਤ ਲਓ ਅਤੇ ਦੰਦਾਂ ਦੇ ਡਾਕਟਰ ਨੂੰ ਹਮੇਸ਼ਾ ਆਪਣੀਆਂ ਖੂਨ ਪਤਲਾ ਕਰਨ ਵਾਲੀਆਂ ਦਵਾਈਆਂ ਬਾਰੇ ਦੱਸੋ।",
        },
    },
    "tobacco_cessation": {
        "title": {
            "en": "Tobacco & Smoking Cessation Oral Health Alert",
            "hi": "तंबाकू एवं धूम्रपान त्याग परामर्श",
            "pa": "ਤੰਬਾਕੂ ਅਤੇ ਸਿਗਰਟਨੋਸ਼ੀ ਛੱਡਣ ਬਾਰੇ ਸਲਾਹ",
        },
        "message": {
            "en": "Tobacco and smoking delay surgical healing and severely raise oral cancer and gum loss risk. PGI Oral Medicine offers cessation support and screening.",
            "hi": "तंबाकू और धूम्रपान से घाव भरने में देरी होती है तथा मसूड़ों व मुख कैंसर का खतरा बढ़ता है। सहायता के लिए पीजीआई ओरल मेडिसिन विभाग से मिलें।",
            "pa": "ਤੰਬਾਕੂ ਅਤੇ ਸਿਗਰਟਨੋਸ਼ੀ ਨਾਲ ਜ਼ਖ਼ਮ ਭਰਨ ਵਿੱਚ ਦੇਰੀ ਹੁੰਦੀ ਹੈ ਅਤੇ ਮਸੂੜਿਆਂ ਤੇ ਮੂੰਹ ਦੇ ਕੈਂਸਰ ਦਾ ਖ਼ਤਰਾ ਵਧਦਾ ਹੈ। ਮਦਦ ਲਈ ਪੀਜੀਆਈ ਓਰਲ ਮੈਡੀਸਿਨ ਵਿਭਾਗ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।",
        },
    },
    "bruxism_nightguard": {
        "title": {
            "en": "Bruxism (Teeth Grinding) Protection",
            "hi": "दांत पीसने (ब्रक्सिज्म) से बचाव निर्देश",
            "pa": "ਦੰਦ ਪੀਸਣ (ਬ੍ਰਕਸਿਜ਼ਮ) ਤੋਂ ਬਚਾਅ ਹਦਾਇਤਾਂ",
        },
        "message": {
            "en": "Avoid clenching during the day, reduce evening caffeine, perform warm jaw compresses, and wear your custom nightguard consistently.",
            "hi": "दिन में दांत भींचने से बचें, शाम को कैफीन कम लें, जबड़े पर हल्की गर्म सिकाई करें और डॉक्टर द्वारा दिया नाइटगार्ड नियमित पहनें।",
            "pa": "ਦਿਨ ਵੇਲੇ ਦੰਦ ਭੀਚਣ ਤੋਂ ਬਚੋ, ਸ਼ਾਮ ਨੂੰ ਕੈਫੀਨ ਘਟਾਓ, ਜਬਾੜੇ ਤੇ ਹਲਕੀ ਗਰਮ ਸਿਕਾਈ ਕਰੋ ਅਤੇ ਡਾਕਟਰ ਵੱਲੋਂ ਦਿੱਤਾ ਨਾਈਟਗਾਰਡ ਨਿਯਮਤ ਪਾਓ।",
        },
    },
    "periodontal_maintenance": {
        "title": {
            "en": "Periodontal Gum Health Maintenance",
            "hi": "मसूड़ों की सुरक्षा एवं पेरियोडोंटल देखभाल",
            "pa": "ਮਸੂੜਿਆਂ ਦੀ ਸੁਰੱਖਿਆ ਅਤੇ ਪੈਰੀਓਡੋਂਟਲ ਸੰਭਾਲ",
        },
        "message": {
            "en": "Use Modified Bass brushing technique with an extra-soft brush, clean interdental spaces daily, and keep your 90-day periodontal review.",
            "hi": "मुलायम ब्रश से सही तकनीक से ब्रश करें, दांतों के बीच की सफाई रखें और 90 दिन के पेरियोडोंटल रिव्यू पर अवश्य आएं।",
            "pa": "ਨਰਮ ਬਰੱਸ਼ ਨਾਲ ਸਹੀ ਤਰੀਕੇ ਨਾਲ ਬਰੱਸ਼ ਕਰੋ, ਦੰਦਾਂ ਦੇ ਵਿਚਕਾਰ ਦੀ ਸਫਾਈ ਰੱਖੋ ਅਤੇ 90 ਦਿਨਾਂ ਦੀ ਪੈਰੀਓਡੋਂਟਲ ਜਾਂਚ ਤੇ ਜ਼ਰੂਰ ਆਓ।",
        },
    },
    "pregnancy_oral_care": {
        "title": {
            "en": "Pregnancy Oral Health Guidance",
            "hi": "गर्भावस्था में मौखिक स्वास्थ्य देखभाल",
            "pa": "ਗਰਭ ਅਵਸਥਾ ਵਿੱਚ ਦੰਦਾਂ ਅਤੇ ਮੂੰਹ ਦੀ ਸੰਭਾਲ",
        },
        "message": {
            "en": "Hormonal changes increase pregnancy gingivitis. Brush twice daily, rinse with plain water after morning sickness, and inform your dentist of your trimester.",
            "hi": "गर्भावस्था में मसूड़ों की सूजन बढ़ सकती है। दिन में दो बार ब्रश करें, उल्टी के बाद सादे पानी से कुल्ला करें और डॉक्टर को गर्भावस्था के महीने की जानकारी दें।",
            "pa": "ਗਰਭ ਅਵਸਥਾ ਵਿੱਚ ਮਸੂੜਿਆਂ ਦੀ ਸੋਜ ਵਧ ਸਕਦੀ ਹੈ। ਦਿਨ ਵਿੱਚ ਦੋ ਵਾਰ ਬਰੱਸ਼ ਕਰੋ, ਉਲਟੀ ਤੋਂ ਬਾਅਦ ਸਾਦੇ ਪਾਣੀ ਨਾਲ ਕੁਰਲੀ ਕਰੋ ਅਤੇ ਡਾਕਟਰ ਨੂੰ ਗਰਭ ਅਵਸਥਾ ਦੇ ਮਹੀਨੇ ਬਾਰੇ ਦੱਸੋ।",
        },
    },
    "caries_prevention": {
        "title": {
            "en": "Cavity & Enamel Decay Prevention",
            "hi": "दंत क्षय (कैविटी) से बचाव निर्देश",
            "pa": "ਦੰਦ ਖਰਾਬ ਹੋਣ (ਕੈਵਿਟੀ) ਤੋਂ ਬਚਾਅ ਹਦਾਇਤਾਂ",
        },
        "message": {
            "en": "Brush with fluoride toothpaste before sleep, rinse your mouth with water after every sweet snack, and avoid frequent sugary drinks.",
            "hi": "सोने से पहले फ्लोराइड टूथपेस्ट से ब्रश जरूर करें, हर मीठे भोजन के बाद पानी से कुल्ला करें और मीठे पेय कम लें।",
            "pa": "ਸੌਣ ਤੋਂ ਪਹਿਲਾਂ ਫਲੋਰਾਈਡ ਟੂਥਪੇਸਟ ਨਾਲ ਬਰੱਸ਼ ਜ਼ਰੂਰ ਕਰੋ, ਹਰ ਮਿੱਠੇ ਭੋਜਨ ਤੋਂ ਬਾਅਦ ਪਾਣੀ ਨਾਲ ਕੁਰਲੀ ਕਰੋ ਅਤੇ ਮਿੱਠੇ ਪੀਣ ਵਾਲੇ ਪਦਾਰਥ ਘਟਾਓ।",
        },
    },
    "orthodontic_care": {
        "title": {
            "en": "Orthodontic Appliance & Hygiene Care",
            "hi": "ब्रेसेस एवं ऑर्थोडोंटिक स्वच्छता निर्देश",
            "pa": "ਬ੍ਰੇਸਿਜ਼ ਅਤੇ ਆਰਥੋਡੋਂਟਿਕ ਸਫਾਈ ਹਦਾਇਤਾਂ",
        },
        "message": {
            "en": "Clean carefully around brackets after every meal using an interdental brush and avoid hard, crunchy, or sticky foods.",
            "hi": "हर भोजन के बाद इंटरडेंटल ब्रश से ब्रेसेस के आसपास अच्छी तरह सफाई करें और सख्त व चिपचिपे खाद्य पदार्थ न खाएं।",
            "pa": "ਹਰ ਭੋਜਨ ਤੋਂ ਬਾਅਦ ਇੰਟਰਡੈਂਟਲ ਬਰੱਸ਼ ਨਾਲ ਬ੍ਰੇਸਿਜ਼ ਦੇ ਆਲੇ-ਦੁਆਲੇ ਚੰਗੀ ਤਰ੍ਹਾਂ ਸਫਾਈ ਕਰੋ ਅਤੇ ਸਖ਼ਤ ਜਾਂ ਚਿਪਚਿਪੇ ਭੋਜਨ ਤੋਂ ਬਚੋ।",
        },
    },
    "brushing_hygiene": {
        "title": {
            "en": "Daily Oral Hygiene Improvement",
            "hi": "दैनिक मौखिक स्वच्छता सुधार निर्देश",
            "pa": "ਰੋਜ਼ਾਨਾ ਦੰਦ ਸਫਾਈ ਸੁਧਾਰ ਹਦਾਇਤਾਂ",
        },
        "message": {
            "en": "Upgrade to brushing twice daily for 2 full minutes (morning and bedtime) and clean your tongue gently to prevent plaque buildup.",
            "hi": "सुबह और रात सोने से पहले पूरे 2 मिनट तक ब्रश करने की आदत अपनाएं और जीभ की हल्की सफाई नियमित करें।",
            "pa": "ਸਵੇਰੇ ਅਤੇ ਰਾਤ ਸੌਣ ਤੋਂ ਪਹਿਲਾਂ ਪੂਰੇ 2 ਮਿੰਟ ਤੱਕ ਬਰੱਸ਼ ਕਰਨ ਦੀ ਆਦਤ ਪਾਓ ਅਤੇ ਜੀਭ ਦੀ ਹਲਕੀ ਸਫਾਈ ਨਿਯਮਤ ਕਰੋ।",
        },
    },
}


def get_prescription_labels(language: str | None) -> dict[str, str]:
    lang = normalize_language(language)
    return PRESCRIPTION_LABELS[lang]


def translate_duration(duration: str, language: str) -> str:
    lang = normalize_language(language)
    if lang == "en" or not duration:
        return duration

    def _replace(match: re.Match[str]) -> str:
        word = match.group(0).lower()
        return DURATION_UNITS.get(word, {}).get(lang, match.group(0))

    return re.sub(r"\b(days?|weeks?|months?)\b", _replace, duration, flags=re.IGNORECASE)


def localize_medication_item(item: dict[str, Any], language: str | None) -> str:
    """Build localized medication schedule instruction string for EN / HI / PA."""
    lang = normalize_language(language)
    timing = (item.get("timing") or "After Food").strip()
    frequency = (item.get("frequency") or "").strip()
    duration = (item.get("duration") or "").strip()
    base_instr = (item.get("instructions") or "").strip()

    if lang == "en":
        parts = [p for p in [frequency, timing, duration, base_instr] if p]
        return " | ".join(parts)

    loc_timing = TIMING_TRANSLATIONS.get(timing.lower(), {}).get(lang, timing)
    loc_freq = FREQUENCY_TRANSLATIONS.get(frequency.lower(), {}).get(lang, frequency)
    loc_dur = translate_duration(duration, lang)

    parts = [p for p in [loc_freq, loc_timing, loc_dur] if p]
    if base_instr:
        parts.append(base_instr)
    return " • ".join(parts)


def get_instructions_library(language: str | None = "en") -> dict[str, Any]:
    lang = normalize_language(language)
    pre = [
        {
            "key": entry["key"],
            "category": entry["category"],
            "title": entry["title"][lang],
            "text": entry["text"][lang],
            "translations": entry["text"],
        }
        for entry in PRE_APPOINTMENT_INSTRUCTIONS
    ]
    post = [
        {
            "key": entry["key"],
            "category": entry["category"],
            "title": entry["title"][lang],
            "text": entry["text"][lang],
            "translations": entry["text"],
        }
        for entry in POST_TREATMENT_INSTRUCTIONS
    ]
    return {
        "language": lang,
        "pre_appointment": pre,
        "post_treatment": post,
    }


def lookup_instruction(instruction_key: str, language: str | None = "en") -> tuple[str, str, str] | None:
    """Return (category, localized_title, localized_text) for an instruction key, or None."""
    lang = normalize_language(language)
    for entry in PRE_APPOINTMENT_INSTRUCTIONS + POST_TREATMENT_INSTRUCTIONS:
        if entry["key"] == instruction_key:
            return entry["category"], entry["title"][lang], entry["text"][lang]
    return None


def render_appointment_message(
    event_kind: str,
    language: str | None,
    *,
    patient_name: str,
    doctor_name: str,
    appointment_date: str,
    start_time: str,
    operatory: str,
    reason: str | None = None,
    recall_title: str | None = None,
) -> tuple[str, str]:
    lang = normalize_language(language)
    pre_tip = PRE_APPOINTMENT_INSTRUCTIONS[3]["text"][lang]
    reason_text = f"({reason}) " if reason else ""

    tpl = APPOINTMENT_NOTIFICATIONS.get(event_kind, APPOINTMENT_NOTIFICATIONS["confirmed"]).get(
        lang, APPOINTMENT_NOTIFICATIONS["confirmed"]["en"]
    )
    body = tpl.format(
        patient_name=patient_name,
        doctor_name=doctor_name,
        date=appointment_date,
        time=start_time,
        operatory=operatory,
        pre_tip=pre_tip,
        reason_text=reason_text,
        recall_title=recall_title or "Dental Recall",
    )

    titles = {
        "confirmed": {
            "en": "Appointment Confirmed & Pre-Visit Instructions",
            "hi": "अपॉइंटमेंट पुष्टि एवं पूर्व-जांच निर्देश",
            "pa": "ਮੁਲਾਕਾਤ ਪੁਸ਼ਟੀ ਅਤੇ ਪਹਿਲਾਂ ਹਦਾਇਤਾਂ",
        },
        "updated": {
            "en": "Appointment Schedule Updated",
            "hi": "अपॉइंटमेंट समय अपडेट",
            "pa": "ਮੁਲਾਕਾਤ ਸਮਾਂ ਅੱਪਡੇਟ",
        },
        "cancelled": {
            "en": "Appointment Cancelled",
            "hi": "अपॉइंटमेंट रद्द सूचना",
            "pa": "ਮੁਲਾਕਾਤ ਰੱਦ ਸੂਚਨਾ",
        },
        "missed_recall": {
            "en": "Missed Appointment Recall Alert",
            "hi": "छूटी हुई अपॉइंटमेंट रिकॉल सूचना",
            "pa": "ਛੁੱਟੀ ਮੁਲਾਕਾਤ ਰੀਕਾਲ ਸੂਚਨਾ",
        },
        "recall_due": {
            "en": "Scheduled Dental Recall Reminder",
            "hi": "नियमित दंत रिकॉल अनुस्मारक",
            "pa": "ਨਿਯਮਤ ਦੰਦ ਰੀਕਾਲ ਯਾਦ-ਪੱਤਰ",
        },
    }
    title = titles.get(event_kind, titles["confirmed"])[lang]
    return title, body
