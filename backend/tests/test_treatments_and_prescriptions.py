def test_create_treatment_plan_and_items_no_billing(client, doctor_token):
    payload = {
        "patient_id": 2,
        "doctor_id": 1,
        "title": "Periodontal & Restoration Therapy",
        "notes": "Full mouth scaling and single filling",
        "treatments": [
            {"procedure_name": "Dental Prophylaxis & Scaling", "notes": "Complete scaling"},
            {"procedure_name": "Composite Resin Filling (1-2 surfaces)", "tooth_number": 36, "notes": "Occlusal filling"},
        ],
    }
    res = client.post("/api/v1/treatments/plans", json=payload, headers={"Authorization": f"Bearer {doctor_token}"})
    assert res.status_code == 201
    data = res.json()
    assert "estimated_total" not in data
    assert len(data["treatments"]) == 2
    assert "estimated_cost" not in data["treatments"][0]


def test_create_prescription_and_generate_pdf(client, doctor_token):
    payload = {
        "patient_id": 2,
        "doctor_id": 1,
        "diagnosis_summary": "Post-scaling oral hygiene regimen",
        "general_instructions": "Rinse twice daily",
        "language": "en",
        "items": [
            {
                "medicine_name": "Chlorhexidine 0.2% Mouthwash",
                "dosage": "15 ml",
                "frequency": "Twice daily",
                "duration": "7 days",
                "timing": "After Meals",
                "instructions": "Do not rinse with water immediately after",
            }
        ],
    }
    res = client.post("/api/v1/prescriptions", json=payload, headers={"Authorization": f"Bearer {doctor_token}"})
    assert res.status_code == 201
    rx_data = res.json()
    rx_id = rx_data["id"]
    assert rx_data["prescription_number"].startswith("RX-")

    pdf_res = client.get(f"/api/v1/prescriptions/{rx_id}/pdf", headers={"Authorization": f"Bearer {doctor_token}"})
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert len(pdf_res.content) > 500
    assert pdf_res.content.startswith(b"%PDF")


def test_dynamic_translation_for_arbitrary_instructions(client, doctor_token, monkeypatch):
    from app.i18n import translations

    translations._DYNAMIC_TRANSLATION_CACHE.clear()

    class FakeResponse:
        status_code = 200

        def __init__(self, text: str):
            self._text = text

        def json(self):
            return {"responseStatus": 200, "responseData": {"translatedText": self._text}}

    def fake_get(url, params=None, timeout=None):
        q = (params or {}).get("q", "")
        langpair = (params or {}).get("langpair", "")
        if langpair == "en|hi":
            return FakeResponse(f"[HI] {q}")
        if langpair == "en|pa":
            return FakeResponse(f"[PA] {q}")
        return FakeResponse(q)

    monkeypatch.setattr(translations.httpx, "get", fake_get)

    res = client.post(
        "/api/v1/prescriptions",
        json={
            "patient_id": 2,
            "doctor_id": 1,
            "diagnosis_summary": "Acute pulpitis",
            "general_instructions": "Report immediately if fever persists.",
            "language": "hi",
            "items": [
                {
                    "medicine_name": "Amoxicillin 500mg",
                    "dosage": "500mg",
                    "frequency": "1-0-1",
                    "duration": "5 days",
                    "timing": "After Food",
                    "instructions": "Take with full glass of water",
                }
            ],
        },
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert "[HI] Report immediately if fever persists." in (data.get("localized_summary") or "")
    assert "[HI] Take with full glass of water" in (data["items"][0].get("localized_instructions") or "")

    pdf_res = client.get(f"/api/v1/prescriptions/{data['id']}/pdf", headers={"Authorization": f"Bearer {doctor_token}"})
    assert pdf_res.status_code == 200
    assert pdf_res.content.startswith(b"%PDF")

    assert translations.translate_clinical_text("Avoid cold drinks", "pa") == "[PA] Avoid cold drinks"
