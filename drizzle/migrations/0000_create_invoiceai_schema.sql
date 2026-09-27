-- Pricing source
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  unit_label TEXT NOT NULL DEFAULT 'unit',
  unit_price NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pricing is publicly readable" ON public.services FOR SELECT TO anon, authenticated USING (true);

CREATE SEQUENCE public.invoice_number_seq START 1001;

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE DEFAULT ('INV-' || to_char(now(), 'YYYY') || '-' || nextval('public.invoice_number_seq')),
  customer_name TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  raw_requirement TEXT NOT NULL DEFAULT '',
  gst_percent NUMERIC(5,2) NOT NULL DEFAULT 18,
  status TEXT NOT NULL DEFAULT 'pending_review',
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO anon, authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Invoices are open in this demo workspace" ON public.invoices FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  matched_service_id UUID REFERENCES public.services(id),
  unit_label TEXT NOT NULL DEFAULT 'unit',
  unit_price NUMERIC(12,2),
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX invoice_items_invoice_id_idx ON public.invoice_items(invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO anon, authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Invoice items are open in this demo workspace" ON public.invoice_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.services (name, unit_label, unit_price) VALUES
  ('Landing Page', 'page', 5000),
  ('SEO Consultation', 'hour', 1500),
  ('Logo Design', 'design', 3000),
  ('Social Media Management', 'month', 8000),
  ('Website Maintenance', 'month', 2500),
  ('UI/UX Design', 'screen', 4000),
  ('Content Writing', 'article', 1000);