from datetime import date, timedelta


def test_invoice_creation_and_balance(client, receptionist_token):
    due = (date.today() + timedelta(days=14)).isoformat()
    payload = {
        "patient_id": 2,
        "due_date": due,
        "discount": 10.00,
        "tax": 0.00,
        "notes": "Testing invoice",
        "items": [
            {"description": "Dental Scaling", "unit_price": 90.00, "quantity": 1},
            {"description": "Fluoride Application", "unit_price": 40.00, "quantity": 1}
        ]
    }
    res = client.post("/api/v1/billing/invoices", json=payload, headers={"Authorization": f"Bearer {receptionist_token}"})
    assert res.status_code == 201
    data = res.json()
    assert float(data["subtotal"]) == 130.00
    assert float(data["discount"]) == 10.00
    assert float(data["total"]) == 120.00
    assert float(data["balance"]) == 120.00
    assert data["status"] == "unpaid"

def test_invoice_pdf_download(client, receptionist_token):
    res = client.get("/api/v1/billing/invoices/1/pdf", headers={"Authorization": f"Bearer {receptionist_token}"})
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF")
