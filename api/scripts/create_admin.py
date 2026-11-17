"""Create the first administrator.  Usage:
   DATABASE_URL=... python scripts/create_admin.py "Full Name" email@crayonroofings.com 'StrongPassword'"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _app.db import tx
from _app.security import hash_password

name, email, pw = sys.argv[1:4]
with tx() as conn:
    u = conn.execute("""INSERT INTO app_user(full_name, email, password_hash) VALUES (%s,%s,%s)
                        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id""",
                     (name, email, hash_password(pw))).fetchone()
    conn.execute("INSERT INTO user_role(user_id, role_id) SELECT %s, id FROM role WHERE code='admin' ON CONFLICT DO NOTHING", (u["id"],))
print("admin user id", u["id"])
