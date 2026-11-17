from fastapi import APIRouter, Depends
from ..db import fetch_one, fetch_all
from ..deps import current_user, User

router = APIRouter(prefix="/api", tags=["meta"])

@router.get("/health")
def health():
    db = fetch_one("SELECT now() AS db_time, fin_year(current_date) AS fin_year")
    return {"status": "ok", **db}

@router.get("/meta/settings")
def app_settings(user: User = Depends(current_user)):
    return {r["key"]: r["value"] for r in fetch_all("SELECT key, value FROM app_setting WHERE key IN ('company')")}

@router.get("/meta/lookups")
def lookups(user: User = Depends(current_user)):
    """Small reference lists the front end caches once per session."""
    return {
        "uoms": fetch_all("SELECT code, name, decimals FROM uom ORDER BY code"),
        "godowns": fetch_all("SELECT id, name FROM godown WHERE is_active ORDER BY name"),
        "colours": fetch_all("SELECT code, name, hex FROM colour ORDER BY code"),
        "roles": fetch_all("SELECT code, name FROM role ORDER BY name"),
    }
