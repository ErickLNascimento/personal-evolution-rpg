// Edge Function push-dispatch: envia os avisos da fila (push_outbox) pela API de push do Expo.
// Chamada a cada 5 minutos pelo pg_cron (ver docs/push/README.md), nunca pelo app.
//
// POST  (cabeçalho x-push-secret: <PUSH_DISPATCH_SECRET>)
//   1. push_enqueue_scheduled: avisos de hora marcada e varreduras;
//   2. push_claim_batch: lote pronto (silêncio, limite e preferências já aplicados no banco);
//   3. envia em pedaços de 100 (limite do Expo) e devolve o resultado com push_report;
//   4. confere os recibos com mais de 15 min e apaga aparelhos que saíram (DeviceNotRegistered).
import { createClient } from "npm:@supabase/supabase-js@2.119.2";

const SEND_URL = "https://exp.host/--/api/v2/push/send";
const RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const CHUNK = 100;
/** Lotes por execução (cada um com até 300 avisos), para não passar do tempo da função. */
const MAX_BATCHES = 5;

interface Row {
  outbox_id: number;
  token: string;
  title: string;
  body: string;
  route: string | null;
  category: string;
}

interface Ticket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** Canal do Android de cada categoria (criados pelo app em features/push). */
const CHANNEL: Record<string, string> = { social: "social", bosses: "bosses", reengage: "reengage" };

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function expoHeaders(): HeadersInit {
  const token = Deno.env.get("EXPO_ACCESS_TOKEN");
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; json: unknown }> {
  // Até 3 tentativas com espera crescente em 429 e 5xx; 4xx não se repete.
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { method: "POST", headers: expoHeaders(), body: JSON.stringify(body) });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      continue;
    }
    return { ok: res.ok, status: res.status, json: await res.json().catch(() => null) };
  }
  return { ok: false, status: 503, json: null };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405, { error: "Use POST." });
  const secret = Deno.env.get("PUSH_DISPATCH_SECRET");
  if (!secret || req.headers.get("x-push-secret") !== secret) return reply(401, { error: "Não autorizado." });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const enq = await db.rpc("push_enqueue_scheduled");
  if (enq.error) console.error("push_enqueue_scheduled", enq.error.message);

  let sentCount = 0;
  const badTokens = new Set<string>();
  for (let b = 0; b < MAX_BATCHES; b++) {
    const { data, error } = await db.rpc("push_claim_batch", { p_limit: 300 });
    if (error) {
      console.error("push_claim_batch", error.message);
      break;
    }
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) break;

    const sent = new Set<number>();
    const failed = new Set<number>();
    const tickets: { ticket_id: string; token: string }[] = [];
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const res = await postJson(
        SEND_URL,
        chunk.map((r) => ({
          to: r.token,
          title: r.title,
          body: r.body,
          sound: "default",
          channelId: CHANNEL[r.category] ?? "default",
          priority: r.category === "social" ? "high" : "default",
          data: { route: r.route ?? "/" },
        })),
      );
      const list = (res.json as { data?: Ticket[] } | null)?.data;
      if (!res.ok || !Array.isArray(list)) {
        console.error("push send", res.status, JSON.stringify(res.json)?.slice(0, 300));
        for (const r of chunk) failed.add(r.outbox_id);
        continue;
      }
      list.forEach((t, k) => {
        const r = chunk[k]!;
        if (t.status === "ok" && t.id) {
          tickets.push({ ticket_id: t.id, token: r.token });
          sent.add(r.outbox_id);
        } else if (t.details?.error === "DeviceNotRegistered") {
          badTokens.add(r.token);
          sent.add(r.outbox_id); // o aviso está resolvido para este aparelho
        } else {
          console.error("push ticket", t.details?.error ?? t.message);
          sent.add(r.outbox_id); // erro do aviso em si (ex.: grande demais): não repete
        }
      });
    }
    // Um aviso enviado para algum aparelho não volta para a fila.
    for (const id of sent) failed.delete(id);
    sentCount += sent.size;
    const rep = await db.rpc("push_report", {
      p_sent: [...sent],
      p_tickets: tickets,
      p_failed: [...failed],
      p_bad_tokens: [...badTokens],
    });
    if (rep.error) console.error("push_report", rep.error.message);
    if (rows.length < 300) break;
  }

  // Recibos: confirma a entrega e descobre aparelhos que saíram.
  const due = await db.rpc("push_tickets_due");
  const dueRows = (due.data ?? []) as { ticket_id: string; token: string }[];
  if (dueRows.length > 0) {
    const res = await postJson(RECEIPTS_URL, { ids: dueRows.map((t) => t.ticket_id) });
    const receipts = ((res.json as { data?: Record<string, Ticket> } | null)?.data ?? {}) as Record<string, Ticket>;
    if (res.ok) {
      const done: string[] = [];
      const bad: string[] = [];
      for (const t of dueRows) {
        const r = receipts[t.ticket_id];
        if (!r) continue; // ainda sem recibo
        done.push(t.ticket_id);
        if (r.status === "error") {
          if (r.details?.error === "DeviceNotRegistered") bad.push(t.token);
          else console.error("push receipt", r.details?.error ?? r.message);
        }
      }
      const rep = await db.rpc("push_report", { p_done_tickets: done, p_bad_tokens: bad });
      if (rep.error) console.error("push_report receipts", rep.error.message);
    } else {
      console.error("push receipts", res.status);
    }
  }

  return reply(200, { enqueued: enq.data ?? 0, sent: sentCount, removedDevices: badTokens.size });
});
