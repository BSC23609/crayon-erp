"""One fast, safe list endpoint shape for every grid in the app:
server-side paging, search (trigram-indexed where it matters), sort on whitelisted columns."""
from typing import Sequence
from fastapi import Query
from .db import fetch_all, fetch_one

class ListParams:
    def __init__(self, q: str | None = Query(None, max_length=100), page: int = Query(1, ge=1),
                 size: int = Query(50, ge=1, le=200), sort: str | None = None, status: str | None = None):
        self.q, self.page, self.size, self.sort, self.status = q, page, size, sort, status

def run_list(base_sql: str, p: ListParams, search_cols: Sequence[str], sort_cols: Sequence[str],
             default_sort: str, status_col: str | None = "status", extra_where: str = "", extra_params: dict | None = None):
    where, params = ["TRUE"], dict(extra_params or {})
    if extra_where:
        where.append(extra_where)
    if p.q and search_cols:
        where.append("(" + " OR ".join(f"{c}::text ILIKE %(q)s" for c in search_cols) + ")")
        params["q"] = f"%{p.q}%"
    if p.status and status_col:
        where.append(f"{status_col} = %(status)s"); params["status"] = p.status
    order = default_sort
    if p.sort:
        col, _, direction = p.sort.partition(":")
        if col in sort_cols:
            order = f"{col} {'DESC' if direction == 'desc' else 'ASC'}"
    w = " AND ".join(where)
    params.update(limit=p.size, offset=(p.page - 1) * p.size)
    rows = fetch_all(f"SELECT * FROM ({base_sql}) t WHERE {w} ORDER BY {order} LIMIT %(limit)s OFFSET %(offset)s", params)
    total = fetch_one(f"SELECT count(*) AS n FROM ({base_sql}) t WHERE {w}", params)["n"]
    return {"rows": rows, "total": total, "page": p.page, "size": p.size}
