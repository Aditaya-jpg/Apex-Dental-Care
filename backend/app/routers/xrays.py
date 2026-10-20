import json
import logging
import os
from typing import Any, Dict, List, Optional
import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.database import get_db
from app.models.document import Document
from app.models.patient import Patient
from app.models.user import User
from app.schemas.xray import XrayEngineStatus, XraySample, XraySaveToPatientRequest
from app.security.dependencies import get_current_user, require_roles

logger = logging.getLogger("dental_app.xrays")

router = APIRouter(prefix="/xrays", tags=["X-Rays & Oral-3D Diagnostic Suite"])

ORAL3D_URL = os.environ.get("ORAL3D_URL", "http://127.0.0.1:8001")


@router.get("/status", response_model=XrayEngineStatus)
async def get_oral3d_status(
    current_user: User = Depends(require_roles("dentist", "admin")),
):
    """Check connectivity and neural model status of the Oral-3D AI reconstruction engine."""
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(f"{ORAL3D_URL}/api/status")
            if resp.status_code == 200:
                data = resp.json()
                return XrayEngineStatus(
                    status="online",
                    service="Oral-3D Teeth Structure Reconstruction Studio",
                    engine_url=ORAL3D_URL,
                    device=data.get("device", "cpu"),
                    checkpoint_loaded=data.get("checkpoint_loaded", True),
                    details=data,
                )
    except Exception as e:
        logger.warning(f"Oral-3D Engine offline at {ORAL3D_URL}: {e}")

    return XrayEngineStatus(
        status="standby",
        service="Oral-3D Teeth Structure Reconstruction Studio",
        engine_url=ORAL3D_URL,
        device="cpu",
        checkpoint_loaded=False,
        details={"note": "Oral-3D engine starting or on standby. Sample presets available."},
    )


@router.get("/samples", response_model=List[XraySample])
async def get_clinical_samples(
    current_user: User = Depends(get_current_user),
):
    """Retrieve verified clinical dental radiograph presets for diagnostic testing."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{ORAL3D_URL}/api/samples")
            if resp.status_code == 200:
                return resp.json().get("samples", [])
    except Exception:
        pass

    # Built-in fallbacks matching pre-processed clinical dataset
    return [
        XraySample(
            id="sample_1_adult_panoramic.png",
            title="Clinical Case 020: Adult Full Dentition",
            description="Diagnostic orthopantomogram (OPG) radiograph showing complete maxillary and mandibular arches.",
            type="Full Arch Panoramic X-Ray",
            thumbnail="/oral3d-static/samples/sample_1_adult_panoramic.png",
        ),
        XraySample(
            id="sample_2_high_contrast.png",
            title="Clinical Case 020-B: Enhanced Density",
            description="Adaptive histogram contrast-enhanced radiograph accentuating enamel crowns and alveolar crest.",
            type="High-Contrast Enhanced",
            thumbnail="/oral3d-static/samples/sample_2_high_contrast.png",
        ),
        XraySample(
            id="sample_3_orthodontic.png",
            title="Clinical Case 020-C: Orthodontic Dentition",
            description="Orthodontic evaluation scan highlighting coronal tooth alignment and interproximal relationships.",
            type="Orthodontic Dentition",
            thumbnail="/oral3d-static/samples/sample_3_orthodontic.png",
        ),
    ]


@router.post("/reconstruct")
async def reconstruct_3d_teeth(
    request: Request,
    file: Optional[UploadFile] = File(None),
    sample_id: Optional[str] = Form(None),
    patient_id: Optional[int] = Form(None),
    threshold: float = Form(-0.50),
    resolution: str = Form("fast"),
    save_to_patient: bool = Form(False),
    current_user: User = Depends(require_roles("dentist", "admin")),
    db: Session = Depends(get_db),
):
    """
    Execute Oral-3D neural network inference on 2D panoramic radiograph.
    Produces interactive 3D mesh (GLB/OBJ/STL), volumetric MPR cross-sections, and dental arch biometrics.
    Optionally stores result directly in the patient's medical records.
    """
    form_data = {
        "threshold": str(threshold),
        "resolution": resolution,
    }
    if sample_id:
        form_data["sample_id"] = sample_id

    files = None
    if file and file.filename:
        file_bytes = await file.read()
        files = {"file": (file.filename, file_bytes, file.content_type or "image/png")}

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{ORAL3D_URL}/api/reconstruct",
                data=form_data,
                files=files,
            )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Oral-3D Engine failed reconstruction: {resp.text}",
                )
            result = resp.json()

    except httpx.ConnectError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Oral-3D Reconstruction Service is not reachable on port 8001. Please ensure start.bat or oral_3d app.py is running.",
        )
    except Exception as e:
        logger.error(f"Reconstruction proxy error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    # Auto-save to patient record if requested
    if save_to_patient and patient_id:
        patient = db.query(Patient).filter(Patient.id == patient_id, Patient.is_deleted == False).first()
        if patient:
            session_id = result.get("session_id", "unknown")
            glb_url = result.get("model_urls", {}).get("glb", "")
            metrics = result.get("metrics", {})

            # Record Document for 3D Model
            doc = Document(
                patient_id=patient_id,
                document_type="xray",
                file_name=f"{session_id}_teeth.glb",
                original_file_name=f"Oral3D_Teeth_Model_{session_id}.glb",
                file_size=metrics.get("vertices", 0) * 32,
                mime_type="model/gltf-binary",
                file_path=glb_url,
                notes=json.dumps({
                    "type": "Oral-3D Reconstruction",
                    "session_id": session_id,
                    "metrics": metrics,
                    "model_urls": result.get("model_urls", {}),
                }),
                uploaded_by_user_id=current_user.id,
            )
            db.add(doc)
            db.commit()
            db.refresh(doc)

            log_audit_event(
                db=db,
                action="ORAL_3D_RECONSTRUCTION_SAVED",
                user=current_user,
                entity_name="Document",
                entity_id=str(doc.id),
                details={
                    "patient_id": patient_id,
                    "session_id": session_id,
                    "metrics": metrics,
                },
                request=request,
            )
            result["saved_document_id"] = doc.id

    return result


@router.get("/slice")
async def get_slice(
    session_id: str,
    plane: str = "axial",
    index: int = 80,
    current_user: User = Depends(require_roles("dentist", "admin")),
):
    """Dynamic Multi-Planar Reconstruction (MPR) slice navigation along axial, coronal, or sagittal planes."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{ORAL3D_URL}/api/slice",
                params={"session_id": session_id, "plane": plane, "index": index},
            )
            return Response(content=resp.content, media_type="image/png")
    except Exception as e:
        logger.error(f"Slice retrieval error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch volume slice from engine.")


