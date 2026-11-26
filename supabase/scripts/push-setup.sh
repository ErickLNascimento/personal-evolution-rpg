#!/usr/bin/env bash
# Prepara o servidor do push de verdade (docs/push/README.md), com a flag feature_push desligada.
# Uso, na raiz do repositório:  bash supabase/scripts/push-setup.sh
#   1. aplica as migrations pendentes;
#   2. cria um segredo novo para a Edge Function e publica a push-dispatch;
#   3. liga pg_cron e pg_net, guarda o segredo no Vault e agenda a chamada a cada 5 minutos.
# Pode rodar de novo: troca o segredo e reagenda.
set -euo pipefail

REF=xkpvisagvqiqtmwihwac
URL="https://$REF.supabase.co/functions/v1/push-dispatch"
SECRET=$(openssl rand -hex 32)

echo "› Migrations"
npx supabase db push --remote="$REF"

echo "› Segredo e Edge Function"
npx supabase secrets set PUSH_DISPATCH_SECRET="$SECRET" --project-ref "$REF"
npx supabase functions deploy push-dispatch --project-ref "$REF"

echo "› Agendamento (pg_cron + pg_net)"
npx supabase db query --remote="$REF" --yes "
create extension if not exists pg_cron;
create extension if not exists pg_net;
do \$\$ begin
  if exists (select 1 from vault.secrets where name = 'push_dispatch_secret') then
    perform vault.update_secret((select id from vault.secrets where name = 'push_dispatch_secret'), '$SECRET');
  else
    perform vault.create_secret('$SECRET', 'push_dispatch_secret');
  end if;
end \$\$;
select cron.schedule('push-dispatch', '*/5 * * * *', \$cron\$
  select net.http_post(
    url := '$URL',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_dispatch_secret')),
    body := '{}'::jsonb);
\$cron\$);
"
echo "✔ Pronto. A flag feature_push continua desligada."
