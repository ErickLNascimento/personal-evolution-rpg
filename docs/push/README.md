# Sprint: push de verdade (Android)

Objetivo: avisos que chegam com o app fechado, para trazer a pessoa de volta (o que mais pesa nos
concorrentes; ver a pesquisa de mercado). Lembretes de hábito e "sequência em risco" continuam como
notificação local, sem servidor.

Flag: `feature_push` (começa desligada). Desligada, o app não pede permissão nem registra o
aparelho, nada entra na fila e as funções que gravam recusam com `PR050`.

## Avisos

| Categoria | Aviso | Quando |
|---|---|---|
| Social | Convite de amizade recebido | na hora |
| Social | Convite aceito | na hora |
| Social | Convite de missão em equipe / aceito | na hora |
| Social | Missão em equipe cumprida (resgatar) | na varredura, quando os dois bateram a meta |
| Social | Chefe do bando derrotado (resgatar) | na varredura |
| Chefes | Chefe novo da semana | segunda, a partir das 9h (hora da pessoa) |
| Chefes | Chefe da semana derrotado, prêmio esperando | a partir das 19h |
| Chefes | Emboscada começou | no 1º dia, a partir das 9h |
| Chefes | Último dia do Lorde do mês | último dia do mês, a partir das 18h |
| Reengajamento | "Seu herói sente sua falta" | 3+ dias sem missão, entre 18h e 21h, no máximo 1 por semana |

Regras (`packages/domain/src/push.ts`, iguais no banco):
- Silêncio das 22h às 8h no fuso da pessoa: o aviso espera até as 8h.
- No máximo 3 avisos de Chefes + Reengajamento por dia; os sociais não contam.
- Cada aviso tem uma chave única (ex.: `friend_req:<id>`): nunca chega duas vezes.
- Férias: sem avisos de Chefes nem de Reengajamento.
- Aviso com mais de 2 dias na fila é descartado.
- A pessoa liga e desliga cada categoria em Perfil → Avisos.

## Como funciona

1. Eventos sociais: gatilhos no banco põem o aviso na fila (`push_outbox`).
2. A cada 5 minutos o `pg_cron` chama a Edge Function `push-dispatch`, que:
   - roda `push_enqueue_scheduled()` (avisos com hora marcada e varreduras);
   - pega o lote pronto com `push_claim_batch()` (aplica silêncio, limite e preferências);
   - envia pela API de push do Expo (até 100 por requisição);
   - confere os recibos depois de 15 min e apaga os aparelhos que saíram (`DeviceNotRegistered`).
3. O app registra o aparelho (`register_push_token`) depois que a pessoa permite, cria os canais
   do Android (Social, Chefes, Lembretes de volta) e, ao tocar no aviso, abre a tela certa.

## Etapas

1. **Banco e regras** (sem Firebase): tabelas, gatilhos, fila, varredura, testes SQL e de domínio.
2. **Envio**: Edge Function `push-dispatch` + agendamento no `pg_cron`.
3. **App**: permissão no momento certo, registro do aparelho, canais, toque abre a tela,
   Perfil → Avisos.
4. **Nativo** (você): projeto no Firebase, `google-services.json`, chave FCM V1 no EAS,
   APK novo. O APK novo muda o fingerprint: os testers precisam instalar o APK de novo
   (as atualizações remotas do APK atual param).
5. **Teste no aparelho** e liga a flag.

iPhone: o código fica pronto; liga quando houver a conta paga da Apple (chave APNs pelo EAS).

## Passos que dependem de você (etapa 4)

1. <https://console.firebase.google.com> → Adicionar projeto (Analytics pode ficar desligado).
2. Adicionar app Android com o pacote `com.erick.personalevolutionrpg` → baixar
   `google-services.json` e colocar em `apps/mobile/google-services.json`.
3. Configurações do projeto → Contas de serviço → **Gerar nova chave privada** (JSON). Guardar fora
   do repositório.
4. `cd apps/mobile && npx eas-cli@latest credentials` → Android → production →
   Google Service Account → **FCM V1** → enviar a chave do passo 3.
