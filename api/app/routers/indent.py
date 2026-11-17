"""Reference document workflow (indent). Other documents follow the same pattern:
create draft -> submit (approval rows created from approval_rule) -> approve -> downstream document."""
import datetime as dt
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from ..db import tx, fetch_all, fetch_one
from ..deps import require, User
from ..audit import audit

router = APIRouter(prefix="/api/indents", tags=["indent"])

class IndentLineIn(BaseModel):
    item_id: int
    qty: float = Field(gt=0)
    uom: str
    purpose: str | None = None
    machine_id: int | None = None

class IndentIn(BaseModel):
    indent_type: Literal["raw_material", "consumable", "spare", "service", "capital"]
    department: str | None = None
    required_by: dt.date | None = None
    priority: Literal["low", "normal", "urgent"] = "normal"
    remarks: str | None = None
    lines: list[IndentLineIn] = Field(min_length=1)

@router.post("")
def create_indent(body: IndentIn, user: User = Depends(require("indent", "create"))):
    with tx() as conn:
        doc_no = conn.execute("SELECT next_doc_no('IND') AS n").fetchone()["n"]
        ind = conn.execute(
            """INSERT INTO indent(doc_no, indent_type, department, required_by, priority, remarks, created_by)
               VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id, doc_no, status""",
            (doc_no, body.indent_type, body.department, body.required_by, body.priority, body.remarks, user.id)).fetchone()
        for n, l in enumerate(body.lines, 1):
            conn.execute("""INSERT INTO indent_line(indent_id, line_no, item_id, qty, uom, purpose, machine_id)
                            VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                         (ind["id"], n, l.item_id, l.qty, l.uom, l.purpose, l.machine_id))
        audit(conn, user.id, "indent", ind["id"], "create", new=body.model_dump())
    return ind

@router.post("/{id}/submit")
def submit_indent(id: int, user: User = Depends(require("indent", "create"))):
    with tx() as conn:
        d = conn.execute("SELECT id, status FROM indent WHERE id = %s FOR UPDATE", (id,)).fetchone()
        if not d or d["status"] != "draft":
            raise HTTPException(409, "Only a draft indent can be submitted")
        conn.execute("UPDATE indent SET status='submitted', updated_at=now(), updated_by=%s WHERE id=%s", (user.id, id))
        # approver: matching rule, else the default management role
        rule = conn.execute("""SELECT approver_user_id, approver_role_id, level FROM approval_rule
                                WHERE doc_type='indent' AND is_active ORDER BY level LIMIT 1""").fetchone()
        approvers = conn.execute(
            """SELECT ur.user_id FROM user_role ur JOIN role r ON r.id = ur.role_id
                WHERE r.id = COALESCE(%(rid)s, (SELECT id FROM role WHERE code='management'))""",
            {"rid": rule["approver_role_id"] if rule else None}).fetchall()
        ids = [rule["approver_user_id"]] if rule and rule["approver_user_id"] else [a["user_id"] for a in approvers]
        for a in ids:
            conn.execute("INSERT INTO approval(doc_type, doc_id, level, approver_id) VALUES ('indent',%s,1,%s)", (id, a))
            conn.execute("INSERT INTO notification(user_id, title, link) VALUES (%s,%s,%s)",
                         (a, "Indent waiting for approval", f"/purchase/indents/{id}"))
        audit(conn, user.id, "indent", id, "submit")
    return {"ok": True, "approvers": len(ids)}

@router.post("/{id}/approve")
def approve_indent(id: int, decision: Literal["approved", "rejected"] = "approved", remarks: str | None = None,
                   user: User = Depends(require("indent", "approve"))):
    with tx() as conn:
        d = conn.execute("SELECT status FROM indent WHERE id = %s FOR UPDATE", (id,)).fetchone()
        if not d or d["status"] != "submitted":
            raise HTTPException(409, "Indent is not waiting for approval")
        conn.execute("""UPDATE approval SET decision=%s, remarks=%s, decided_at=now(), approver_id=%s
                         WHERE doc_type='indent' AND doc_id=%s AND decision='pending'""", (decision, remarks, user.id, id))
        conn.execute("UPDATE indent SET status=%s, updated_at=now(), updated_by=%s WHERE id=%s", (decision, user.id, id))
        audit(conn, user.id, "indent", id, decision, new={"remarks": remarks})
    return {"ok": True, "status": decision}

@router.get("/{id}/lines")
def indent_lines(id: int, _u=Depends(require("indent", "view"))):
    return fetch_all("""SELECT l.*, i.name AS item_name FROM indent_line l JOIN item i ON i.id = l.item_id
                         WHERE l.indent_id = %(id)s ORDER BY line_no""", {"id": id})
