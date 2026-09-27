export type Service = {
  id: string;
  name: string;
  unitLabel: string;
  unitPrice: number;
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word))
    .join(" ");
}

/** Finds the pricing-table row for a requested service name. Never guesses a price. */
export function matchService(requested: string, services: Service[]): Service | null {
  const target = normalize(requested);
  if (!target) return null;
  const exact = services.find((service) => normalize(service.name) === target);
  if (exact) return exact;
  const contained = services.find((service) => {
    const name = normalize(service.name);
    return target.includes(name) || name.includes(target);
  });
  return contained ?? null;
}
