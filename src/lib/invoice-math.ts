export type LineItem = {
  serviceName: string;
  unitLabel: string;
  unitPrice: number | null;
  quantity: number;
};

export function lineTotal(item: LineItem): number | null {
  if (item.unitPrice === null) return null;
  return round2(item.unitPrice * item.quantity);
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeTotals(items: LineItem[], gstPercent: number) {
  const hasMissingPrice = items.some((item) => item.unitPrice === null);
  const subtotal = round2(
    items.reduce((sum, item) => sum + (lineTotal(item) ?? 0), 0),
  );
  const tax = round2((subtotal * gstPercent) / 100);
  const grandTotal = round2(subtotal + tax);
  return { subtotal, tax, grandTotal, hasMissingPrice };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
