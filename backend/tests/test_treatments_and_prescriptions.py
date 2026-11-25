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
