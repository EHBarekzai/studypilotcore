import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const EventSchema = z.object({
  id: z.string().min(1).max(200),
  event: z.string().min(1).max(100),
  created_at: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const Route = createFileRoute("/api/public/webhooks/noholdpay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const { verifyNoholdpaySignature, handleWebhookEvent, audit } = await import("@/lib/payments.server");
        if (!verifyNoholdpaySignature(raw, request.headers.get("x-webhook-signature"))) {
          await audit({ category: "security", action: "webhook.invalid_signature", details: { size: raw.length } });
          return new Response("Invalid signature", { status: 401 });
        }
        let parsed;
        try {
          parsed = EventSchema.parse(JSON.parse(raw));
        } catch {
          return new Response("Bad payload", { status: 400 });
        }
        try {
          await handleWebhookEvent(parsed);
          return new Response("ok");
        } catch (err) {
          console.error("[noholdpay webhook]", err);
          return new Response("Processing failed", { status: 500 });
        }
      },
    },
  },
});
