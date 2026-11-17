from fastapi import Cookie, Depends, Header, HTTPException
from .db import fetch_all, fetch_one
from .security import COOKIE, read_session
from .config import settings

class User(dict):
    @property
    def id(self) -> int: return self["id"]
    def can(self, module: str, action: str) -> bool:
        return f"{module}:{action}" in self["permissions"] or "admin:admin" in self["permissions"]

def load_user(user_id: int) -> User | None:
    u = fetch_one("SELECT id, email, employee_code, full_name, mobile FROM app_user WHERE id = %(id)s AND is_active", {"id": user_id})
    if not u:
        return None
    rows = fetch_all("""SELECT r.code AS role, rp.module, rp.action
                          FROM user_role ur JOIN role r ON r.id = ur.role_id
                          LEFT JOIN role_permission rp ON rp.role_id = r.id
                         WHERE ur.user_id = %(id)s""", {"id": user_id})
    u["roles"] = sorted({r["role"] for r in rows})
    u["permissions"] = sorted({f'{r["module"]}:{r["action"]}' for r in rows if r["module"]})
    return User(u)

def current_user(session: str | None = Cookie(default=None, alias=COOKIE)) -> User:
    uid = read_session(session) if session else None
    user = load_user(uid) if uid else None
    if not user:
        raise HTTPException(401, "Not signed in")
    return user

def require(module: str, action: str = "view"):
    """Dependency: the signed-in user must hold module:action (checked on the server, always)."""
    def checker(user: User = Depends(current_user)) -> User:
        if not user.can(module, action):
            raise HTTPException(403, f"No permission: {module}:{action}")
        return user
    return checker

def tally_connector(x_connector_key: str | None = Header(default=None)):
    if x_connector_key != settings.tally_connector_key:
        raise HTTPException(401, "Bad connector key")
    return True
