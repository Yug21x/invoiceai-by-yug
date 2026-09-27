import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { AppHeader, Panel } from "@/components/ledger";
import { formatCurrency } from "@/lib/invoice-math";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Rate card — InvoiceAI" },
      {
        name: "description",
        content:
          "The single pricing source InvoiceAI uses for every invoice line item: services, units and real prices.",
      },
      { property: "og:title", content: "Rate card — InvoiceAI" },
      {
        property: "og:description",
        content: "Services, units and prices used to build every InvoiceAI invoice.",
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, unit_label, unit_price")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader />
      <main className="mx-auto max-w-[900px] px-6 py-8">
        <Panel title="Rate card" step="Pricing source" className="rise">
          <p className="mb-4 text-[13px] text-muted">
            Every invoice line is priced from this table. Anything a customer asks for that is not
            listed here is flagged for manual review instead of being given a guessed price.
          </p>
          <div className="grid grid-cols-12 items-center gap-3 border-b border-line pb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            <span className="col-span-7">Service</span>
            <span className="col-span-2">Unit</span>
            <span className="col-span-3 text-right">Price</span>
          </div>
          {(servicesQuery.data ?? []).map((service) => (
            <div
              key={service.id}
              className="grid grid-cols-12 items-center gap-3 border-b border-line py-3"
            >
              <span className="col-span-7 text-[13px] font-medium">{service.name}</span>
              <span className="col-span-2 font-mono text-[11px] text-muted">
                per {service.unit_label}
              </span>
              <span className="col-span-3 text-right font-mono text-[13px]">
                {formatCurrency(Number(service.unit_price))}
              </span>
            </div>
          ))}
        </Panel>
      </main>
    </div>
  );
}
