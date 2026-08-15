export type Urgency = "low" | "normal" | "urgent";

export interface RequisitionSlot {
  key: "item" | "quantity" | "deadline" | "urgency" | "priority";
  label: string;
  value: string;
}

/** A warehouse employee's request for goods — distinct from the chat-based
 * requisition flow (ChatMessage/RequisitionSlot above). Sits as "pending"
 * until a procurement lead approves it into a real PurchaseOrder. */
export interface PurchaseRequisition {
  id: string;
  createdByName: string;
  item: string;
  quantity: string;
  deadline: string;
  urgency: Urgency;
  notes: string;
  status: "pending" | "in_progress" | "resolved";
  poId?: string;
  poNumber?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  slots?: RequisitionSlot[];
}

/** Directory record — matches the backend's SupplierOut exactly. Sourcing
 * comparison fields (price, lead time, on-time rate) aren't intrinsic to a
 * supplier; they're per-product and computed at sourcing time — see
 * CandidateSupplier. */
export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  addressLine: string;
  category: string;
  taxId: string;
  status: "active" | "preferred" | "blocked";
  createdAt: string;
}

/** One ranked candidate from GET /purchase-orders/{id}/candidate-suppliers.
 * unitPrice/leadTimeDays/preferred come from the real product_suppliers row;
 * onTimeRate is computed from that supplier's PO history. There is no
 * quality or risk score anywhere in the system, so neither is reported. */
export interface CandidateSupplier {
  supplierId: string;
  name: string;
  unitPrice: number;
  totalPrice: number;
  leadTimeDays: number;
  preferred: boolean;
  onTimeRate: number;
  orderCount: number;
  selected: boolean;
  explain?: string | null;
}

export interface CandidateSuppliersResult {
  productId: string | null;
  candidates: CandidateSupplier[];
  unmatched: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  uom: string;
  description: string;
  referencePrice: number;
  status: "active" | "discontinued";
  createdAt: string;
}

export interface ProductSupplier {
  productId: string;
  supplierId: string;
  unitPrice: number;
  leadTimeDays: number;
  preferred?: boolean;
}

/** Directory fields only — matches the backend's SupplierCreate schema.
 * Sourcing-comparison fields (price, unitPrice, qualityScore, etc.) aren't
 * part of the supplier record; a brand-new supplier has no sourcing history
 * yet. */
export interface SupplierCreateInput {
  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressLine?: string;
  category?: string;
  taxId?: string;
  status?: Supplier["status"];
}

export interface Buyer {
  name: string;
  email: string;
  department: string;
}

export type PurchaseOrderType = "standard" | "planned" | "blanket" | "contract";

/** Spend envelope carried by planned/blanket/contract POs. Standard POs have none. */
export interface PurchaseOrderAllocation {
  ceiling: number;
  released: number;
  validFrom: string;
  validTo: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string;
  supplierId: string;
  item: string;
  quantity: number;
  unitPrice: number;
  total: number;
  issuedDate: string;
  status: "pending" | "scanning" | "received" | "matched" | "escalated" | "paid";
  poType: PurchaseOrderType;
  buyer: Buyer;
  allocation?: PurchaseOrderAllocation;
  /** Derived from this PO's most recent receipt — "not_started" if none exists yet. */
  receivingStatus: "not_started" | "pending" | "scanning" | "received";
  /** "received" once any invoice has been extracted for this PO, else "not_started". */
  invoiceStatus: "not_started" | "received";
}

export interface ReceiptRecord {
  poNumber: string;
  scannedQuantity: number;
  status: "pending" | "scanning" | "received";
  damageDetected: boolean;
  timestamp: string;
}

export interface InvoiceField {
  key: string;
  label: string;
  value: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  poNumber: string;
  vendor: string;
  fields: InvoiceField[];
}

export interface MatchField {
  label: string;
  poValue: string;
  receiptValue: string;
  invoiceValue: string;
  match: boolean;
  deltaNote?: string;
}

export interface MatchCase {
  id: string;
  poNumber: string;
  vendor: string;
  fields: MatchField[];
  outcome: "auto-approved" | "escalated" | "pending";
  reason: string;
  routedTo?: string;
  resolvedStatus?: "pending_approval" | "released";
}

export interface Payment {
  id: string;
  poId: string;
  poNumber: string;
  vendor: string;
  matchOutcome: "auto-approved" | "escalated" | "pending";
  amount: number;
  status: "pending" | "released";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: string;
}

export interface AnomalyRecord {
  id: string;
  type: "duplicate-invoice" | "price-jump" | "split-po";
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
  dataPoints: string[];
  timestamp: string;
}

export interface AnalyticsSummary {
  touchlessRate: number;
  avgCycleDays: number;
  costSaved: number;
  exceptionsThisWeek: number;
}

export interface CycleTimePoint {
  week: string;
  avgDays: number;
}

export interface SupplierPerformance {
  name: string;
  onTimeRate: number;
  orders: number;
  avgQuality: number;
}

export interface ExceptionReason {
  reason: string;
  count: number;
}
