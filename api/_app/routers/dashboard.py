from fastapi import APIRouter, Depends
from ..db import fetch_one, fetch_all
from ..deps import current_user, User

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/summary")
def summary(user: User = Depends(current_user)):
    k = fetch_one("""SELECT
        (SELECT COALESCE(sum(value),0) FROM stock_balance)                                  AS stock_value,
        (SELECT COALESCE(sum(balance_kg),0)/1000 FROM coil WHERE status IN ('in_stock','in_production')) AS coil_mt,
        (SELECT count(*) FROM coil WHERE status IN ('in_stock','in_production'))           AS open_coils,
        (SELECT count(*) FROM indent WHERE status = 'submitted')                            AS indents_pending,
        (SELECT count(*) FROM purchase_order WHERE status IN ('approved','sent','partly_received')) AS open_pos,
        (SELECT count(*) FROM sales_order WHERE status IN ('approved','in_production','partly_dispatched')) AS open_orders,
        (SELECT count(*) FROM job_card WHERE planned_date = current_date)                   AS jobs_today,
        (SELECT count(*) FROM dispatch WHERE doc_date = current_date)                       AS dispatches_today,
        (SELECT count(*) FROM enquiry WHERE stage NOT IN ('won','lost'))                    AS open_enquiries,
        (SELECT count(*) FROM breakdown WHERE status NOT IN ('resolved','closed'))          AS open_breakdowns,
        (SELECT count(*) FROM tally_outbox WHERE status IN ('pending','failed'))            AS tally_pending,
        (SELECT count(*) FROM approval WHERE decision = 'pending' AND approver_id = %(u)s)  AS my_approvals
    """, {"u": user.id})
    pipeline = fetch_all("""SELECT stage, count(*) AS n, COALESCE(sum(est_value),0) AS value
                              FROM enquiry GROUP BY stage""")
    return {"kpis": k, "pipeline": pipeline}
