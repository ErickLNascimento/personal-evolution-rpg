// Edge Function delete-account: exclui a conta do usuário logado e todos os dados dele.
// Apagar em auth.users remove em cascata perfil, objetivos, hábitos, registros, XP e planos.
// Só roda aqui porque exige a service role, que nunca vai para o app.
//
// POST { "confirm": "EXCLUIR" }  (Authorization: Bearer <jwt do usuário>)
import { createClient } from "npm:@supabase/supabase-js@2.119.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "Use POST." });

  // Login primeiro: o gateway pode deixar passar chamadas só com a chave pública.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return reply(401, { error: "Entre na sua conta para excluí-la." });

  // Confirmação explícita, para nenhuma chamada acidental apagar a conta.
  const body = await req.json().catch(() => null);
  if (typeof body?.confirm !== "string" || body.confirm.trim().toUpperCase() !== "EXCLUIR") {
    return reply(400, { error: 'Confirme digitando "EXCLUIR".' });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
  const { data, error } = await asUser.auth.getUser(jwt);
  if (error || !data.user) return reply(401, { error: "Sessão inválida. Entre de novo." });

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  // Arquivo da exportação de dados (LGPD), se houver: o Storage não apaga em cascata com a conta.
  const { error: storageError } = await admin.storage.from("exports").remove([`${data.user.id}/dados.json`]);
  if (storageError) console.error("exports.remove", storageError.message);
  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    console.error("deleteUser", deleteError.message);
    return reply(500, { error: "Não foi possível excluir a conta. Tente de novo." });
  }

  return reply(200, { deleted: true });
});
