"""Postgres access with psycopg 3. One small pool per serverless instance.
On Neon use the *pooled* connection string (host contains '-pooler')."""
from contextlib import contextmanager
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from .config import settings

_pool: ConnectionPool | None = None

def pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            settings.database_url, min_size=0, max_size=5, open=True,
            kwargs={"row_factory": dict_row, "options": "-c search_path=erp,public", "prepare_threshold": None},
        )
    return _pool

@contextmanager
def tx():
    """A connection inside one transaction: commits on success, rolls back on error."""
    with pool().connection() as conn:
        with conn.transaction():
            yield conn

def fetch_all(sql: str, params=None):
    with pool().connection() as conn:
        return conn.execute(sql, params or {}).fetchall()

def fetch_one(sql: str, params=None):
    with pool().connection() as conn:
        return conn.execute(sql, params or {}).fetchone()
