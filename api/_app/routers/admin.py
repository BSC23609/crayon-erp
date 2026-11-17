from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ..db import tx, fetch_all
from ..deps import require, User
from ..security import hash_password
from ..audit import audit

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/users")
def users(_u=Depends(require("admin", "view"))):
    return fetch_all("""SELECT u.id, u.full_name, u.email, u.employee_code, u.mobile, u.is_active, u.last_login_at,
                               COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles
                          FROM app_user u LEFT JOIN user_role ur ON ur.user_id = u.id LEFT JOIN role r ON r.id = ur.role_id
                         GROUP BY u.id ORDER BY u.full_name""")

class UserIn(BaseModel):
    full_name: str
    email: str | None = None
    employee_code: str | None = None
    mobile: str | None = None
    password: str
    roles: list[str]

@router.post("/users")
def create_user(body: UserIn, user: User = Depends(require("admin", "create"))):
    if not (body.email or body.employee_code):
        raise HTTPException(422, "Email or employee code is required")
    with tx() as conn:
        u = conn.execute("""INSERT INTO app_user(full_name, email, employee_code, mobile, password_hash)
                            VALUES (%s,%s,%s,%s,%s) RETURNING id""",
                         (body.full_name, body.email, body.employee_code, body.mobile, hash_password(body.password))).fetchone()
        conn.execute("INSERT INTO user_role(user_id, role_id) SELECT %s, id FROM role WHERE code = ANY(%s)", (u["id"], body.roles))
        audit(conn, user.id, "app_user", u["id"], "create", new=body.model_dump(exclude={"password"}))
    return u

@router.get("/audit")
def audit_log(entity: str | None = None, entity_id: int | None = None, _u=Depends(require("admin", "view"))):
    return fetch_all("""SELECT a.*, u.full_name FROM audit_log a LEFT JOIN app_user u ON u.id = a.user_id
                         WHERE (%(e)s::text IS NULL OR entity = %(e)s) AND (%(i)s::bigint IS NULL OR entity_id = %(i)s)
                         ORDER BY a.id DESC LIMIT 200""", {"e": entity, "i": entity_id})
