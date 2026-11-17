import {
  LayoutDashboard, ClipboardList, FileText, PackageCheck, Cylinder, Boxes, ReceiptText,
  MessageSquareText, FileSignature, ShoppingCart, CalendarRange, Factory, Truck, ReceiptIndianRupee,
  Wrench, Siren, Package, Users, Cog, Warehouse, UserCog, RefreshCw, History,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Formatter } from './lib/format'

export type Column = { key: string; label: string; fmt?: Formatter; align?: 'right'; width?: number; status?: boolean }

export type ListDef = {
  id: string
  label: string            // sidebar + page title
  singular: string         // "indent"
  path: string             // route
  endpoint: string         // API list endpoint
  module: string           // permission module
  icon: LucideIcon
  columns: Column[]
  statuses?: string[]      // filter chips
  phase: number            // build phase in which create/edit arrives
  noCreate?: boolean       // records made by other documents (coils come from GRNs)
  empty: string            // what appears here, for the empty state
  keywords?: string        // extra words for the command bar
}

export type NavGroup = { label: string; items: (ListDef | { id: string; label: string; path: string; icon: LucideIcon; module?: string; keywords?: string })[] }

const DOC = (extra: Column[]): Column[] => [{ key: 'doc_no', label: 'No.', width: 170 }, ...extra]

