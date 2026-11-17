"""Endpoints used only by the Tally connector service on the Tally PC (header X-Connector-Key)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..db import tx, fetch_all
from ..deps import tally_connector, require

router = APIRouter(prefix="/api/tally", tags=["tally"])

@router.get("/outbox", dependencies=[Depends(tally_connector)])
def outbox(limit: int = 20):
    """Oldest pending entries first, so Tally receives them in order."""
    with tx() as conn:
        rows = conn.execute("""UPDATE tally_outbox SET status='sent', attempts = attempts + 1
                                WHERE id IN (SELECT id FROM tally_outbox WHERE status IN ('pending','failed') AND attempts < 10
                                              ORDER BY id LIMIT %s FOR UPDATE SKIP LOCKED)
                                RETURNING id, entity, entity_id, voucher_type, xml""", (limit,)).fetchall()
    return sorted(rows, key=lambda r: r["id"])

class Ack(BaseModel):
    id: int
    ok: bool
    tally_voucher_no: str | None = None
    tally_master_id: str | None = None
    error: str | None = None

@router.post("/ack", dependencies=[Depends(tally_connector)])
def ack(items: list[Ack]):
    with tx() as conn:
        for a in items:
            conn.execute("""UPDATE tally_outbox SET status=%s, tally_voucher_no=%s, tally_master_id=%s, last_error=%s,
                                   posted_at = CASE WHEN %s THEN now() END WHERE id=%s""",
                         ("posted" if a.ok else "failed", a.tally_voucher_no, a.tally_master_id, a.error, a.ok, a.id))
    return {"ok": True, "count": len(items)}

@router.get("/monitor")
def monitor(_u=Depends(require("tally_sync", "view"))):
    return fetch_all("""SELECT id, entity, entity_id, voucher_type, status, attempts, tally_voucher_no, last_error, created_at, posted_at
                          FROM tally_outbox ORDER BY id DESC LIMIT 200""")
