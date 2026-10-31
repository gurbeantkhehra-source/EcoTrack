import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from .classifier import classify_image
from .scoring import calculate_points
from .db import get_conn

router = APIRouter()

READY_LIMIT = 100
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"


class UserIn(BaseModel):
    name: str
    role: str


def fetch_batch(conn, batch_id):
    row = conn.execute("SELECT * FROM batches WHERE id = ?", (batch_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    return dict(row)


@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/users")
def create_user(user: UserIn):
    if user.role not in ("collector", "pickup", "recycler"):
        raise HTTPException(status_code=400, detail="Role must be collector, pickup or recycler")
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO users (name, role, verified) VALUES (?, ?, 0)",
            (user.name, user.role),
        )
        conn.commit()
        return {"id": cur.lastrowid, "name": user.name, "role": user.role, "verified": False}
    finally:
        conn.close()


@router.get("/users/{user_id}")
def get_user(user_id: int):
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="User not found")
        return dict(row)
    finally:
        conn.close()


@router.post("/scan")
async def scan(file: UploadFile = File(...), owner_id: int = Form(...)):
    image_bytes = await file.read()
    conn = get_conn()
    try:
        owner = conn.execute("SELECT * FROM users WHERE id = ?", (owner_id,)).fetchone()
        if owner is None:
            raise HTTPException(status_code=404, detail="User not found")

        result = classify_image(image_bytes)
        points = calculate_points(result["category"])

        suffix = Path(file.filename or "").suffix or ".jpg"
        photo_name = uuid.uuid4().hex + suffix
        UPLOAD_DIR.mkdir(exist_ok=True)
        (UPLOAD_DIR / photo_name).write_bytes(image_bytes)

        batch = conn.execute(
            "SELECT * FROM batches WHERE owner_id = ? AND status = 'collecting'",
            (owner_id,),
        ).fetchone()
        if batch is None:
            cur = conn.execute("INSERT INTO batches (owner_id) VALUES (?)", (owner_id,))
            batch_id = cur.lastrowid
            total = 0
        else:
            batch_id = batch["id"]
            total = batch["total_points"]

        conn.execute(
            "INSERT INTO items (owner_id, category, confidence, points, photo_path, batch_id) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (owner_id, result["category"], result["confidence"], points, photo_name, batch_id),
        )
        total += points
        status = "ready" if total >= READY_LIMIT else "collecting"
        conn.execute(
            "UPDATE batches SET total_points = ?, status = ? WHERE id = ?",
            (total, status, batch_id),
        )
        conn.commit()

        return {
            "owner_id": owner_id,
            "category": result["category"],
            "confidence": result["confidence"],
            "points": points,
            "batch_id": batch_id,
            "batch_status": status,
            "batch_total_points": total,
        }
    finally:
        conn.close()


@router.get("/batches")
def my_batches(owner_id: int):
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM batches WHERE owner_id = ? ORDER BY id DESC", (owner_id,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.get("/batches/ready")
def ready_batches():
    conn = get_conn()
    try:
        rows = conn.execute("SELECT * FROM batches WHERE status = 'ready' ORDER BY id").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.post("/batches/{batch_id}/accept")
def accept(batch_id: int, pickup_id: int):
    conn = get_conn()
    try:
        batch = fetch_batch(conn, batch_id)
        if batch["status"] != "ready":
            raise HTTPException(status_code=400, detail="Batch is not ready for pickup")
        pickup = conn.execute(
            "SELECT * FROM users WHERE id = ? AND role = 'pickup'", (pickup_id,)
        ).fetchone()
        if pickup is None:
            raise HTTPException(status_code=404, detail="Pickup person not found")
        conn.execute(
            "UPDATE batches SET status = 'assigned', pickup_id = ? WHERE id = ?",
            (pickup_id, batch_id),
        )
        conn.commit()
        return {"batch_id": batch_id, "status": "assigned", "pickup_id": pickup_id}
    finally:
        conn.close()


@router.post("/batches/{batch_id}/picked-up")
def picked_up(batch_id: int):
    conn = get_conn()
    try:
        batch = fetch_batch(conn, batch_id)
        if batch["status"] != "assigned":
            raise HTTPException(status_code=400, detail="Batch must be assigned first")
        conn.execute("UPDATE batches SET status = 'picked_up' WHERE id = ?", (batch_id,))
        conn.commit()
        return {"batch_id": batch_id, "status": "picked_up"}
    finally:
        conn.close()


@router.get("/recyclers")
def recyclers():
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT id, name, verified FROM users WHERE role = 'recycler' AND verified = 1"
        ).fetchall()
        return [{"id": r["id"], "name": r["name"], "verified": True} for r in rows]
    finally:
        conn.close()


@router.post("/batches/{batch_id}/deliver")
def deliver(batch_id: int, recycler_id: int):
    conn = get_conn()
    try:
        batch = fetch_batch(conn, batch_id)
        if batch["status"] != "picked_up":
            raise HTTPException(status_code=400, detail="Batch must be picked up first")
        recycler = conn.execute(
            "SELECT * FROM users WHERE id = ? AND role = 'recycler'", (recycler_id,)
        ).fetchone()
        if recycler is None:
            raise HTTPException(status_code=404, detail="Recycler not found")
        has_ewaste = conn.execute(
            "SELECT COUNT(*) FROM items WHERE batch_id = ? AND category = 'ewaste'", (batch_id,)
        ).fetchone()[0] > 0
        if has_ewaste and not recycler["verified"]:
            raise HTTPException(
                status_code=403, detail="E-waste can only go to a verified recycler"
            )
        conn.execute(
            "UPDATE batches SET status = 'delivered', recycler_id = ? WHERE id = ?",
            (recycler_id, batch_id),
        )
        conn.commit()
        return {"batch_id": batch_id, "status": "delivered", "recycler_id": recycler_id}
    finally:
        conn.close()


@router.post("/batches/{batch_id}/confirm")
def confirm(batch_id: int):
    conn = get_conn()
    try:
        batch = fetch_batch(conn, batch_id)
        if batch["status"] != "delivered":
            raise HTTPException(status_code=400, detail="Batch must be delivered first")
        conn.execute("UPDATE batches SET status = 'completed' WHERE id = ?", (batch_id,))
        conn.commit()
        return {"batch_id": batch_id, "status": "completed"}
    finally:
        conn.close()
