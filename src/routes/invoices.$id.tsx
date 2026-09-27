import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  AppHeader,
  MissingPriceBadge,
  Panel,
  Pipeline,
  StatusChip,
  fieldClass,
  labelClass,
} from "@/components/ledger";
import { computeTotals, formatCurrency, formatDate, lineTotal } from "@/lib/invoice-math";
import { downloadInvoicePdf } from "@/lib/pdf";

export const Route = createFileRoute("/invoices/$id")({
  head: () => ({
    meta: [
      { title: "Invoice review — InvoiceAI" },
      {
        name: "description",
        content:
          "Review customer details, quantities, rate-card prices and GST, then approve the invoice and export the PDF.",
      },
      { property: "og:title", content: "Invoice review — InvoiceAI" },
      {
        property: "og:description",
        content: "Approve a priced invoice and export it as a PDF.",
      },
    ],
  }),
  component: ReviewPage,
});

type Item = {
  id: string;
  serviceName: string;
  unitLabel: string;
  unitPrice: number | null;
  quantity: number;
};

function ReviewPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  const invoiceQuery = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const [{ data: invoice, error }, { data: items, error: itemsError }] = await Promise.all([
        supabase.from("invoices").select("*").eq("id", id).single(),
        supabase.from("invoice_items").select("*").eq("invoice_id", id).order("position"),
      ]);
      if (error) throw error;
      if (itemsError) throw itemsError;
      return {
        invoice,
        items: items.map<Item>((row) => ({
          id: row.id,
          serviceName: row.service_name,
          unitLabel: row.unit_label,
          unitPrice: row.unit_price === null ? null : Number(row.unit_price),
          quantity: Number(row.quantity),
        })),
      };
    },
  });

  const [form, setForm] = useState<{
    customerName: string;
    customerEmail: string;
    notes: string;
    gstPercent: number;
    items: Item[];
  } | null>(null);

  useEffect(() => {
    if (!invoiceQuery.data) return;
    const { invoice, items } = invoiceQuery.data;
    setForm({
      customerName: invoice.customer_name,
      customerEmail: invoice.customer_email,
      notes: invoice.notes,
      gstPercent: Number(invoice.gst_percent),
      items,
    });
  }, [invoiceQuery.data]);

  const save = useMutation({
    mutationFn: async (approve: boolean) => {
      if (!form || !invoiceQuery.data) return;
      const { hasMissingPrice } = computeTotals(form.items, form.gstPercent);
      const { error } = await supabase
        .from("invoices")
        .update({
          customer_name: form.customerName,
          customer_email: form.customerEmail,
          notes: form.notes,
          gst_percent: form.gstPercent,
          status: approve ? "approved" : hasMissingPrice ? "manual_review" : "pending_review",
          approved_at: approve ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      for (const item of form.items) {
        const { error: itemError } = await supabase
          .from("invoice_items")
          .update({ quantity: item.quantity })
          .eq("id", item.id);
        if (itemError) throw itemError;
      }
    },
    onSuccess: async (_data, approve) => {
      await queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      await queryClient.invalidateQueries({ queryKey: ["recent-invoices"] });
      toast.success(approve ? "Invoice approved." : "Changes saved.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (invoiceQuery.isError) {
    return (
      <div className="min-h-screen bg-paper">
        <AppHeader />
        <main className="mx-auto max-w-[1440px] px-6 py-8">
          <p className="text-[13px] text-muted">
            This invoice could not be loaded.{" "}
            <Link to="/" className="underline">
              Back to composer
            </Link>
          </p>
        </main>
      </div>
    );
  }

  const invoice = invoiceQuery.data?.invoice;
  const totals = form ? computeTotals(form.items, form.gstPercent) : null;
  const approved = invoice?.status === "approved";

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader />
      <main className="mx-auto max-w-[1440px] px-6 py-8">
        <Pipeline step={3} />

        {!invoice || !form || !totals ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Loading…</p>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 space-y-6 lg:col-span-4">
              <Panel title="Customer" step="Editable" className="rise">
                <div className="mb-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  <span>{invoice.invoice_number}</span>
                  <span>{formatDate(invoice.created_at)}</span>
                </div>
                <label className={labelClass} htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  className={fieldClass}
                  value={form.customerName}
                  onChange={(event) => setForm({ ...form, customerName: event.target.value })}
                />
                <label className={labelClass + " mt-3"} htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  className={fieldClass}
                  value={form.customerEmail}
                  onChange={(event) => setForm({ ...form, customerEmail: event.target.value })}
                />
                <label className={labelClass + " mt-3"} htmlFor="notes">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  className="h-24 w-full resize-none rounded-lg border border-line bg-paper p-3 text-[13px] focus:border-ink/30 focus:outline-none"
                />
                {invoice.raw_requirement && (
                  <div className="mt-4 border-t border-line pt-3">
                    <p className={labelClass}>Original brief</p>
                    <p className="text-[12px] leading-relaxed text-muted">
                      {invoice.raw_requirement}
                    </p>
                  </div>
                )}
              </Panel>
            </div>

            <div className="col-span-12 lg:col-span-8">
              <Panel
                title="Invoice review"
                right={<StatusChip status={invoice.status} />}
                className="rise"
              >
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-12 xl:col-span-8">
                    <div className="grid grid-cols-12 items-center gap-3 border-b border-line pb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                      <span className="col-span-5">Item</span>
                      <span className="col-span-3 text-right">Unit</span>
                      <span className="col-span-2 text-center">Qty</span>
                      <span className="col-span-2 text-right">Amount</span>
                    </div>
                    {form.items.map((item, index) => {
                      const total = lineTotal(item);
                      return (
                        <div
                          key={item.id}
                          className="grid grid-cols-12 items-center gap-3 border-b border-line py-3"
                        >
                          <span className="col-span-5 text-[13px] font-medium">
                            {item.serviceName}
                          </span>
                          <span className="col-span-3 text-right font-mono text-[13px]">
                            {item.unitPrice === null
                              ? "—"
                              : `${formatCurrency(item.unitPrice)}/${item.unitLabel}`}
                          </span>
                          <div className="col-span-2 flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={approved}
                              onClick={() =>
                                setForm({
                                  ...form,
                                  items: form.items.map((row, i) =>
                                    i === index
                                      ? { ...row, quantity: Math.max(1, row.quantity - 1) }
                                      : row,
                                  ),
                                })
                              }
                              className="grid size-6 place-items-center rounded-sm border border-line text-muted hover:bg-paper disabled:opacity-40"
                            >
                              −
                            </button>
                            <span className="w-6 text-center font-mono text-[13px]">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              disabled={approved}
                              onClick={() =>
                                setForm({
                                  ...form,
                                  items: form.items.map((row, i) =>
                                    i === index ? { ...row, quantity: row.quantity + 1 } : row,
                                  ),
                                })
                              }
                              className="grid size-6 place-items-center rounded-sm border border-line text-muted hover:bg-paper disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                          <span className="col-span-2 text-right">
                            {total === null ? (
                              <MissingPriceBadge />
                            ) : (
                              <span className="font-mono text-[13px] font-medium">
                                {formatCurrency(total)}
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                    {totals.hasMissingPrice && (
                      <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-[12px] text-accent">
                        One or more services are not on the rate card. Approval and PDF export stay
                        locked until every line has a real price.
                      </p>
                    )}
                  </div>

                  <div className="col-span-12 xl:col-span-4">
                    <div className="rounded-lg bg-paper p-4 ring-1 ring-black/5">
                      <div className="flex items-center justify-between py-1.5">
                        <span className="font-mono text-[11px] text-muted">Subtotal</span>
                        <span className="font-mono text-[13px]">
                          {formatCurrency(totals.subtotal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="font-mono text-[11px] text-muted">GST</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={50}
                            step={0.5}
                            disabled={approved}
                            value={form.gstPercent}
                            onChange={(event) =>
                              setForm({
                                ...form,
                                gstPercent: Math.min(50, Math.max(0, Number(event.target.value))),
                              })
                            }
                            className="w-16 rounded-sm border border-line bg-surface px-2 py-1 text-right font-mono text-[13px] focus:outline-none disabled:opacity-60"
                          />
                          <span className="font-mono text-[10px] text-muted">%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="font-mono text-[11px] text-muted">Tax</span>
                        <span className="font-mono text-[13px]">{formatCurrency(totals.tax)}</span>
                      </div>
                      <div className="mt-2 border-t border-line pt-3">
                        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                          Grand total
                        </p>
                        <p className="font-display text-[40px] leading-none font-bold tracking-tight">
                          {formatCurrency(totals.grandTotal)}
                        </p>
                      </div>
                      {approved && (
                        <div className="stamp mt-5 grid place-items-center rounded-lg border-2 border-dashed border-approve/40 px-4 py-3">
                          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-approve">
                            Approved
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={approved || save.isPending}
                      onClick={() => save.mutate(false)}
                      className="rounded-md border border-line px-4 py-2.5 text-[13px] font-medium text-muted transition-colors hover:bg-paper disabled:opacity-40"
                    >
                      Save changes
                    </button>
                    <button
                      type="button"
                      disabled={approved || totals.hasMissingPrice || save.isPending}
                      onClick={() => save.mutate(true)}
                      className="rounded-md bg-approve px-5 py-2.5 text-[13px] font-medium text-paper transition-colors hover:bg-approve/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {approved ? "Approved" : "Approve Invoice"}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={!approved}
                    onClick={() =>
                      downloadInvoicePdf(
                        {
                          invoice_number: invoice.invoice_number,
                          created_at: invoice.created_at,
                          customer_name: form.customerName,
                          customer_email: form.customerEmail,
                          notes: form.notes,
                          gst_percent: form.gstPercent,
                        },
                        form.items,
                      )
                    }
                    className="rounded-md bg-ink px-5 py-2.5 text-[13px] font-medium text-paper transition-colors hover:bg-ink/90 disabled:bg-ink/5 disabled:text-muted"
                  >
                    Download PDF
                  </button>
                </div>
              </Panel>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
