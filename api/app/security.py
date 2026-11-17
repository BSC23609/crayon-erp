import datetime as dt
import bcrypt, jwt
from .config import settings

COOKIE = "crayon_session"

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12)).decode()

def verify_password(pw: str, hashed: str | None) -> bool:
    return bool(hashed) and bcrypt.checkpw(pw.encode(), hashed.encode())

def make_session(user_id: int) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    return jwt.encode({"sub": str(user_id), "iat": now, "exp": now + dt.timedelta(hours=settings.session_hours)},
                      settings.jwt_secret, algorithm="HS256")

def read_session(token: str) -> int | None:
    try:
        return int(jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])["sub"])
    except Exception:
        return None

def read_hub_token(token: str) -> dict | None:
    """Short-lived token the group app hub signs when a user opens the ERP from the hub."""
    try:
        return jwt.decode(token, settings.hub_sso_secret, algorithms=["HS256"], audience="crayon-erp")
    except Exception:
        return None
