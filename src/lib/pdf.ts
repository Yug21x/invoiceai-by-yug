import { computeTotals, formatDate, lineTotal, type LineItem } from "./invoice-math";

type InvoiceForPdf = {
  invoice_number: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  notes: string;
  gst_percent: number;
};

const rupees = (value: number) =>
  "Rs. " + new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(value);

export async function downloadInvoicePdf(invoice: InvoiceForPdf, items: LineItem[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const { subtotal, tax, grandTotal } = computeTotals(items, invoice.gst_percent);
  const left = 48;
  const right = 547;
  let y = 64;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("InvoiceAI", left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Automated invoicing back office", left, y + 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(invoice.invoice_number, right, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(formatDate(invoice.created_at), right, y + 14, { align: "right" });

  y += 44;
  doc.setDrawColor(200);
  doc.line(left, y, right, y);

  y += 22;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("BILLED TO", left, y);
  doc.setTextColor(20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.customer_name || "—", left, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(invoice.customer_email || "—", left, y + 30);

  y += 62;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("SERVICE", left, y);
  doc.text("UNIT PRICE", 330, y, { align: "right" });
  doc.text("QTY", 400, y, { align: "right" });
  doc.text("AMOUNT", right, y, { align: "right" });
  doc.setTextColor(20);
  y += 8;
  doc.line(left, y, right, y);

  doc.setFontSize(10);
  for (const item of items) {
    y += 22;
    doc.text(item.serviceName, left, y);
    doc.text(item.unitPrice === null ? "—" : rupees(item.unitPrice), 330, y, { align: "right" });
    doc.text(String(item.quantity), 400, y, { align: "right" });
    const total = lineTotal(item);
    doc.text(total === null ? "Manual review" : rupees(total), right, y, { align: "right" });
  }

  y += 14;
  doc.line(left, y, right, y);

  const rows: Array<[string, string]> = [
    ["Subtotal", rupees(subtotal)],
    [`GST (${invoice.gst_percent}%)`, rupees(tax)],
  ];
  for (const [label, value] of rows) {
    y += 20;
    doc.setTextColor(110);
    doc.text(label, 430, y, { align: "right" });
    doc.setTextColor(20);
    doc.text(value, right, y, { align: "right" });
  }

  y += 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Grand total", 430, y, { align: "right" });
  doc.text(rupees(grandTotal), right, y, { align: "right" });
  doc.setFont("helvetica", "normal");

  if (invoice.notes) {
    y += 40;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("NOTES", left, y);
    doc.setTextColor(20);
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(invoice.notes, right - left), left, y + 16);
  }

  doc.save(`${invoice.invoice_number}.pdf`);
}
