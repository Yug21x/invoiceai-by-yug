import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { extractRequirement } from "@/lib/extract.functions";
import { matchService, type Service } from "@/lib/matching";
import { computeTotals, formatCurrency, formatDate, lineTotal } from "@/lib/invoice-math";
import {
  AppHeader,
  MissingPriceBadge,
  Panel,
  Pipeline,
  StatusChip,
  fieldClass,
  labelClass,
} from "@/components/ledger";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InvoiceAI — Brief to approved invoice" },
      {
        name: "description",
        content:
          "Paste a customer brief, let AI extract the details, price it from your rate card and approve a GST-ready invoice.",
      },
      { property: "og:title", content: "InvoiceAI — Brief to approved invoice" },
      {
        property: "og:description",
        content:
          "Turn a natural-language customer request into a priced, reviewable invoice with GST and PDF export.",
      },
    ],
  }),
  component: Composer,
});

const EXAMPLE =
  "Hi, I'm Rahul Sharma. My email is rahul@gmail.com. I need 3 landing pages and 2 hours of SEO consultation. Please add a note that the project is urgent.";

type DraftItem = {
  serviceName: string;
  serviceId: string | null;
  unitLabel: string;
  unitPrice: number | null;
  quantity: number;
};

type Draft = {
  customerName: string;
  customerEmail: string;
  notes: string;
  items: DraftItem[];
};

