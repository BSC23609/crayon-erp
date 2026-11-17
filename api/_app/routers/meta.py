from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from ..db import fetch_one, fetch_all
from ..deps import current_user, User

router = APIRouter(prefix="/api", tags=["meta"])

@router.get("/health")
def health():
    import os
    if not os.environ.get("DATABASE_URL"):
        return JSONResponse({"status": "error", "database": "DATABASE_URL is not set for this environment"}, status_code=503)
    try:
        db = fetch_one("SELECT now() AS db_time, fin_year(current_date) AS fin_year")
    except Exception as e:  # report the kind of failure, never the connection string
        msg = str(e).split("\n")[0]
        if "@" in msg:
            msg = msg.split("@")[-1]
        return JSONResponse({"status": "error", "database": f"{type(e).__name__}: {msg}"[:300]}, status_code=503)
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
