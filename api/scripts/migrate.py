"""Apply db/schema.sql and db/seed.sql to an empty database.  Usage: DATABASE_URL=... python scripts/migrate.py"""
import os, pathlib, psycopg
root = pathlib.Path(__file__).resolve().parents[2] / "db"
with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as conn:
    for f in ("schema.sql", "seed.sql"):
        conn.execute((root / f).read_text())
        print("applied", f)