export const LISTS: ListDef[] = [
  // ---- Purchase
  { id: 'indents', label: 'Indents', singular: 'indent', path: '/purchase/indents', endpoint: '/indents', module: 'indent', icon: ClipboardList, phase: 1,
    columns: DOC([{ key: 'doc_date', label: 'Date', fmt: 'date' }, { key: 'indent_type', label: 'Type', fmt: 'label' }, { key: 'department', label: 'Department' },
      { key: 'required_by', label: 'Needed by', fmt: 'date' }, { key: 'priority', label: 'Priority', fmt: 'label' }, { key: 'lines', label: 'Lines', align: 'right' },
      { key: 'raised_by', label: 'Raised by' }, { key: 'status', label: 'Status', status: true }]),
    statuses: ['draft', 'submitted', 'approved', 'partly_ordered', 'ordered', 'rejected'],
    empty: 'Requests for raw material, consumables, spares and services raised by stores, production and maintenance appear here.',
    keywords: 'purchase request requisition' },
  { id: 'pos', label: 'Purchase orders', singular: 'purchase order', path: '/purchase/orders', endpoint: '/purchase-orders', module: 'purchase_order', icon: FileText, phase: 1,
    columns: DOC([{ key: 'doc_date', label: 'Date', fmt: 'date' }, { key: 'supplier', label: 'Supplier' }, { key: 'delivery_date', label: 'Delivery', fmt: 'date' },
      { key: 'total_value', label: 'Value', fmt: 'rupees', align: 'right' }, { key: 'status', label: 'Status', status: true }]),
    statuses: ['draft', 'submitted', 'approved', 'sent', 'partly_received', 'received'],
    empty: 'Approved indents become purchase orders here, sent to suppliers by email and WhatsApp.', keywords: 'po supplier' },
  // ---- Stores
  { id: 'grns', label: 'Goods receipts', singular: 'GRN', path: '/stores/grn', endpoint: '/grns', module: 'grn', icon: PackageCheck, phase: 1,
    columns: DOC([{ key: 'doc_date', label: 'Date', fmt: 'date' }, { key: 'supplier', label: 'Supplier' }, { key: 'supplier_invoice_no', label: 'Supplier invoice' },
      { key: 'vehicle_no', label: 'Vehicle' }, { key: 'qc_status', label: 'Quality check', fmt: 'label' }, { key: 'status', label: 'Status', status: true }]),
    statuses: ['draft', 'posted', 'billed'],
    empty: 'Material received against purchase orders is booked here, with coil numbers and weights for every coil.', keywords: 'grn inward receipt' },
  { id: 'coils', label: 'Coils', singular: 'coil', path: '/stores/coils', endpoint: '/coils', module: 'inventory', icon: Cylinder, phase: 1, noCreate: true,
    columns: [{ key: 'coil_no', label: 'Coil no.', width: 170 }, { key: 'item', label: 'Item' }, { key: 'thickness_mm', label: 'Thk (mm)', fmt: 'num', align: 'right' },
      { key: 'width_mm', label: 'Width (mm)', fmt: 'num', align: 'right' }, { key: 'colour_code', label: 'Colour' },
      { key: 'net_weight_kg', label: 'Received', fmt: 'kg', align: 'right' }, { key: 'balance_kg', label: 'Balance', fmt: 'kg', align: 'right' },
      { key: 'godown', label: 'Godown' }, { key: 'received_on', label: 'Received on', fmt: 'date' }, { key: 'status', label: 'Status', status: true }],
    statuses: ['in_stock', 'in_production', 'consumed'],
    empty: 'Every coil received gets its own record and QR label here, and its balance falls as it is used.', keywords: 'batch coil number' },
  { id: 'stock', label: 'Stock', singular: 'stock line', path: '/stores/stock', endpoint: '/stock', module: 'inventory', icon: Boxes, phase: 1, noCreate: true,
    columns: [{ key: 'item', label: 'Item' }, { key: 'godown', label: 'Godown' }, { key: 'uom', label: 'Unit' },
      { key: 'qty', label: 'Quantity', fmt: 'num', align: 'right' }, { key: 'value', label: 'Value', fmt: 'rupees', align: 'right' }, { key: 'updated_at', label: 'Last movement', fmt: 'dateTime' }],
    empty: 'Live stock by item and godown. It is built only from receipts, issues, production and dispatches, never typed in.', keywords: 'inventory balance closing' },
  { id: 'bills', label: 'Purchase bills', singular: 'bill', path: '/stores/bills', endpoint: '/bills', module: 'bill', icon: ReceiptText, phase: 1,
    columns: DOC([{ key: 'supplier', label: 'Supplier' }, { key: 'supplier_invoice_no', label: 'Supplier invoice' }, { key: 'supplier_invoice_date', label: 'Invoice date', fmt: 'date' },
      { key: 'total_value', label: 'Value', fmt: 'rupees', align: 'right' }, { key: 'status', label: 'Status', status: true }]),
    statuses: ['draft', 'passed', 'posted_to_tally'],
    empty: 'Supplier invoices are passed here against GRNs, then posted to Tally as purchase vouchers.', keywords: 'bill passing purchase voucher' },
  // ---- Sales
  { id: 'enquiries', label: 'Enquiries', singular: 'enquiry', path: '/sales/enquiries', endpoint: '/enquiries', module: 'enquiry', icon: MessageSquareText, phase: 2,
    columns: DOC([{ key: 'doc_date', label: 'Date', fmt: 'date' }, { key: 'customer', label: 'Customer' }, { key: 'source', label: 'Source', fmt: 'label' }, { key: 'district', label: 'District' },
      { key: 'est_value', label: 'Est. value', fmt: 'rupees', align: 'right' }, { key: 'owner', label: 'Owner' }, { key: 'stage', label: 'Stage', status: true }]),
    statuses: ['new', 'contacted', 'quoted', 'negotiation', 'won', 'lost'],
    empty: 'Every enquiry from calls, WhatsApp, walk-ins and the website is tracked here until it is won or lost.', keywords: 'lead pipeline crm' },
  { id: 'quotes', label: 'Quotations', singular: 'quotation', path: '/sales/quotations', endpoint: '/quotations', module: 'quotation', icon: FileSignature, phase: 2,
    columns: DOC([{ key: 'customer', label: 'Customer' }, { key: 'current_revision', label: 'Revision', align: 'right' }, { key: 'valid_till', label: 'Valid till', fmt: 'date' },
      { key: 'total_value', label: 'Value', fmt: 'rupees', align: 'right' }, { key: 'status', label: 'Status', status: true }]),
    statuses: ['draft', 'approved', 'sent', 'accepted', 'rejected', 'expired'],
    empty: 'Quotations with every revision kept, sent to customers as PDF on WhatsApp or email.', keywords: 'quote offer' },
  { id: 'sos', label: 'Sales orders', singular: 'sales order', path: '/sales/orders', endpoint: '/sales-orders', module: 'sales_order', icon: ShoppingCart, phase: 2,
    columns: DOC([{ key: 'doc_date', label: 'Date', fmt: 'date' }, { key: 'customer', label: 'Customer' }, { key: 'customer_po_no', label: 'Customer PO' },
      { key: 'delivery_date', label: 'Delivery', fmt: 'date' }, { key: 'total_value', label: 'Value', fmt: 'rupees', align: 'right' }, { key: 'status', label: 'Status', status: true }]),
    statuses: ['draft', 'approved', 'in_production', 'partly_dispatched', 'dispatched'],
    empty: 'Confirmed orders appear here and feed the production program and dispatch plan.', keywords: 'so order' },
  // ---- Production
  { id: 'programs', label: 'Production program', singular: 'program', path: '/production/programs', endpoint: '/production-programs', module: 'production', icon: CalendarRange, phase: 2,
    columns: DOC([{ key: 'plan_date', label: 'Plan date', fmt: 'date' }, { key: 'shift', label: 'Shift' }, { key: 'remarks', label: 'Remarks' }, { key: 'status', label: 'Status', status: true }]),
    statuses: ['draft', 'released', 'in_progress', 'completed'],
    empty: 'Open order lines are grouped by profile, colour and thickness and planned onto machines here.', keywords: 'plan schedule' },
  { id: 'jobcards', label: 'Job cards', singular: 'job card', path: '/production/job-cards', endpoint: '/job-cards', module: 'job_card', icon: Factory, phase: 2,
    columns: DOC([{ key: 'planned_date', label: 'Date', fmt: 'date' }, { key: 'shift', label: 'Shift' }, { key: 'machine', label: 'Machine' }, { key: 'profile', label: 'Profile' },
      { key: 'operator_name', label: 'Operator' }, { key: 'status', label: 'Status', status: true }]),
    statuses: ['planned', 'running', 'paused', 'completed'],
    empty: 'Each machine run gets a job card: coils used, cut list, output, scrap and downtime, entered from a tablet.', keywords: 'jc machine run' },
  // ---- Dispatch
  { id: 'dispatches', label: 'Dispatches', singular: 'dispatch', path: '/dispatch/dispatches', endpoint: '/dispatches', module: 'dispatch', icon: Truck, phase: 3,
    columns: DOC([{ key: 'doc_date', label: 'Date', fmt: 'date' }, { key: 'customer', label: 'Customer' }, { key: 'vehicle_no', label: 'Vehicle' }, { key: 'status', label: 'Status', status: true }]),
    statuses: ['planned', 'loading', 'loaded', 'invoiced', 'in_transit', 'delivered'],
    empty: 'Loading, weighment, vehicle details and proof of delivery for every despatch are kept here.', keywords: 'loading vehicle delivery' },
  { id: 'invoices', label: 'Invoices', singular: 'invoice', path: '/dispatch/invoices', endpoint: '/invoices', module: 'invoice', icon: ReceiptIndianRupee, phase: 3,
    columns: DOC([{ key: 'doc_date', label: 'Date', fmt: 'date' }, { key: 'customer', label: 'Customer' }, { key: 'taxable_value', label: 'Taxable', fmt: 'rupees', align: 'right' },
      { key: 'total_value', label: 'Total', fmt: 'rupees', align: 'right' }, { key: 'has_irn', label: 'IRN', fmt: 'bool' }, { key: 'ewb_no', label: 'E-way bill' }, { key: 'status', label: 'Status', status: true }]),
    statuses: ['draft', 'approved', 'irn_generated', 'posted_to_tally', 'cancelled'],
    empty: 'Tax invoices with e-invoice IRN and e-way bill, posted to Tally as sales vouchers.', keywords: 'gst irn eway e-way bill tax invoice' },
  // ---- Maintenance
  { id: 'pm', label: 'Preventive maintenance', singular: 'PM task', path: '/maintenance/pm', endpoint: '/pm-tasks', module: 'maintenance', icon: Wrench, phase: 3,
    columns: DOC([{ key: 'machine', label: 'Machine' }, { key: 'due_on', label: 'Due', fmt: 'date' }, { key: 'done_by', label: 'Done by' }, { key: 'status', label: 'Status', status: true }]),
    statuses: ['open', 'in_progress', 'done', 'overdue'],
    empty: 'Scheduled checks for each machine, with checklists filled on the shop floor.', keywords: 'pm checklist schedule' },
  { id: 'breakdowns', label: 'Breakdowns', singular: 'breakdown', path: '/maintenance/breakdowns', endpoint: '/breakdowns', module: 'maintenance', icon: Siren, phase: 3,
    columns: DOC([{ key: 'machine', label: 'Machine' }, { key: 'reported_at', label: 'Reported', fmt: 'dateTime' }, { key: 'description', label: 'Problem' },
      { key: 'downtime_min', label: 'Downtime (min)', fmt: 'num', align: 'right' }, { key: 'status', label: 'Status', status: true }]),
    statuses: ['open', 'in_progress', 'waiting_spares', 'resolved'],
    empty: 'Machine breakdowns from report to fix, with spares used and downtime recorded.', keywords: 'repair downtime' },
  // ---- Masters
  { id: 'items', label: 'Items', singular: 'item', path: '/masters/items', endpoint: '/masters/items', module: 'masters', icon: Package, phase: 0,
    columns: [{ key: 'name', label: 'Item' }, { key: 'group_name', label: 'Group' }, { key: 'uom', label: 'Unit' }, { key: 'hsn_code', label: 'HSN' },
      { key: 'gst_rate', label: 'GST %', fmt: 'num', align: 'right' }, { key: 'stock_qty', label: 'Stock', fmt: 'num', align: 'right' }, { key: 'is_batch_tracked', label: 'Coil-wise', fmt: 'bool' }],
    empty: 'Items are loaded from Tally once the clean-up list is approved, so names match Tally exactly.', keywords: 'stock item product' },
  { id: 'parties', label: 'Parties', singular: 'party', path: '/masters/parties', endpoint: '/masters/parties', module: 'masters', icon: Users, phase: 0,
    columns: [{ key: 'name', label: 'Name' }, { key: 'party_type', label: 'Type', fmt: 'label' }, { key: 'gstin', label: 'GSTIN' }, { key: 'state', label: 'State' },
      { key: 'mobile', label: 'Mobile' }, { key: 'credit_limit', label: 'Credit limit', fmt: 'rupees', align: 'right' }],
    empty: 'Customers, suppliers and transporters are loaded from Tally ledgers with their GSTIN and address.', keywords: 'customer supplier vendor ledger' },
  { id: 'machines', label: 'Machines', singular: 'machine', path: '/masters/machines', endpoint: '/masters/machines', module: 'masters', icon: Cog, phase: 2,
    columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Machine' }, { key: 'kind', label: 'Kind', fmt: 'label' }, { key: 'location', label: 'Location' }, { key: 'make', label: 'Make' }],
    empty: 'Roll-forming lines, purlin lines and utility machines, with the profiles each can run.', keywords: 'roll former line equipment' },
  { id: 'godowns', label: 'Godowns', singular: 'godown', path: '/masters/godowns', endpoint: '/masters/godowns', module: 'masters', icon: Warehouse, phase: 0,
    columns: [{ key: 'name', label: 'Godown' }, { key: 'tally_name', label: 'Tally name' }, { key: 'is_jobwork', label: 'Job work', fmt: 'bool' }],
    empty: 'Storage locations, including job-work locations, matched to Tally godowns.', keywords: 'location warehouse' },
]

