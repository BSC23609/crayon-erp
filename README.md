# Crayon ERP

Operations ERP for Crayon Roofings & Structures at **erp.crayonroofings.com**.
Indent → PO → GRN → stock, enquiry → order → production → dispatch → invoice, and maintenance,
with Tally kept as the accounts book of record. Architecture: see the "Crayon ERP — System Architecture" doc.

This is the **Phase 0 skeleton**: every module's screens, the full database, sign-in, roles and permissions,
the audit log, document numbering and the Tally connector. No Tally masters are loaded yet.

## What is in the box

| Folder | What it is |
| --- | --- |
| `web/` | React + TypeScript app (Vite, Tailwind, TanStack Query/Table, cmdk). Sign-in, Today dashboard, a list screen for every module, Ctrl+K command bar, light and dark themes, phone layout |
| `api/` | FastAPI on Vercel Python functions. Sign-in (password and group-hub SSO), role permissions checked on every call, list endpoints for every module, the indent workflow (create → submit → approve) as the pattern for other documents, Tally outbox endpoints, admin and audit |
| `db/schema.sql` | PostgreSQL schema: 70 tables across masters, purchase, inventory (coil-wise, append-only stock ledger), sales, production, dispatch/GST, maintenance and platform |
| `db/seed.sql` | Reference data only: 10 roles with permissions, units, colour codes, the Main Location godown, company settings |
| `tally-connector/` | Windows service for the Tally PC that posts queued entries to TallyPrime and reports back |
| `vercel.json` | Static app on the edge, API pinned to Singapore (`sin1`) next to Neon |

## Go-live steps for Phase 0

1. **GitHub:** create the repo `BSC23609/crayon-erp` and upload this folder.
2. **Neon:** create a project named `crayon-erp` in **AWS Asia Pacific (Singapore)**. Copy the **pooled** connection string.
3. **Database:** from any PC with Python 3.11+:
   ```
   pip install -r api/requirements.txt
   set DATABASE_URL=<pooled connection string>
   python api/scripts/migrate.py
   python api/scripts/create_admin.py "Your Name" you@crayonroofings.com "A-strong-password"
   ```
4. **Vercel:** import the GitHub repo as a new project (BSC23609 team). Framework preset: Other. Add the environment variables from `.env.example`. Deploy.
5. **Domain:** in Vercel > Project > Domains add `erp.crayonroofings.com`. Vercel shows the record to add; at the crayonroofings.com DNS add **CNAME `erp` → `cname.vercel-dns.com`** (use the exact value Vercel shows).
6. **Group app hub:** add Crayon ERP as an app with URL `https://erp.crayonroofings.com/api/auth/sso?token=…`, signing a short-lived HS256 token (audience `crayon-erp`, `sub` = hub user id, `email`) with `HUB_SSO_SECRET`.
7. **Tally connector:** follow `tally-connector/README.md` on the Tally PC.

## Local development

```
# database (Postgres 16)
createdb crayon && psql -d crayon -f db/schema.sql -f db/seed.sql
# API
cd api && pip install -r requirements.txt
DATABASE_URL=postgresql://localhost/crayon COOKIE_SECURE=0 uvicorn app.main:app --reload --port 8000
# web (proxies /api to :8000)
cd web && npm install && npm run dev
```
API reference while running: http://localhost:8000/api/docs

## Conventions for the next phases

- **Lists:** add a resource to `api/app/routers/resources.py` and a `ListDef` to `web/src/nav.ts`; paging, search, sort and status filters come free.
- **Documents:** follow `api/app/routers/indent.py`: number from `next_doc_no()`, everything in one transaction, `audit()` on every change, approval rows on submit.
- **Stock:** only ever `INSERT INTO stock_move`. The trigger keeps `stock_balance` current, and updates or deletes are refused.
- **Tally:** never call Tally from the API. Insert the voucher XML into `tally_outbox`; the connector posts it.
- **Names:** `tally_name` on items, parties and godowns must match Tally exactly.

## Checked in this build

- Schema and seed apply cleanly on PostgreSQL 16; numbering gives `CR/PO/26-27/0001`, invoices `CR/26-27/0001`.
- All 17 list endpoints return in about 7 ms locally; a request without a session returns 401.
- Indent create → submit → approve works; a second submit is refused; the audit log and approver notification are written.
- `stock_move` updates are refused; the balance trigger adds 50 − 12 = 38.
- Connector: a good entry is posted with Tally's voucher id; a bad one is marked failed with Tally's error text.
- Web build: 119 KB gzipped main bundle, module pages loaded on demand.
