"""Read endpoints for every module's lists and documents, declared as data.
Each entry -> GET /api/<path> (paged list) and GET /api/<path>/{id} (one record).
Create/approve/post flows are added module by module on top of this skeleton."""
from fastapi import APIRouter, Depends, HTTPException
from ..db import fetch_one
from ..deps import require
from ..listing import ListParams, run_list

R = dict  # resource definition

RESOURCES: list[R] = [
    # ---- masters
    R(path="masters/items", module="masters", table="item", status=None,
      sql="""SELECT i.id, i.code, i.name, g.name AS group_name, g.item_type, i.uom, i.hsn_code, i.gst_rate,
                    i.thickness_mm, i.width_mm, i.colour_code, i.is_batch_tracked, i.is_active,
                    COALESCE((SELECT sum(qty) FROM stock_balance b WHERE b.item_id = i.id),0) AS stock_qty
               FROM item i JOIN item_group g ON g.id = i.group_id""",
      search=["name", "code", "group_name"], sort=["name", "group_name", "stock_qty"], default="name"),
    R(path="masters/parties", module="masters", table="party", status=None,
      sql="SELECT id, name, party_type, gstin, state, mobile, email, credit_limit, credit_days, is_active FROM party",
      search=["name", "gstin", "mobile"], sort=["name", "party_type", "state"], default="name"),
    R(path="masters/machines", module="masters", table="machine", status=None,
      sql="SELECT id, code, name, kind, location, make, model, is_active FROM machine",
      search=["code", "name"], sort=["code", "name"], default="code"),
    R(path="masters/godowns", module="masters", table="godown", status=None,
      sql="SELECT id, name, tally_name, is_jobwork, is_active FROM godown", search=["name"], sort=["name"], default="name"),
    # ---- purchase
    R(path="indents", module="indent", table="indent",
      sql="""SELECT d.id, d.doc_no, d.doc_date, d.indent_type, d.department, d.required_by, d.priority, d.status,
                    u.full_name AS raised_by, (SELECT count(*) FROM indent_line l WHERE l.indent_id = d.id) AS lines
               FROM indent d LEFT JOIN app_user u ON u.id = d.created_by""",
      search=["doc_no", "department", "raised_by"], sort=["doc_no", "doc_date", "required_by"], default="doc_date DESC, doc_no DESC"),
    R(path="purchase-orders", module="purchase_order", table="purchase_order",
      sql="""SELECT d.id, d.doc_no, d.doc_date, p.name AS supplier, d.delivery_date, d.total_value, d.status
               FROM purchase_order d JOIN party p ON p.id = d.supplier_id""",
      search=["doc_no", "supplier"], sort=["doc_no", "doc_date", "total_value"], default="doc_date DESC, doc_no DESC"),
    # ---- inventory
    R(path="grns", module="grn", table="grn",
      sql="""SELECT d.id, d.doc_no, d.doc_date, p.name AS supplier, d.supplier_invoice_no, d.vehicle_no, d.qc_status, d.status
               FROM grn d JOIN party p ON p.id = d.supplier_id""",
      search=["doc_no", "supplier", "supplier_invoice_no", "vehicle_no"], sort=["doc_no", "doc_date"], default="doc_date DESC, doc_no DESC"),
    R(path="coils", module="inventory", table="coil",
      sql="""SELECT c.id, c.coil_no, i.name AS item, c.thickness_mm, c.width_mm, c.colour_code, c.net_weight_kg,
                    c.balance_kg, g.name AS godown, c.received_on, c.status
               FROM coil c JOIN item i ON i.id = c.item_id LEFT JOIN godown g ON g.id = c.godown_id""",
      search=["coil_no", "item"], sort=["coil_no", "balance_kg", "received_on"], default="received_on DESC NULLS LAST"),
    R(path="stock", module="inventory", table="stock_balance", status=None, by_id=False,
      sql="""SELECT b.item_id AS id, i.name AS item, g.name AS godown, i.uom, b.qty, b.value, b.updated_at
               FROM stock_balance b JOIN item i ON i.id = b.item_id JOIN godown g ON g.id = b.godown_id WHERE b.qty <> 0""",
      search=["item", "godown"], sort=["item", "qty", "value"], default="item"),
    R(path="bills", module="bill", table="bill",
      sql="""SELECT d.id, d.doc_no, p.name AS supplier, d.supplier_invoice_no, d.supplier_invoice_date, d.total_value, d.status
               FROM bill d JOIN party p ON p.id = d.supplier_id""",
      search=["doc_no", "supplier", "supplier_invoice_no"], sort=["doc_no", "supplier_invoice_date", "total_value"], default="id DESC"),
    # ---- sales
    R(path="enquiries", module="enquiry", table="enquiry", status_col="stage",
      sql="""SELECT d.id, d.doc_no, d.doc_date, COALESCE(p.name, d.prospect_name) AS customer, d.source, d.district,
                    d.est_value, d.stage, u.full_name AS owner
               FROM enquiry d LEFT JOIN party p ON p.id = d.party_id LEFT JOIN app_user u ON u.id = d.owner_id""",
      search=["doc_no", "customer", "district"], sort=["doc_no", "doc_date", "est_value"], default="doc_date DESC, doc_no DESC"),
    R(path="quotations", module="quotation", table="quotation",
      sql="""SELECT d.id, d.doc_no, p.name AS customer, d.current_revision, d.valid_till, d.status,
                    (SELECT total_value FROM quotation_version v WHERE v.quotation_id = d.id AND v.revision = d.current_revision) AS total_value
               FROM quotation d LEFT JOIN party p ON p.id = d.party_id""",
      search=["doc_no", "customer"], sort=["doc_no", "valid_till", "total_value"], default="id DESC"),
    R(path="sales-orders", module="sales_order", table="sales_order",
      sql="""SELECT d.id, d.doc_no, d.doc_date, p.name AS customer, d.customer_po_no, d.delivery_date, d.total_value, d.status
               FROM sales_order d JOIN party p ON p.id = d.party_id""",
      search=["doc_no", "customer", "customer_po_no"], sort=["doc_no", "doc_date", "delivery_date", "total_value"], default="doc_date DESC, doc_no DESC"),
    # ---- production
    R(path="production-programs", module="production", table="production_program",
      sql="SELECT id, doc_no, plan_date, shift, status, remarks FROM production_program",
      search=["doc_no"], sort=["doc_no", "plan_date"], default="plan_date DESC"),
    R(path="job-cards", module="job_card", table="job_card",
      sql="""SELECT d.id, d.doc_no, d.planned_date, d.shift, m.name AS machine, pr.name AS profile, d.operator_name, d.status
               FROM job_card d JOIN machine m ON m.id = d.machine_id LEFT JOIN profile pr ON pr.id = d.profile_id""",
      search=["doc_no", "machine", "operator_name"], sort=["doc_no", "planned_date"], default="planned_date DESC, doc_no DESC"),
    # ---- dispatch
    R(path="dispatches", module="dispatch", table="dispatch",
      sql="""SELECT d.id, d.doc_no, d.doc_date, p.name AS customer, d.vehicle_no, d.status
               FROM dispatch d JOIN party p ON p.id = d.party_id""",
      search=["doc_no", "customer", "vehicle_no"], sort=["doc_no", "doc_date"], default="doc_date DESC, doc_no DESC"),
    R(path="invoices", module="invoice", table="invoice",
      sql="""SELECT d.id, d.doc_no, d.doc_date, p.name AS customer, d.taxable_value, d.total_value, d.status,
                    e.irn IS NOT NULL AS has_irn, (SELECT ewb_no FROM ewaybill w WHERE w.invoice_id = d.id ORDER BY id DESC LIMIT 1) AS ewb_no
               FROM invoice d JOIN party p ON p.id = d.party_id LEFT JOIN einvoice e ON e.invoice_id = d.id""",
      search=["doc_no", "customer", "ewb_no"], sort=["doc_no", "doc_date", "total_value"], default="doc_date DESC, doc_no DESC"),
    # ---- maintenance
    R(path="pm-tasks", module="maintenance", table="pm_task",
      sql="""SELECT t.id, t.doc_no, m.name AS machine, t.due_on, t.status, u.full_name AS done_by
               FROM pm_task t JOIN machine m ON m.id = t.machine_id LEFT JOIN app_user u ON u.id = t.done_by""",
      search=["doc_no", "machine"], sort=["doc_no", "due_on"], default="due_on"),
    R(path="breakdowns", module="maintenance", table="breakdown",
      sql="""SELECT b.id, b.doc_no, m.name AS machine, b.reported_at, b.description, b.status, b.downtime_min
               FROM breakdown b JOIN machine m ON m.id = b.machine_id""",
      search=["doc_no", "machine", "description"], sort=["doc_no", "reported_at", "downtime_min"], default="reported_at DESC"),
]

router = APIRouter(prefix="/api", tags=["records"])

def _register(r: R):
    status_col = None if r.get("status", "x") is None else r.get("status_col", "status")

    def list_endpoint(p: ListParams = Depends(), _u=Depends(require(r["module"], "view"))):
        return run_list(r["sql"], p, r["search"], r["sort"], r["default"], status_col=status_col)
    router.add_api_route(f"/{r['path']}", list_endpoint, methods=["GET"], name=f"list_{r['table']}")

    if r.get("by_id", True):
        def get_endpoint(id: int, _u=Depends(require(r["module"], "view"))):
            row = fetch_one(f"SELECT * FROM {r['table']} WHERE id = %(id)s", {"id": id})
            if not row:
                raise HTTPException(404, "Not found")
            return row
        router.add_api_route(f"/{r['path']}/{{id}}", get_endpoint, methods=["GET"], name=f"get_{r['table']}")

for _r in RESOURCES:
    _register(_r)
