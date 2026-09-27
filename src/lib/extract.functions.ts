import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  requirement: z.string().min(3).max(5000),
  catalog: z.array(z.string()).max(100),
});

const extractionSchema = z.object({
  customerName: z.string().default(""),
  customerEmail: z.string().default(""),
  notes: z.string().default(""),
  services: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.number().positive().max(10000).default(1),
      }),
    )
    .default([]),
});

export type Extraction = z.infer<typeof extractionSchema>;

function parseJsonBlock(text: string): unknown {
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model output");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Extracts structured customer + service data from a natural-language brief.
 * The model never sees or invents prices — pricing comes from the services table.
 */
export const extractRequirement = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const { createLovableAiGatewayRunIdFetch } = await import("./ai-run-id");

    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
      messages: [
        {
          role: "system",
          content: [
            "You extract billing details from a customer's message for an agency invoicing tool.",
            "Return ONLY a JSON object, no prose, no code fences, with this shape:",
            '{"customerName":string,"customerEmail":string,"notes":string,"services":[{"name":string,"quantity":number}]}',
            "Rules:",
            "- Never invent, estimate or mention prices, currency amounts, taxes or totals.",
            "- quantity is the requested count of units (pages, hours, articles, months). Default 1 when unstated.",
            "- Match a service to one of these known catalog names when the meaning is the same, copying the catalog spelling exactly:",
            data.catalog.join(", ") || "(catalog empty)",
            "- If a requested service is not in the catalog, keep the customer's own wording.",
            "- notes captures any instructions, urgency or context. Use an empty string when there are none.",
            "- Use an empty string for a name or email that is not stated.",
          ].join("\n"),
        },
        { role: "user", content: data.requirement },
      ],
    });

    const text = await result.text;
    try {
      return extractionSchema.parse(parseJsonBlock(text));
    } catch (error) {
      console.error("extractRequirement parse failure", { text, error });
      throw new Error("Could not read the brief. Try rephrasing it.");
    }
  });
