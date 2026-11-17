-- Reference data only. No Tally masters (items/parties) are loaded here.
SET search_path TO erp, public;

INSERT INTO role(code, name, description) VALUES
 ('admin',       'Administrator',      'Full access, users, settings'),
 ('management',  'Management',         'All modules, all approvals, dashboards'),
 ('purchase',    'Purchase',           'Indents, POs, supplier masters'),
 ('stores',      'Stores',             'GRN, issues, transfers, stock count, coil labels'),
 ('sales',       'Sales',              'Enquiries, quotations, orders, customers'),
 ('planner',     'Production planner', 'Production program, job cards'),
 ('shopfloor',   'Shop floor',         'Own job cards: weights, output, scrap, downtime'),
 ('dispatch',    'Dispatch',           'Dispatch, invoice, e-way bill'),
 ('accounts',    'Accounts',           'Bill passing, invoice approval, Tally sync, credit limits'),
 ('maintenance', 'Maintenance',        'Machines, PM schedules, breakdowns');

-- module codes used by the API and the front end
WITH m(module) AS (VALUES ('masters'),('indent'),('purchase_order'),('grn'),('inventory'),('bill'),
                          ('enquiry'),('quotation'),('sales_order'),('production'),('job_card'),
                          ('dispatch'),('invoice'),('maintenance'),('reports'),('tally_sync'),('admin')),
     a(action) AS (VALUES ('view'),('create'),('edit'),('approve'),('cancel'),('export'),('admin'))
INSERT INTO role_permission(role_id, module, action)
SELECT r.id, m.module, a.action FROM role r, m, a WHERE r.code = 'admin';

WITH m(module) AS (VALUES ('masters'),('indent'),('purchase_order'),('grn'),('inventory'),('bill'),
                          ('enquiry'),('quotation'),('sales_order'),('production'),('job_card'),
                          ('dispatch'),('invoice'),('maintenance'),('reports'),('tally_sync')),
     a(action) AS (VALUES ('view'),('create'),('edit'),('approve'),('cancel'),('export'))
INSERT INTO role_permission(role_id, module, action)
SELECT r.id, m.module, a.action FROM role r, m, a WHERE r.code = 'management';

INSERT INTO role_permission(role_id, module, action)
SELECT r.id, p.module, p.action FROM role r JOIN (VALUES
  ('purchase','masters','view'),('purchase','masters','create'),('purchase','masters','edit'),
  ('purchase','indent','view'),('purchase','indent','create'),('purchase','indent','edit'),
  ('purchase','purchase_order','view'),('purchase','purchase_order','create'),('purchase','purchase_order','edit'),('purchase','purchase_order','export'),
  ('purchase','inventory','view'),('purchase','grn','view'),('purchase','reports','view'),
  ('stores','masters','view'),('stores','indent','view'),('stores','indent','create'),
  ('stores','purchase_order','view'),('stores','grn','view'),('stores','grn','create'),('stores','grn','edit'),
  ('stores','inventory','view'),('stores','inventory','create'),('stores','inventory','edit'),
  ('sales','masters','view'),('sales','enquiry','view'),('sales','enquiry','create'),('sales','enquiry','edit'),
  ('sales','quotation','view'),('sales','quotation','create'),('sales','quotation','edit'),
  ('sales','sales_order','view'),('sales','sales_order','create'),('sales','sales_order','edit'),
  ('sales','inventory','view'),('sales','dispatch','view'),('sales','reports','view'),
  ('planner','masters','view'),('planner','sales_order','view'),('planner','inventory','view'),
  ('planner','production','view'),('planner','production','create'),('planner','production','edit'),
  ('planner','job_card','view'),('planner','job_card','create'),('planner','job_card','edit'),('planner','indent','create'),
  ('shopfloor','job_card','view'),('shopfloor','job_card','edit'),
  ('dispatch','masters','view'),('dispatch','sales_order','view'),('dispatch','inventory','view'),
  ('dispatch','dispatch','view'),('dispatch','dispatch','create'),('dispatch','dispatch','edit'),
  ('dispatch','invoice','view'),('dispatch','invoice','create'),
  ('accounts','masters','view'),('accounts','masters','edit'),('accounts','bill','view'),('accounts','bill','create'),
  ('accounts','bill','approve'),('accounts','invoice','view'),('accounts','invoice','approve'),('accounts','invoice','cancel'),
  ('accounts','tally_sync','view'),('accounts','tally_sync','admin'),('accounts','reports','view'),('accounts','reports','export'),
  ('accounts','grn','view'),('accounts','purchase_order','view'),('accounts','sales_order','view'),
  ('maintenance','masters','view'),('maintenance','maintenance','view'),('maintenance','maintenance','create'),
  ('maintenance','maintenance','edit'),('maintenance','indent','create'),('maintenance','indent','view'),('maintenance','inventory','view')
) AS p(role, module, action) ON p.role = r.code;

INSERT INTO uom(code, name, gst_uqc, decimals) VALUES
 ('MT',  'Metric tonne',   'MTS', 3),
 ('KGS', 'Kilogram',       'KGS', 3),
 ('RMT', 'Running metre',  'MTR', 2),
 ('SQM', 'Square metre',   'SQM', 2),
 ('NO',  'Number',         'NOS', 0),
 ('PCS', 'Pieces',         'PCS', 0),
 ('PKT', 'Packet',         'PAC', 0),
 ('BOX', 'Box',            'BOX', 0),
 ('LTR', 'Litre',          'LTR', 2),
 ('SET', 'Set',            'SET', 0);

-- colour codes as they appear in Crayon's Tally item names.
-- Full colour names are to be confirmed by Crayon, so the code is used as the name for now.
INSERT INTO colour(code, name) VALUES
 ('SB','SB'),('OW','OW'),('BR','BR'),('GG','GG'),('NB','NB'),
 ('MG','MG'),('RB','RB'),('CFG','CFG'),('TQB','TQB'),('GY','GY');

INSERT INTO godown(name, tally_name) VALUES ('Main Location', 'Main Location');

INSERT INTO app_setting(key, value) VALUES
 ('company', '{"name":"CRAYON ROOFINGS & STRUCTURES","short":"CR","address":"8/11/A2, Sadaiyankuppam Village, Elanthancherry, Sadayankuppam, Manali, Chennai-600103","email":"admin@crayonroofings.com","phone":"+91-7401233000","state":"Tamil Nadu","state_code":"33"}'),
 ('tally',   '{"company_name":"CRAYON ROOFINGS & STRUCTURES - (from 1-Apr-2020)","poll_seconds":60}'),
 ('approvals_default', '{"note":"Until rules are set in Admin, every document goes to one management approver","role":"management"}');
