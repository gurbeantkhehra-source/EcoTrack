from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from .classifier import classify_image
from .scoring import calculate_points

router = APIRouter()

FAKE_BATCH = {"id": 1, "owner_id": 1, "status": "ready", "total_points": 120, "items": 8}
VERIFIED_RECYCLERS = {2: True, 3: False}

class UserIn(BaseModel):
    name: str
    role: str

@router.get("/health")
def health():
    return {"status": "ok"}

@router.post("/users")
def create_user(user: UserIn):
    return {"id": 1, "name": user.name, "role": user.role,
            "verified": user.role == "recycler"}

@router.post("/scan")
async def scan(file: UploadFile = File(...), owner_id: int = Form(...)):
    image_bytes = await file.read()
    result = classify_image(image_bytes)
    points = calculate_points(result["category"])
    return {"owner_id": owner_id, "category": result["category"],
            "confidence": result["confidence"], "points": points,
            "batch_status": "collecting", "batch_total_points": points}

@router.get("/batches")
def my_batches(owner_id: int):
    return [FAKE_BATCH]

@router.get("/batches/ready")
def ready_batches():
    return [FAKE_BATCH]

@router.post("/batches/{batch_id}/accept")
def accept(batch_id: int, pickup_id: int):
    return {"batch_id": batch_id, "status": "assigned", "pickup_id": pickup_id}

@router.post("/batches/{batch_id}/picked-up")
def picked_up(batch_id: int):
    return {"batch_id": batch_id, "status": "picked_up"}

@router.get("/recyclers")
def recyclers():
    return [{"id": 2, "name": "GreenMetal Recyclers", "verified": True}]

@router.post("/batches/{batch_id}/deliver")
def deliver(batch_id: int, recycler_id: int):
    if not VERIFIED_RECYCLERS.get(recycler_id, False):
        raise HTTPException(status_code=403,
                            detail="E-waste can only go to a verified recycler")
    return {"batch_id": batch_id, "status": "delivered", "recycler_id": recycler_id}

@router.post("/batches/{batch_id}/confirm")
def confirm(batch_id: int):
    return {"batch_id": batch_id, "status": "completed"}
