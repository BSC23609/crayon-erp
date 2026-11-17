-- =====================================================================
-- Crayon ERP — database schema (PostgreSQL 16 / Neon)
-- Conventions
--   * bigint identity ids; every table has created_at/created_by,
--     documents also updated_at/updated_by and a status column
--   * quantities numeric(14,4), money numeric(14,2), rates numeric(14,4)
--   * names that post to Tally are kept exactly as in Tally (tally_name)
--   * stock is never edited directly: stock_move is append-only,
--     stock_balance is maintained in the same transaction
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS erp;
SET search_path TO erp, public;

-- ---------------------------------------------------------------------
-- PLATFORM: users, roles, permissions, approvals, numbering, audit
-- ---------------------------------------------------------------------
CREATE TABLE role (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code        text UNIQUE NOT NULL,            -- e.g. 'admin','purchase','stores'
    name        text NOT NULL,
    description text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- permission = module + action, e.g. ('purchase_order','approve')
CREATE TABLE role_permission (
    role_id bigint NOT NULL REFERENCES role(id) ON DELETE CASCADE,
    module  text   NOT NULL,
    action  text   NOT NULL CHECK (action IN ('view','create','edit','approve','cancel','export','admin')),
    PRIMARY KEY (role_id, module, action)
);

CREATE TABLE app_user (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email          citext UNIQUE,
    employee_code  text UNIQUE,
    full_name      text NOT NULL,
    mobile         text,
    password_hash  text,
    hub_user_id    text UNIQUE,                  -- id in the group app hub (SSO)
    is_active      boolean NOT NULL DEFAULT true,
    last_login_at  timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now(),
    CHECK (email IS NOT NULL OR employee_code IS NOT NULL)
);

CREATE TABLE user_role (
    user_id bigint NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    role_id bigint NOT NULL REFERENCES role(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- financial-year document numbering: CR/PO/26-27/0001
CREATE TABLE number_series (
    doc_type   text NOT NULL,                    -- 'IND','PO','GRN','QT','SO','JC','INV','BD',...
    fin_year   text NOT NULL,                    -- '26-27'
    prefix     text NOT NULL,                    -- 'CR/PO/'
    next_no    integer NOT NULL DEFAULT 1,
    pad        smallint NOT NULL DEFAULT 4,
    PRIMARY KEY (doc_type, fin_year)
);

-- approval rules by document type and value band
CREATE TABLE approval_rule (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_type     text NOT NULL,
    min_value    numeric(14,2) NOT NULL DEFAULT 0,
    max_value    numeric(14,2),                  -- null = no upper limit
    level        smallint NOT NULL DEFAULT 1,
    approver_role_id bigint REFERENCES role(id),
    approver_user_id bigint REFERENCES app_user(id),
    is_active    boolean NOT NULL DEFAULT true,
    CHECK (approver_role_id IS NOT NULL OR approver_user_id IS NOT NULL)
);

CREATE TABLE approval (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_type    text NOT NULL,
    doc_id      bigint NOT NULL,
    level       smallint NOT NULL DEFAULT 1,
    approver_id bigint REFERENCES app_user(id),
    decision    text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending','approved','rejected')),
    remarks     text,
    decided_at  timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_approval_doc ON approval(doc_type, doc_id);
CREATE INDEX ix_approval_pending ON approval(approver_id) WHERE decision = 'pending';

CREATE TABLE audit_log (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    at          timestamptz NOT NULL DEFAULT now(),
    user_id     bigint REFERENCES app_user(id),
    entity      text NOT NULL,                   -- table name
    entity_id   bigint,
    action      text NOT NULL,                   -- create/update/approve/cancel/login...
    old_values  jsonb,
    new_values  jsonb,
    ip          inet
);
CREATE INDEX ix_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX ix_audit_at ON audit_log(at DESC);

CREATE TABLE attachment (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entity      text NOT NULL,
    entity_id   bigint NOT NULL,
    file_name   text NOT NULL,
    blob_url    text NOT NULL,
    mime_type   text,
    size_bytes  bigint,
    created_by  bigint REFERENCES app_user(id),
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_attachment_entity ON attachment(entity, entity_id);

-- background job queue (GSP, WhatsApp, email, report builds)
CREATE TABLE job_queue (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind         text NOT NULL,                  -- 'gsp.irn','wati.send','mail.send',...
    payload      jsonb NOT NULL,
    status       text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
    attempts     smallint NOT NULL DEFAULT 0,
    max_attempts smallint NOT NULL DEFAULT 5,
    run_after    timestamptz NOT NULL DEFAULT now(),
    last_error   text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    finished_at  timestamptz
);
CREATE INDEX ix_job_ready ON job_queue(run_after) WHERE status = 'queued';

-- Tally outbox: one row per voucher/master to post into TallyPrime
CREATE TABLE tally_outbox (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entity         text NOT NULL,                -- 'bill','invoice','credit_note','party','item'
    entity_id      bigint NOT NULL,
    voucher_type   text,                         -- 'Purchase','Sales','Credit Note',...
    xml            text NOT NULL,                -- Tally import XML envelope
    status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','posted','failed','cancelled')),
    attempts       smallint NOT NULL DEFAULT 0,
    tally_voucher_no text,
    tally_master_id  text,
    last_error     text,
    created_at     timestamptz NOT NULL DEFAULT now(),
    posted_at      timestamptz
);
CREATE INDEX ix_tally_pending ON tally_outbox(id) WHERE status IN ('pending','failed');

CREATE TABLE notification (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     bigint NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    title       text NOT NULL,
    body        text,
    link        text,
    read_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_notification_unread ON notification(user_id) WHERE read_at IS NULL;

CREATE TABLE app_setting (
    key   text PRIMARY KEY,
    value jsonb NOT NULL
);

-- ---------------------------------------------------------------------
-- MASTERS
-- ---------------------------------------------------------------------
CREATE TABLE uom (
    code      text PRIMARY KEY,                  -- 'MT','KGS','RMT','NO','SQM','PKT'
    name      text NOT NULL,
    gst_uqc   text,                              -- 'MTS','KGS','NOS','SQM',...
    decimals  smallint NOT NULL DEFAULT 3
);

CREATE TABLE hsn (
    code        text PRIMARY KEY,
    description text,
    gst_rate    numeric(5,2) NOT NULL
);

CREATE TABLE item_group (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        text UNIQUE NOT NULL,
    parent_id   bigint REFERENCES item_group(id),
    item_type   text NOT NULL CHECK (item_type IN
                 ('rm_coil','rm_purlin','rm_polycarbonate','rm_other','finished','trading','consumable','spare','service','capital')),
    tally_name  text
);

CREATE TABLE item (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code          text UNIQUE,
    name          text NOT NULL,
    tally_name    text UNIQUE,                   -- exact Tally stock item name
    tally_guid    text,
    group_id      bigint NOT NULL REFERENCES item_group(id),
    uom           text NOT NULL REFERENCES uom(code),
    alt_uom       text REFERENCES uom(code),
    alt_factor    numeric(14,6),                 -- 1 uom = alt_factor alt_uom
    hsn_code      text REFERENCES hsn(code),
    gst_rate      numeric(5,2),
    -- coil / sheet attributes (null for non-steel items)
    thickness_mm  numeric(6,3),
    width_mm      numeric(8,2),
    coating       text,                          -- 'AZ150','AZ70','Z275','ZM'...
    colour_code   text,
    brand         text,                          -- 'JSW Colouron+','Tata',...
    kg_per_m      numeric(10,4),                 -- theoretical weight per running metre
    is_batch_tracked boolean NOT NULL DEFAULT false,
    reorder_level numeric(14,4),
    reorder_qty   numeric(14,4),
    is_active     boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    created_by    bigint REFERENCES app_user(id)
);
CREATE INDEX ix_item_name_trgm ON item USING gin (name gin_trgm_ops);
CREATE INDEX ix_item_group ON item(group_id);

CREATE TABLE colour (
    code  text PRIMARY KEY,                      -- 'SB','OW','BR','GG','NB','MG','RB','CFG','TQB'
    name  text NOT NULL,                         -- 'Sky Blue','Off White','Brick Red'...
    hex   text
);

CREATE TABLE profile (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code        text UNIQUE NOT NULL,            -- e.g. 'TRAP-6R', 'C-PURLIN', 'Z-PURLIN'
    name        text NOT NULL,
    kind        text NOT NULL CHECK (kind IN ('roof_sheet','purlin','decking','accessory')),
    cover_width_mm numeric(8,2),
    input_width_mm numeric(8,2)
);

CREATE TABLE godown (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       text UNIQUE NOT NULL,
    tally_name text,
    is_jobwork boolean NOT NULL DEFAULT false,
    is_active  boolean NOT NULL DEFAULT true
);

CREATE TABLE party (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            text NOT NULL,
    tally_name      text UNIQUE,                 -- exact Tally ledger name
    tally_guid      text,
    party_type      text NOT NULL CHECK (party_type IN ('customer','supplier','transporter','both')),
    gstin           text,
    gst_reg_type    text,
    pan             text,
    state           text,
    state_code      char(2),
    mobile          text,
    email           citext,
    credit_limit    numeric(14,2),
    credit_days     integer,
    payment_terms   text,
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      bigint REFERENCES app_user(id)
);
CREATE INDEX ix_party_name_trgm ON party USING gin (name gin_trgm_ops);
CREATE INDEX ix_party_gstin ON party(gstin);

CREATE TABLE party_address (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    party_id   bigint NOT NULL REFERENCES party(id) ON DELETE CASCADE,
    label      text NOT NULL DEFAULT 'Billing',  -- Billing / Shipping / Site name
    line1      text, line2 text, city text, district text,
    state      text, state_code char(2), pincode text,
    gstin      text,
    is_default boolean NOT NULL DEFAULT false
);

CREATE TABLE party_contact (
    id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    party_id  bigint NOT NULL REFERENCES party(id) ON DELETE CASCADE,
    name      text NOT NULL,
    designation text, mobile text, email citext,
    is_primary boolean NOT NULL DEFAULT false
);

CREATE TABLE machine (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code         text UNIQUE NOT NULL,
    name         text NOT NULL,
    kind         text NOT NULL,                  -- 'roll_former','slitter','crimping','purlin_line','utility'
    location     text,
    make         text, model text, serial_no text,
    commissioned_on date,
    capacity_note text,
    is_active    boolean NOT NULL DEFAULT true
);

CREATE TABLE machine_profile (               -- which profiles a machine can roll
    machine_id bigint REFERENCES machine(id) ON DELETE CASCADE,
    profile_id bigint REFERENCES profile(id) ON DELETE CASCADE,
    PRIMARY KEY (machine_id, profile_id)
);

CREATE TABLE price_list (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    item_id     bigint NOT NULL REFERENCES item(id),
    uom         text NOT NULL REFERENCES uom(code),
    rate        numeric(14,4) NOT NULL,
    valid_from  date NOT NULL,
    valid_to    date,
    created_by  bigint REFERENCES app_user(id),
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_price_item ON price_list(item_id, valid_from DESC);

-- ---------------------------------------------------------------------
-- Common document columns are repeated explicitly per table for clarity.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- PURCHASE
-- ---------------------------------------------------------------------
CREATE TABLE indent (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no       text UNIQUE NOT NULL,
    doc_date     date NOT NULL DEFAULT current_date,
    indent_type  text NOT NULL CHECK (indent_type IN ('raw_material','consumable','spare','service','capital')),
    department   text,
    required_by  date,
    priority     text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','urgent')),
    remarks      text,
    status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','partly_ordered','ordered','closed','cancelled')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    created_by   bigint REFERENCES app_user(id),
    updated_at   timestamptz,
    updated_by   bigint REFERENCES app_user(id)
);

CREATE TABLE indent_line (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    indent_id   bigint NOT NULL REFERENCES indent(id) ON DELETE CASCADE,
    line_no     smallint NOT NULL,
    item_id     bigint NOT NULL REFERENCES item(id),
    qty         numeric(14,4) NOT NULL CHECK (qty > 0),
    uom         text NOT NULL REFERENCES uom(code),
    purpose     text,
    machine_id  bigint REFERENCES machine(id),   -- for spares
    ordered_qty numeric(14,4) NOT NULL DEFAULT 0
);

CREATE TABLE purchase_order (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no         text UNIQUE NOT NULL,
    doc_date       date NOT NULL DEFAULT current_date,
    supplier_id    bigint NOT NULL REFERENCES party(id),
    supplier_ref   text,
    delivery_godown_id bigint REFERENCES godown(id),
    delivery_date  date,
    payment_terms  text,
    freight_terms  text,
    terms          text,
    amendment_no   smallint NOT NULL DEFAULT 0,
    taxable_value  numeric(14,2) NOT NULL DEFAULT 0,
    tax_value      numeric(14,2) NOT NULL DEFAULT 0,
    total_value    numeric(14,2) NOT NULL DEFAULT 0,
    status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','sent','partly_received','received','closed','cancelled')),
    created_at     timestamptz NOT NULL DEFAULT now(),
    created_by     bigint REFERENCES app_user(id),
    updated_at     timestamptz,
    updated_by     bigint REFERENCES app_user(id)
);
CREATE INDEX ix_po_supplier ON purchase_order(supplier_id, doc_date DESC);

CREATE TABLE po_line (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    po_id           bigint NOT NULL REFERENCES purchase_order(id) ON DELETE CASCADE,
    line_no         smallint NOT NULL,
    indent_line_id  bigint REFERENCES indent_line(id),
    item_id         bigint NOT NULL REFERENCES item(id),
    qty             numeric(14,4) NOT NULL CHECK (qty > 0),
    uom             text NOT NULL REFERENCES uom(code),
    rate            numeric(14,4) NOT NULL,
    discount_pct    numeric(5,2) NOT NULL DEFAULT 0,
    gst_rate        numeric(5,2) NOT NULL,
    taxable_value   numeric(14,2) NOT NULL,
    received_qty    numeric(14,4) NOT NULL DEFAULT 0
);

CREATE TABLE po_amendment (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    po_id       bigint NOT NULL REFERENCES purchase_order(id),
    amendment_no smallint NOT NULL,
    reason      text NOT NULL,
    snapshot    jsonb NOT NULL,                  -- the PO as it was before the change
    created_at  timestamptz NOT NULL DEFAULT now(),
    created_by  bigint REFERENCES app_user(id)
);

-- ---------------------------------------------------------------------
-- INVENTORY
-- ---------------------------------------------------------------------
CREATE TABLE grn (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no        text UNIQUE NOT NULL,
    doc_date      date NOT NULL DEFAULT current_date,
    supplier_id   bigint NOT NULL REFERENCES party(id),
    po_id         bigint REFERENCES purchase_order(id),
    godown_id     bigint NOT NULL REFERENCES godown(id),
    supplier_invoice_no   text,
    supplier_invoice_date date,
    vehicle_no    text,
    eway_bill_no  text,
    qc_status     text NOT NULL DEFAULT 'pending' CHECK (qc_status IN ('pending','accepted','partly_accepted','rejected')),
    status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','billed','cancelled')),
    remarks       text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    created_by    bigint REFERENCES app_user(id),
    updated_at    timestamptz,
    updated_by    bigint REFERENCES app_user(id)
);

CREATE TABLE grn_line (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    grn_id        bigint NOT NULL REFERENCES grn(id) ON DELETE CASCADE,
    line_no       smallint NOT NULL,
    po_line_id    bigint REFERENCES po_line(id),
    item_id       bigint NOT NULL REFERENCES item(id),
    received_qty  numeric(14,4) NOT NULL,
    accepted_qty  numeric(14,4) NOT NULL,
    rejected_qty  numeric(14,4) NOT NULL DEFAULT 0,
    uom           text NOT NULL REFERENCES uom(code),
    rate          numeric(14,4)
);

-- one row per physical coil (batch)
CREATE TABLE coil (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    coil_no        text NOT NULL,                -- producer's coil / batch number
    item_id        bigint NOT NULL REFERENCES item(id),
    grn_line_id    bigint REFERENCES grn_line(id),
    godown_id      bigint REFERENCES godown(id),
    thickness_mm   numeric(6,3),
    width_mm       numeric(8,2),
    coating        text,
    colour_code    text,
    gross_weight_kg numeric(12,3),
    net_weight_kg  numeric(12,3) NOT NULL,
    balance_kg     numeric(12,3) NOT NULL,
    length_m       numeric(12,2),
    rate_per_mt    numeric(14,4),
    status         text NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock','in_production','consumed','returned','scrapped')),
    received_on    date,
    created_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (item_id, coil_no)
);
CREATE INDEX ix_coil_no_trgm ON coil USING gin (coil_no gin_trgm_ops);
CREATE INDEX ix_coil_open ON coil(item_id) WHERE status IN ('in_stock','in_production');

-- append-only stock ledger
CREATE TABLE stock_move (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    moved_at     timestamptz NOT NULL DEFAULT now(),
    doc_type     text NOT NULL,                  -- 'GRN','ISSUE','RETURN','TRANSFER','PROD_IN','PROD_OUT','DISPATCH','ADJUST','OPENING'
    doc_id       bigint NOT NULL,
    doc_line_id  bigint,
    item_id      bigint NOT NULL REFERENCES item(id),
    coil_id      bigint REFERENCES coil(id),
    godown_id    bigint NOT NULL REFERENCES godown(id),
    qty          numeric(14,4) NOT NULL,         -- + in, - out, in item.uom
    alt_qty      numeric(14,4),                  -- e.g. RMT or pieces alongside MT
    value        numeric(14,2),
    created_by   bigint REFERENCES app_user(id)
);
CREATE INDEX ix_move_item ON stock_move(item_id, moved_at);
CREATE INDEX ix_move_doc ON stock_move(doc_type, doc_id);

CREATE TABLE stock_balance (
    item_id    bigint NOT NULL REFERENCES item(id),
    godown_id  bigint NOT NULL REFERENCES godown(id),
    qty        numeric(14,4) NOT NULL DEFAULT 0,
    value      numeric(14,2) NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (item_id, godown_id)
);

-- keep stock_balance in step with every stock_move
CREATE OR REPLACE FUNCTION trg_stock_move_balance() RETURNS trigger AS $$
BEGIN
    INSERT INTO stock_balance(item_id, godown_id, qty, value, updated_at)
    VALUES (NEW.item_id, NEW.godown_id, NEW.qty, COALESCE(NEW.value,0), now())
    ON CONFLICT (item_id, godown_id) DO UPDATE
       SET qty = stock_balance.qty + EXCLUDED.qty,
           value = stock_balance.value + EXCLUDED.value,
           updated_at = now();
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER stock_move_balance AFTER INSERT ON stock_move
FOR EACH ROW EXECUTE FUNCTION trg_stock_move_balance();

CREATE OR REPLACE FUNCTION trg_stock_move_readonly() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'stock_move is append-only; post a reversing entry instead';
END $$ LANGUAGE plpgsql;

CREATE TRIGGER stock_move_no_update BEFORE UPDATE OR DELETE ON stock_move
FOR EACH ROW EXECUTE FUNCTION trg_stock_move_readonly();

CREATE TABLE material_issue (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no       text UNIQUE NOT NULL,
    doc_date     date NOT NULL DEFAULT current_date,
    issue_to     text NOT NULL CHECK (issue_to IN ('production','maintenance','general','jobwork')),
    job_card_id  bigint,                         -- FK added after job_card
    breakdown_id bigint,                         -- FK added after breakdown
    godown_id    bigint NOT NULL REFERENCES godown(id),
    status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','cancelled')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    created_by   bigint REFERENCES app_user(id)
);

CREATE TABLE material_issue_line (
    id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    issue_id  bigint NOT NULL REFERENCES material_issue(id) ON DELETE CASCADE,
    item_id   bigint NOT NULL REFERENCES item(id),
    coil_id   bigint REFERENCES coil(id),
    qty       numeric(14,4) NOT NULL,
    uom       text NOT NULL REFERENCES uom(code)
);

CREATE TABLE stock_transfer (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no        text UNIQUE NOT NULL,
    doc_date      date NOT NULL DEFAULT current_date,
    from_godown_id bigint NOT NULL REFERENCES godown(id),
    to_godown_id  bigint NOT NULL REFERENCES godown(id),
    status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','cancelled')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    created_by    bigint REFERENCES app_user(id)
);

CREATE TABLE stock_transfer_line (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    transfer_id bigint NOT NULL REFERENCES stock_transfer(id) ON DELETE CASCADE,
    item_id     bigint NOT NULL REFERENCES item(id),
    coil_id     bigint REFERENCES coil(id),
    qty         numeric(14,4) NOT NULL
);

CREATE TABLE stock_count (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no      text UNIQUE NOT NULL,
    count_date  date NOT NULL,
    godown_id   bigint NOT NULL REFERENCES godown(id),
    status      text NOT NULL DEFAULT 'counting' CHECK (status IN ('counting','submitted','approved','posted')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    created_by  bigint REFERENCES app_user(id)
);

CREATE TABLE stock_count_line (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    count_id     bigint NOT NULL REFERENCES stock_count(id) ON DELETE CASCADE,
    item_id      bigint NOT NULL REFERENCES item(id),
    coil_id      bigint REFERENCES coil(id),
    system_qty   numeric(14,4) NOT NULL,
    counted_qty  numeric(14,4)
);

-- purchase bill (bill passing) — posts a Purchase voucher to Tally
CREATE TABLE bill (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no           text UNIQUE NOT NULL,
    supplier_id      bigint NOT NULL REFERENCES party(id),
    supplier_invoice_no   text NOT NULL,
    supplier_invoice_date date NOT NULL,
    taxable_value    numeric(14,2) NOT NULL,
    cgst numeric(14,2) NOT NULL DEFAULT 0, sgst numeric(14,2) NOT NULL DEFAULT 0, igst numeric(14,2) NOT NULL DEFAULT 0,
    tcs  numeric(14,2) NOT NULL DEFAULT 0, round_off numeric(8,2) NOT NULL DEFAULT 0,
    total_value      numeric(14,2) NOT NULL,
    status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','passed','posted_to_tally','cancelled')),
    created_at       timestamptz NOT NULL DEFAULT now(),
    created_by       bigint REFERENCES app_user(id),
    UNIQUE (supplier_id, supplier_invoice_no)
);

CREATE TABLE bill_line (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bill_id      bigint NOT NULL REFERENCES bill(id) ON DELETE CASCADE,
    grn_line_id  bigint REFERENCES grn_line(id),
    item_id      bigint NOT NULL REFERENCES item(id),
    qty          numeric(14,4) NOT NULL,
    rate         numeric(14,4) NOT NULL,
    gst_rate     numeric(5,2) NOT NULL,
    taxable_value numeric(14,2) NOT NULL,
    tally_purchase_ledger text                    -- ledger the line posts to in Tally
);

-- ---------------------------------------------------------------------
-- SALES
-- ---------------------------------------------------------------------
CREATE TABLE enquiry (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no        text UNIQUE NOT NULL,
    doc_date      date NOT NULL DEFAULT current_date,
    party_id      bigint REFERENCES party(id),
    prospect_name text,                          -- before the customer exists as a party
    prospect_mobile text,
    source        text,                          -- 'walk-in','WhatsApp','website','call','dealer','JSW referral'
    project_site  text,
    district      text,
    requirement   text,
    est_value     numeric(14,2),
    owner_id      bigint REFERENCES app_user(id),
    stage         text NOT NULL DEFAULT 'new' CHECK (stage IN ('new','contacted','quoted','negotiation','won','lost')),
    lost_reason   text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    created_by    bigint REFERENCES app_user(id),
    CHECK (party_id IS NOT NULL OR prospect_name IS NOT NULL)
);
CREATE INDEX ix_enquiry_stage ON enquiry(stage, owner_id);

CREATE TABLE follow_up (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    enquiry_id  bigint NOT NULL REFERENCES enquiry(id) ON DELETE CASCADE,
    due_on      date NOT NULL,
    notes       text,
    done_at     timestamptz,
    owner_id    bigint REFERENCES app_user(id)
);

CREATE TABLE quotation (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no       text UNIQUE NOT NULL,
    enquiry_id   bigint REFERENCES enquiry(id),
    party_id     bigint REFERENCES party(id),
    current_revision smallint NOT NULL DEFAULT 0,
    valid_till   date,
    status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','sent','accepted','rejected','expired','cancelled')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    created_by   bigint REFERENCES app_user(id)
);

CREATE TABLE quotation_version (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    quotation_id  bigint NOT NULL REFERENCES quotation(id) ON DELETE CASCADE,
    revision      smallint NOT NULL,
    lines         jsonb NOT NULL,                -- item, profile, colour, thickness, length, qty, uom, rate, gst
    terms         text,
    taxable_value numeric(14,2) NOT NULL,
    tax_value     numeric(14,2) NOT NULL,
    total_value   numeric(14,2) NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    created_by    bigint REFERENCES app_user(id),
    UNIQUE (quotation_id, revision)
);

CREATE TABLE sales_order (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no        text UNIQUE NOT NULL,
    doc_date      date NOT NULL DEFAULT current_date,
    party_id      bigint NOT NULL REFERENCES party(id),
    quotation_version_id bigint REFERENCES quotation_version(id),
    customer_po_no   text,
    customer_po_date date,
    bill_to_address_id bigint REFERENCES party_address(id),
    ship_to_address_id bigint REFERENCES party_address(id),
    delivery_date date,
    payment_terms text,
    taxable_value numeric(14,2) NOT NULL DEFAULT 0,
    tax_value     numeric(14,2) NOT NULL DEFAULT 0,
    total_value   numeric(14,2) NOT NULL DEFAULT 0,
    status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','in_production','partly_dispatched','dispatched','closed','cancelled')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    created_by    bigint REFERENCES app_user(id),
    updated_at    timestamptz,
    updated_by    bigint REFERENCES app_user(id)
);
CREATE INDEX ix_so_party ON sales_order(party_id, doc_date DESC);

CREATE TABLE so_line (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    so_id         bigint NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
    line_no       smallint NOT NULL,
    item_id       bigint NOT NULL REFERENCES item(id),  -- the coil spec (for sheets) or the trading item
    profile_id    bigint REFERENCES profile(id),
    length_mm     numeric(10,2),                 -- cut length for sheets/purlins
    pieces        integer,
    qty           numeric(14,4) NOT NULL,        -- in uom (RMT / MT / NO)
    uom           text NOT NULL REFERENCES uom(code),
    rate          numeric(14,4) NOT NULL,
    gst_rate      numeric(5,2) NOT NULL,
    taxable_value numeric(14,2) NOT NULL,
    needs_production boolean NOT NULL DEFAULT true,
    produced_qty  numeric(14,4) NOT NULL DEFAULT 0,
    dispatched_qty numeric(14,4) NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------
-- PRODUCTION
-- ---------------------------------------------------------------------
CREATE TABLE production_program (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no      text UNIQUE NOT NULL,
    plan_date   date NOT NULL,
    shift       text,
    status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','released','in_progress','completed','cancelled')),
    remarks     text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    created_by  bigint REFERENCES app_user(id)
);

CREATE TABLE job_card (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no        text UNIQUE NOT NULL,
    program_id    bigint REFERENCES production_program(id),
    machine_id    bigint NOT NULL REFERENCES machine(id),
    profile_id    bigint REFERENCES profile(id),
    planned_date  date NOT NULL,
    shift         text,
    operator_name text,
    status        text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','running','paused','completed','cancelled')),
    started_at    timestamptz,
    completed_at  timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    created_by    bigint REFERENCES app_user(id)
);
CREATE INDEX ix_jobcard_machine ON job_card(machine_id, planned_date);

-- cut list: what the job card must make, tied to sales order lines
CREATE TABLE job_card_line (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_card_id bigint NOT NULL REFERENCES job_card(id) ON DELETE CASCADE,
    so_line_id  bigint REFERENCES so_line(id),
    length_mm   numeric(10,2) NOT NULL,
    pieces      integer NOT NULL,
    produced_pieces integer NOT NULL DEFAULT 0
);

CREATE TABLE job_card_coil (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_card_id   bigint NOT NULL REFERENCES job_card(id) ON DELETE CASCADE,
    coil_id       bigint NOT NULL REFERENCES coil(id),
    weight_before_kg numeric(12,3),
    weight_after_kg  numeric(12,3),
    consumed_kg   numeric(12,3) GENERATED ALWAYS AS (weight_before_kg - weight_after_kg) STORED
);

CREATE TABLE production_output (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_card_id  bigint NOT NULL REFERENCES job_card(id) ON DELETE CASCADE,
    job_card_line_id bigint REFERENCES job_card_line(id),
    item_id      bigint NOT NULL REFERENCES item(id),   -- finished item
    length_mm    numeric(10,2),
    pieces       integer,
    rmt          numeric(14,3),
    weight_kg    numeric(12,3),
    recorded_at  timestamptz NOT NULL DEFAULT now(),
    recorded_by  bigint REFERENCES app_user(id)
);

CREATE TABLE scrap_entry (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_card_id bigint NOT NULL REFERENCES job_card(id) ON DELETE CASCADE,
    kind        text NOT NULL CHECK (kind IN ('scrap','offcut','reject')),
    weight_kg   numeric(12,3) NOT NULL,
    length_mm   numeric(10,2),
    reason      text
);

CREATE TABLE downtime (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    machine_id  bigint NOT NULL REFERENCES machine(id),
    job_card_id bigint REFERENCES job_card(id),
    started_at  timestamptz NOT NULL,
    ended_at    timestamptz,
    reason      text NOT NULL,                   -- 'coil change','breakdown','power','no material',...
    breakdown_id bigint
);

ALTER TABLE material_issue ADD CONSTRAINT fk_issue_jobcard FOREIGN KEY (job_card_id) REFERENCES job_card(id);

-- ---------------------------------------------------------------------
-- DISPATCH & INVOICING
-- ---------------------------------------------------------------------
CREATE TABLE dispatch (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no         text UNIQUE NOT NULL,
    doc_date       date NOT NULL DEFAULT current_date,
    so_id          bigint REFERENCES sales_order(id),
    party_id       bigint NOT NULL REFERENCES party(id),
    ship_to_address_id bigint REFERENCES party_address(id),
    godown_id      bigint NOT NULL REFERENCES godown(id),
    transporter_id bigint REFERENCES party(id),
    vehicle_no     text,
    driver_mobile  text,
    lr_no          text,
    tare_weight_kg  numeric(12,3),
    gross_weight_kg numeric(12,3),
    status         text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','loading','loaded','invoiced','in_transit','delivered','cancelled')),
    pod_attachment_id bigint REFERENCES attachment(id),
    created_at     timestamptz NOT NULL DEFAULT now(),
    created_by     bigint REFERENCES app_user(id)
);

CREATE TABLE dispatch_line (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dispatch_id bigint NOT NULL REFERENCES dispatch(id) ON DELETE CASCADE,
    so_line_id  bigint REFERENCES so_line(id),
    item_id     bigint NOT NULL REFERENCES item(id),
    coil_id     bigint REFERENCES coil(id),
    length_mm   numeric(10,2),
    pieces      integer,
    qty         numeric(14,4) NOT NULL,
    uom         text NOT NULL REFERENCES uom(code),
    weight_kg   numeric(12,3)
);

CREATE TABLE invoice (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no          text UNIQUE NOT NULL CHECK (length(doc_no) <= 16),   -- GST limit
    doc_date        date NOT NULL DEFAULT current_date,
    dispatch_id     bigint REFERENCES dispatch(id),
    party_id        bigint NOT NULL REFERENCES party(id),
    place_of_supply char(2) NOT NULL,
    taxable_value   numeric(14,2) NOT NULL,
    cgst numeric(14,2) NOT NULL DEFAULT 0, sgst numeric(14,2) NOT NULL DEFAULT 0, igst numeric(14,2) NOT NULL DEFAULT 0,
    tcs  numeric(14,2) NOT NULL DEFAULT 0, round_off numeric(8,2) NOT NULL DEFAULT 0,
    total_value     numeric(14,2) NOT NULL,
    status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','irn_generated','posted_to_tally','cancelled')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      bigint REFERENCES app_user(id)
);
CREATE INDEX ix_invoice_party ON invoice(party_id, doc_date DESC);

CREATE TABLE invoice_line (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_id    bigint NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
    line_no       smallint NOT NULL,
    dispatch_line_id bigint REFERENCES dispatch_line(id),
    item_id       bigint NOT NULL REFERENCES item(id),
    description   text,
    hsn_code      text NOT NULL,
    qty           numeric(14,4) NOT NULL,
    uom           text NOT NULL REFERENCES uom(code),
    rate          numeric(14,4) NOT NULL,
    gst_rate      numeric(5,2) NOT NULL,
    taxable_value numeric(14,2) NOT NULL,
    tally_sales_ledger text
);

CREATE TABLE einvoice (
    invoice_id  bigint PRIMARY KEY REFERENCES invoice(id),
    irn         text UNIQUE,
    ack_no      text,
    ack_date    timestamptz,
    signed_qr   text,
    status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','generated','cancelled','failed')),
    cancelled_at timestamptz,
    cancel_reason text,
    raw_response jsonb
);

CREATE TABLE ewaybill (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_id    bigint REFERENCES invoice(id),
    dispatch_id   bigint REFERENCES dispatch(id),
    ewb_no        text UNIQUE,
    ewb_date      timestamptz,
    valid_upto    timestamptz,
    vehicle_no    text,
    distance_km   integer,
    status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','generated','updated','extended','cancelled','failed')),
    raw_response  jsonb
);

CREATE TABLE credit_note (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no       text UNIQUE NOT NULL,
    doc_date     date NOT NULL DEFAULT current_date,
    invoice_id   bigint REFERENCES invoice(id),
    party_id     bigint NOT NULL REFERENCES party(id),
    reason       text NOT NULL,
    taxable_value numeric(14,2) NOT NULL,
    tax_value    numeric(14,2) NOT NULL,
    total_value  numeric(14,2) NOT NULL,
    status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','posted_to_tally','cancelled')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    created_by   bigint REFERENCES app_user(id)
);

CREATE TABLE debit_note (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no       text UNIQUE NOT NULL,
    doc_date     date NOT NULL DEFAULT current_date,
    bill_id      bigint REFERENCES bill(id),
    party_id     bigint NOT NULL REFERENCES party(id),
    reason       text NOT NULL,
    taxable_value numeric(14,2) NOT NULL,
    tax_value    numeric(14,2) NOT NULL,
    total_value  numeric(14,2) NOT NULL,
    status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','posted_to_tally','cancelled')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    created_by   bigint REFERENCES app_user(id)
);

-- receipts pulled back from Tally, for outstanding and credit control
CREATE TABLE party_outstanding (
    party_id     bigint PRIMARY KEY REFERENCES party(id),
    outstanding  numeric(14,2) NOT NULL,
    overdue      numeric(14,2) NOT NULL DEFAULT 0,
    synced_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- MAINTENANCE
-- ---------------------------------------------------------------------
CREATE TABLE pm_checklist (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        text NOT NULL,
    category    text NOT NULL CHECK (category IN ('mechanical','electrical','hydraulic','pneumatic','lubrication','general')),
    points      jsonb NOT NULL                   -- [{"text":"Check roller alignment","type":"ok_notok"}]
);

CREATE TABLE pm_schedule (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    machine_id    bigint NOT NULL REFERENCES machine(id),
    checklist_id  bigint NOT NULL REFERENCES pm_checklist(id),
    frequency     text NOT NULL CHECK (frequency IN ('daily','weekly','monthly','quarterly','half_yearly','yearly')),
    next_due_on   date NOT NULL,
    assigned_role_id bigint REFERENCES role(id),
    is_active     boolean NOT NULL DEFAULT true
);

CREATE TABLE pm_task (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no       text UNIQUE NOT NULL,
    schedule_id  bigint NOT NULL REFERENCES pm_schedule(id),
    machine_id   bigint NOT NULL REFERENCES machine(id),
    due_on       date NOT NULL,
    status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','skipped','overdue')),
    results      jsonb,                          -- answers per checklist point
    done_by      bigint REFERENCES app_user(id),
    done_at      timestamptz,
    remarks      text
);
CREATE INDEX ix_pm_due ON pm_task(due_on) WHERE status IN ('open','in_progress','overdue');

CREATE TABLE breakdown (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no        text UNIQUE NOT NULL,
    machine_id    bigint NOT NULL REFERENCES machine(id),
    reported_at   timestamptz NOT NULL DEFAULT now(),
    reported_by   bigint REFERENCES app_user(id),
    category      text,
    description   text NOT NULL,
    root_cause    text,
    action_taken  text,
    started_at    timestamptz,
    resolved_at   timestamptz,
    status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting_spares','resolved','closed')),
    downtime_min  integer GENERATED ALWAYS AS ((EXTRACT(EPOCH FROM (resolved_at - reported_at)) / 60)::integer) STORED
);
CREATE INDEX ix_breakdown_machine ON breakdown(machine_id, reported_at DESC);

ALTER TABLE material_issue ADD CONSTRAINT fk_issue_breakdown FOREIGN KEY (breakdown_id) REFERENCES breakdown(id);
ALTER TABLE downtime ADD CONSTRAINT fk_downtime_breakdown FOREIGN KEY (breakdown_id) REFERENCES breakdown(id);

-- ---------------------------------------------------------------------
-- HELPERS
-- ---------------------------------------------------------------------
-- Indian financial year label for a date: 2026-11-17 -> '26-27'
CREATE OR REPLACE FUNCTION fin_year(d date) RETURNS text AS $$
    SELECT CASE WHEN EXTRACT(MONTH FROM d) >= 4
        THEN to_char(d,'YY') || '-' || to_char(d + interval '1 year','YY')
        ELSE to_char(d - interval '1 year','YY') || '-' || to_char(d,'YY') END
$$ LANGUAGE sql IMMUTABLE;

-- atomically take the next document number: SELECT next_doc_no('PO', current_date)
CREATE OR REPLACE FUNCTION next_doc_no(p_type text, p_date date DEFAULT current_date) RETURNS text AS $$
DECLARE fy text := fin_year(p_date); r number_series%ROWTYPE;
BEGIN
    INSERT INTO number_series(doc_type, fin_year, prefix)
    VALUES (p_type, fy, CASE WHEN p_type = 'INV' THEN 'CR/' ELSE 'CR/' || p_type || '/' END)
    ON CONFLICT DO NOTHING;
    UPDATE number_series SET next_no = next_no + 1
     WHERE doc_type = p_type AND fin_year = fy
    RETURNING * INTO r;
    RETURN r.prefix || fy || '/' || lpad((r.next_no - 1)::text, r.pad, '0');
END $$ LANGUAGE plpgsql;