@router.post("/save-to-patient")
async def save_reconstruction_to_patient(
    payload: XraySaveToPatientRequest,
    request: Request,
    current_user: User = Depends(require_roles("dentist", "admin")),
    db: Session = Depends(get_db),
):
    """Persist an existing 3D reconstruction session and biometrics into a patient's clinical file."""
    patient = db.query(Patient).filter(Patient.id == payload.patient_id, Patient.is_deleted == False).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    doc = Document(
        patient_id=payload.patient_id,
        document_type="xray",
        file_name=f"{payload.session_id}_teeth.glb",
        original_file_name=f"{payload.title} ({payload.session_id}).glb",
        file_size=payload.metrics.get("vertices", 0) * 32,
        mime_type="model/gltf-binary",
        file_path=payload.model_urls.get("glb", ""),
        notes=json.dumps({
            "clinical_notes": payload.notes,
            "session_id": payload.session_id,
            "metrics": payload.metrics,
            "model_urls": payload.model_urls,
            "input_scan_url": payload.input_scan_url,
        }),
        uploaded_by_user_id=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    log_audit_event(
        db=db,
        action="ORAL_3D_RECONSTRUCTION_SAVED",
        user=current_user,
        entity_name="Document",
        entity_id=str(doc.id),
        details={
            "patient_id": payload.patient_id,
            "session_id": payload.session_id,
            "metrics": payload.metrics,
        },
        request=request,
    )

    return {
        "success": True,
        "document_id": doc.id,
        "patient_id": payload.patient_id,
        "message": f"Oral-3D reconstruction successfully saved to {patient.full_name}'s clinical records.",
    }


@router.get("/patient/{patient_id}")
def get_patient_xrays(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve all panoramic X-rays, CBCT scans, and 3D reconstructions for a specific patient."""
    docs = (
        db.query(Document)
        .filter(Document.patient_id == patient_id, Document.document_type.in_(["xray", "opg", "cbct"]))
        .order_by(Document.created_at.desc())
        .all()
    )

    results = []
    for d in docs:
        parsed_notes = None
        if d.notes:
            try:
                parsed_notes = json.loads(d.notes)
            except Exception:
                parsed_notes = {"text": d.notes}

        results.append({
            "id": d.id,
            "patient_id": d.patient_id,
            "document_type": d.document_type,
            "file_name": d.file_name,
            "original_file_name": d.original_file_name,
            "file_size": d.file_size,
            "mime_type": d.mime_type,
            "file_path": d.file_path,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "notes": parsed_notes,
        })

    return results
