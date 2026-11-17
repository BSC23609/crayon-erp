"""Postgres access with psycopg 3.

Serverless-friendly: one short-lived connection per request, no pool threads.
Neon's *pooled* endpoint (host contains '-pooler') does the pooling, so
connections are cheap; prepared statements are disabled for PgBouncer."""
from contextlib import contextmanager
from functools import lru_cache
import socket
import psycopg
from psycopg.conninfo import conninfo_to_dict, make_conninfo
from psycopg.rows import dict_row
from .config import settings

@lru_cache(maxsize=1)
def _conninfo() -> str:
    """Vercel functions have no IPv6 route, and Neon hosts resolve to IPv6 first.
    Pin an IPv4 address with hostaddr; host stays set, so TLS/SNI still uses the name."""
    params = conninfo_to_dict(settings.database_url)
    host = params.get("host", "")
    if host and not host.startswith("/") and "hostaddr" not in params and "," not in host:
        try:
            params["hostaddr"] = socket.getaddrinfo(host, None, socket.AF_INET, socket.SOCK_STREAM)[0][4][0]
        except OSError:
            pass  # let libpq resolve it and report the error
    return make_conninfo(**params)

def _connect() -> psycopg.Connection:
    conn = psycopg.connect(_conninfo(), row_factory=dict_row, prepare_threshold=None, connect_timeout=10)
    # Neon's pooler rejects startup options, so set the schema inside the transaction.
    # SET LOCAL lasts only for this transaction, so it cannot leak to other pooled clients.
    conn.execute("SET LOCAL search_path TO erp, public")
    return conn

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