function Composer() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const extract = useServerFn(extractRequirement);
  const [requirement, setRequirement] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: async (): Promise<Service[]> => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, unit_label, unit_price")
        .order("name");
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        name: row.name,
        unitLabel: row.unit_label,
        unitPrice: Number(row.unit_price),
      }));
    },
  });

  const recentQuery = useQuery({
    queryKey: ["recent-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, customer_name, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const services = servicesQuery.data ?? [];

  const extraction = useMutation({
    mutationFn: async () => {
      const result = await extract({
        data: { requirement, catalog: services.map((service) => service.name) },
      });
      return result;
    },
    onSuccess: (result) => {
      const items: DraftItem[] = result.services.map((service) => {
        const match = matchService(service.name, services);
        return {
          serviceName: match?.name ?? service.name,
          serviceId: match?.id ?? null,
          unitLabel: match?.unitLabel ?? "unit",
          unitPrice: match?.unitPrice ?? null,
          quantity: service.quantity,
        };
      });
      setDraft({
        customerName: result.customerName,
        customerEmail: result.customerEmail,
        notes: result.notes,
        items,
      });
      if (items.some((item) => item.unitPrice === null)) {
        toast.warning("A service isn't on the rate card — pick a match before approving.");
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createInvoice = useMutation({
    mutationFn: async (current: Draft) => {
      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          customer_name: current.customerName,
          customer_email: current.customerEmail,
          notes: current.notes,
          raw_requirement: requirement,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: itemsError } = await supabase.from("invoice_items").insert(
        current.items.map((item, index) => ({
          invoice_id: invoice.id,
          service_name: item.serviceName,
          matched_service_id: item.serviceId,
          unit_label: item.unitLabel,
          unit_price: item.unitPrice,
          quantity: item.quantity,
          position: index,
        })),
      );
      if (itemsError) throw itemsError;
      return invoice.id as string;
    },
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ["recent-invoices"] });
      navigate({ to: "/invoices/$id", params: { id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateItem = (index: number, patch: Partial<DraftItem>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
          }
        : current,
    );

  const totals = draft ? computeTotals(draft.items, 18) : null;

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader />
      <main className="mx-auto max-w-[1440px] px-6 py-8">
        <Pipeline step={draft ? 2 : 1} />

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 space-y-6 lg:col-span-5">
            <Panel title="New invoice" step="Step 01" className="rise">
              <label className={labelClass} htmlFor="requirement">
                Paste the brief
              </label>
              <textarea
                id="requirement"
                value={requirement}
                onChange={(event) => setRequirement(event.target.value)}
                placeholder={EXAMPLE}
                className="h-32 w-full resize-none rounded-lg border border-line bg-paper p-3 text-[13px] leading-relaxed placeholder:text-muted/70 focus:border-ink/30 focus:outline-none"
              />
              <div className="mt-3 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setRequirement(EXAMPLE)}
                  className="text-left font-mono text-[10px] text-muted underline decoration-line hover:text-ink"
                >
                  Use the example brief
                </button>
                <button
                  type="button"
                  disabled={requirement.trim().length < 3 || extraction.isPending}
                  onClick={() => extraction.mutate()}
                  className="rounded-md bg-ink px-4 py-2.5 text-[13px] font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-40"
                >
                  {extraction.isPending ? "Reading brief…" : "Generate Invoice"}
                </button>
              </div>
            </Panel>

            <Panel
              title="Recent invoices"
              right={
                <span className="font-mono text-[10px] text-muted">
                  {recentQuery.data?.length ?? 0}
                </span>
              }
              className="rise"
            >
              {recentQuery.data && recentQuery.data.length > 0 ? (
                <div className="divide-y divide-line">
                  {recentQuery.data.map((invoice) => (
                    <Link
                      key={invoice.id}
                      to="/invoices/$id"
                      params={{ id: invoice.id }}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">
                          {invoice.customer_name || "Unnamed customer"}
                        </span>
                        <span className="block font-mono text-[10px] text-muted">
                          {invoice.invoice_number} · {formatDate(invoice.created_at)}
                        </span>
                      </span>
                      <StatusChip status={invoice.status} />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-muted">
                  No invoices yet. Paste a brief to create the first one.
                </p>
              )}
            </Panel>
          </div>

          <div className="col-span-12 lg:col-span-7">
            <Panel title="Extracted data" step="Step 02" className="rise">
              {!draft ? (
                <p className="text-[13px] text-muted">
                  The customer name, email, services, quantities and notes appear here once the
                  brief is read. Prices are always taken from the rate card — never from the AI.
                </p>
              ) : (
                <>
                  <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelClass} htmlFor="name">
                        Customer
                      </label>
                      <input
                        id="name"
                        className={fieldClass}
                        value={draft.customerName}
                        onChange={(event) =>
                          setDraft({ ...draft, customerName: event.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="email">
                        Email
                      </label>
                      <input
                        id="email"
                        className={fieldClass}
                        value={draft.customerEmail}
                        onChange={(event) =>
                          setDraft({ ...draft, customerEmail: event.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-3 border-b border-line pb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    <span className="col-span-5">Service</span>
                    <span className="col-span-2 text-right">Unit price</span>
                    <span className="col-span-2 text-right">Qty</span>
                    <span className="col-span-3 text-right">Amount</span>
                  </div>

                  {draft.items.map((item, index) => {
                    const total = lineTotal(item);
                    return (
                      <div
                        key={index}
                        className={
                          "grid grid-cols-12 items-center gap-3 border-b border-line py-3 " +
                          (item.unitPrice === null ? "flash-row" : "")
                        }
                      >
                        <div className="col-span-5">
                          <select
                            className={fieldClass}
                            value={item.serviceId ?? ""}
                            onChange={(event) => {
                              const service = services.find((s) => s.id === event.target.value);
                              updateItem(index, {
                                serviceId: service?.id ?? null,
                                serviceName: service?.name ?? item.serviceName,
                                unitLabel: service?.unitLabel ?? "unit",
                                unitPrice: service?.unitPrice ?? null,
                              });
                            }}
                          >
                            <option value="">{item.serviceName} (not on rate card)</option>
                            {services.map((service) => (
                              <option key={service.id} value={service.id}>
                                {service.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <span className="col-span-2 text-right font-mono text-[13px]">
                          {item.unitPrice === null
                            ? "—"
                            : `${formatCurrency(item.unitPrice)}/${item.unitLabel}`}
                        </span>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={item.quantity}
                            onChange={(event) =>
                              updateItem(index, {
                                quantity: Math.max(1, Number(event.target.value) || 1),
                              })
                            }
                            className={fieldClass + " text-right font-mono"}
                          />
                        </div>
                        <span className="col-span-3 text-right">
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

                  <div className="mt-5">
                    <label className={labelClass} htmlFor="notes">
                      Notes
                    </label>
                    <textarea
                      id="notes"
                      value={draft.notes}
                      onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                      className="h-20 w-full resize-none rounded-lg border border-line bg-paper p-3 text-[13px] focus:border-ink/30 focus:outline-none"
                    />
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-4">
                    <span className="font-mono text-[11px] text-muted">
                      Subtotal at 18% GST:{" "}
                      <span className="text-ink">{formatCurrency(totals?.grandTotal ?? 0)}</span>
                    </span>
                    <button
                      type="button"
                      disabled={draft.items.length === 0 || createInvoice.isPending}
                      onClick={() => createInvoice.mutate(draft)}
                      className="rounded-md bg-ink px-5 py-2.5 text-[13px] font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-40"
                    >
                      {createInvoice.isPending ? "Creating…" : "Continue to review"}
                    </button>
                  </div>
                </>
              )}
            </Panel>
          </div>
        </div>
      </main>
    </div>
  );
}
