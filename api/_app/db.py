"""Postgres access with psycopg 3.

Serverless-friendly: one short-lived connection per request, no pool threads.
Neon's *pooled* endpoint (host contains '-pooler') does the pooling, so
connections are cheap; prepared statements are disabled for PgBouncer."""
from contextlib import contextmanager
import psycopg
from psycopg.rows import dict_row
from .config import settings

def _connect() -> psycopg.Connection:
    return psycopg.connect(
        settings.database_url, row_factory=dict_row, prepare_threshold=None,
        connect_timeout=10, options="-c search_path=erp,public",
    )

@contextmanager
def tx():
    """A connection inside one transaction: commits on success, rolls back on error."""
    with _connect() as conn:          # psycopg commits on clean exit, rolls back on exception
        yield conn

def fetch_all(sql: str, params=None):
    with _connect() as conn:
        return conn.execute(sql, params or {}).fetchall()

def fetch_one(sql: str, params=None):
    with _connect() as conn:
        return conn.execute(sql, params or {}).fetchone()
