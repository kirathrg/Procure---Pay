import type { PurchaseOrderType } from "../types";

/** Display labels for the four PO types. */
export const PO_TYPE_LABEL: Record<PurchaseOrderType, string> = {
  standard: "Standard",
  planned: "Planned",
  blanket: "Blanket",
  contract: "Contract",
};

/** Menu order — standard first, then the open/recurring instruments. */
export const PO_TYPE_ORDER: PurchaseOrderType[] = ["standard", "planned", "blanket", "contract"];

/**
 * Standard POs cover a single committed purchase. The other three are open
 * instruments that carry a spend ceiling and validity window (`po.allocation`).
 */
export function hasAllocation(poType: PurchaseOrderType): boolean {
  return poType !== "standard";
}
