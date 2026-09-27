import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid size-7 place-items-center rounded-sm bg-ink font-display text-sm font-bold text-paper">
            I
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight">InvoiceAI</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Back office
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em]">
            <Link
              to="/"
              className="rounded-sm px-3 py-2 text-muted"
              activeOptions={{ exact: true }}
              activeProps={{ className: "rounded-sm px-3 py-2 bg-ink text-paper" }}
            >
              Composer
            </Link>
            <Link
              to="/pricing"
              className="rounded-sm px-3 py-2 text-muted"
              activeProps={{ className: "rounded-sm px-3 py-2 bg-ink text-paper" }}
            >
              Rate card
            </Link>
          </nav>
          <span className="grid size-7 place-items-center rounded-full bg-ink/10 text-[11px] font-semibold">
            AR
          </span>
        </div>
      </div>
    </header>
  );
}

export function Pipeline({ step }: { step: 1 | 2 | 3 }) {
  const steps: Array<[number, string]> = [
    [1, "Compose"],
    [2, "Extract"],
    [3, "Review"],
  ];
  return (
    <div className="rise mb-8 flex items-center">
      {steps.map(([index, label], i) => (
        <div key={label} className="flex items-center">
          {i > 0 && <span className="mx-3 h-px w-10 bg-line" />}
          <div className="flex items-center gap-2">
            <span
              className={
                "grid size-5 place-items-center rounded-full font-mono text-[10px] " +
                (index === step
                  ? "bg-accent text-paper"
                  : index < step
                    ? "bg-ink text-paper"
                    : "bg-line text-muted")
              }
            >
              {index}
            </span>
            <span
              className={
                "font-mono text-[11px] uppercase tracking-[0.14em] " +
                (index === step ? "text-accent" : index < step ? "" : "text-muted")
              }
            >
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Panel({
  title,
  step,
  right,
  children,
  className = "",
}: {
  title: string;
  step?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"rounded-xl bg-surface p-5 ring-1 ring-black/5 " + className}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">{title}</h2>
        {right ??
          (step ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              {step}
            </span>
          ) : null)}
      </div>
      {children}
    </section>
  );
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-approve-soft text-approve",
    manual_review: "bg-accent-soft text-accent",
    pending_review: "bg-ink/5 text-muted",
  };
  const label =
    status === "approved"
      ? "Approved"
      : status === "manual_review"
        ? "Manual review"
        : "Pending Review";
  return (
    <span
      className={
        "rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] " +
        (map[status] ?? map["pending_review"])
      }
    >
      {label}
    </span>
  );
}

export const fieldClass =
  "w-full rounded-md border border-line bg-paper px-3 py-2 text-[13px] focus:border-ink/30 focus:outline-none";

export const labelClass =
  "mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-muted";

export function MissingPriceBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm bg-accent-soft px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-accent">
      <span className="size-1.5 rounded-full bg-accent" />
      Price Unavailable — Manual Review Required
    </span>
  );
}
