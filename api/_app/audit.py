import json

def audit(conn, user_id, entity: str, entity_id, action: str, old=None, new=None, ip=None):
    conn.execute(
        """INSERT INTO audit_log(user_id, entity, entity_id, action, old_values, new_values, ip)
           VALUES (%s,%s,%s,%s,%s,%s,%s)""",
        (user_id, entity, entity_id, action,
         json.dumps(old, default=str) if old is not None else None,
         json.dumps(new, default=str) if new is not None else None, ip))
