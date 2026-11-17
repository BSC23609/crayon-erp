from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from ..config import settings
from ..db import tx, fetch_one
from ..deps import current_user, load_user, User
from ..security import COOKIE, make_session, verify_password, read_hub_token
from ..audit import audit

router = APIRouter(prefix="/api/auth", tags=["auth"])

class LoginIn(BaseModel):
    login: str          # email or employee code
    password: str

def _set_cookie(resp: Response, user_id: int):
    resp.set_cookie(COOKIE, make_session(user_id), httponly=True, secure=settings.cookie_secure,
                    samesite="lax", max_age=settings.session_hours * 3600, path="/")

@router.post("/login")
def login(body: LoginIn, request: Request, response: Response):
    u = fetch_one("""SELECT id, password_hash FROM app_user
                      WHERE is_active AND (email = %(l)s OR upper(employee_code) = upper(%(l)s))""", {"l": body.login.strip()})
    if not u or not verify_password(body.password, u["password_hash"]):
        raise HTTPException(401, "Wrong login or password")
    with tx() as conn:
        conn.execute("UPDATE app_user SET last_login_at = now() WHERE id = %s", (u["id"],))
        audit(conn, u["id"], "app_user", u["id"], "login", ip=request.client.host if request.client else None)
    _set_cookie(response, u["id"])
    return load_user(u["id"])

@router.get("/sso")
def sso(token: str, response: Response):
    """Group app hub hands the user over with a short-lived signed token (aud=crayon-erp)."""
    claims = read_hub_token(token)
    if not claims:
        raise HTTPException(401, "Invalid or expired hub token")
    u = fetch_one("SELECT id FROM app_user WHERE is_active AND (hub_user_id = %(h)s OR email = %(e)s)",
                  {"h": str(claims.get("sub")), "e": claims.get("email")})
    if not u:
        raise HTTPException(403, "No Crayon ERP account for this user. Ask IT to tick Crayon ERP in the hub.")
    _set_cookie(response, u["id"])
    return {"ok": True}

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}

@router.get("/me")
def me(user: User = Depends(current_user)):
    return user