const L = (id: string) => LISTS.find(l => l.id === id)!

export const NAV: NavGroup[] = [
  { label: 'Overview', items: [{ id: 'dashboard', label: 'Today', path: '/', icon: LayoutDashboard, keywords: 'dashboard home' }] },
  { label: 'Purchase', items: [L('indents'), L('pos')] },
  { label: 'Stores', items: [L('grns'), L('coils'), L('stock'), L('bills')] },
  { label: 'Sales', items: [L('enquiries'), L('quotes'), L('sos')] },
  { label: 'Production', items: [L('programs'), L('jobcards')] },
  { label: 'Dispatch', items: [L('dispatches'), L('invoices')] },
  { label: 'Maintenance', items: [L('pm'), L('breakdowns')] },
  { label: 'Masters', items: [L('items'), L('parties'), L('machines'), L('godowns')] },
  { label: 'Admin', items: [
    { id: 'users', label: 'Users and roles', path: '/admin/users', icon: UserCog, module: 'admin', keywords: 'permission access' },
    { id: 'tally', label: 'Tally sync', path: '/admin/tally', icon: RefreshCw, module: 'tally_sync', keywords: 'tally outbox voucher posting' },
    { id: 'audit', label: 'Audit log', path: '/admin/audit', icon: History, module: 'admin', keywords: 'history changes' },
  ] },
]
