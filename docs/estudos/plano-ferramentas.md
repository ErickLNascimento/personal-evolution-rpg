# Plano de desenvolvimento: ferramentas sem APK novo

Escopo: as ferramentas do [plano de estudo](ferramentas-extras.md) que chegam por **atualização
remota** (EAS Update), sem código nativo novo. O APK atual já tem: Reanimated e Skia (animação),
`expo-haptics` (vibração), `expo-notifications` (notificações locais) e `expo-sqlite`
(armazenamento local). **Não** tem áudio (`expo-audio`) nem "manter a tela acesa"
(`expo-keep-awake`): essas partes ficam para o próximo build nativo.

| Ferramenta | Entra agora | Fica para o build nativo |
|---|---|---|
| **Batalha de foco** (Pomodoro) | Timer, chefe levando golpes, notificação no fim, intervalo | Tela acesa, Live Activity / notificação contínua |
| **Santuário** (respiração) | Padrões de respiração, herói meditando, vibração no ritmo | Áudio e meditações guiadas |
| **Forja** (treinos) | Séries × repetições, descanso cronometrado, recordes, histórico | Integração com Saúde (Apple Health / Health Connect) |

Fora do escopo: **Selo do Basilisco** (bloqueador de tela), que é nativo e tem risco de revisão nas
lojas.

## Regras que valem para as três

- **XP só por `log_habit`.** A ferramenta registra uma *sessão*; se a sessão estiver ligada a uma
  missão, o banco avança a missão pelos caminhos que já existem (`log_habit` para missão de fazer,
  `set_habit_count` +1 para missão de contar). O app nunca grava XP.
- **O chefe leva o golpe pelo caminho de sempre**: o dano vem dos registros de missão.
- **Uma flag por ferramenta** (`feature_focus`, `feature_sanctuary`, `feature_forge`), inserida
  desligada pela migration, registrada em `FEATURES`, lida com `useFeature`; cada RPC que grava
  recusa com `PR050` quando desligada, com teste SQL dos dois estados; documentada em
  `docs/feature-flags/README.md`; item nas Novidades com `flag` e `summary`.
- **Regras puras em `packages/domain`** com testes Jest; textos em pt-BR e en.
- **Antes de mexer em API do Expo**, conferir os docs do SDK 58 (AGENTS.md).

## Base comum (etapa 0, cerca de 2 dias)

### Banco (migration `..._tools.sql`)

- `habits.tool text check (tool in ('focus', 'breath', 'workout'))`: a missão abre a ferramenta
  (ex.: "4 sessões de foco" com `tool = 'focus'`). Gatilho na tabela recusa com `PR050` quando a
  flag da ferramenta está desligada (mesmo padrão de `reminder_every_minutes`).
- `tool_sessions` (id, user_id, kind, habit_id, local_date, started_at, duration_sec, details jsonb,
  created_at), com RLS (cada um lê só as suas) e sem escrita direta pelo app.
- `complete_tool_session(p_kind, p_habit_id, p_started_at, p_duration_sec, p_details)`:
  - confere a flag do tipo, a duração mínima (foco ≥ 10 min, respiração ≥ 1 min, treino ≥ 1 série),
    que `started_at` não está no futuro e o limite diário (ex.: 16 sessões de foco por dia);
  - grava a sessão e, se houver missão, avança a missão (`log_habit` ou contagem +1);
  - devolve o resultado do registro (XP, Cristais, títulos) para a comemoração no app;
  - é idempotente por (usuário, tipo, `started_at`): repetir não conta duas vezes.

### App

- **Cartão de missão:** missão com `tool` mostra o botão da ferramenta (▶ "Batalhar", "Meditar",
  "Treinar") ao lado do registro manual, que continua valendo.
- **Formulário do hábito:** campo "Ferramenta" (Nenhuma, Foco, Respiração, Treino) quando a flag
  estiver ligada.
- **Rota por ferramenta** (`app/focus.tsx`, `app/sanctuary.tsx`, `app/forge.tsx`), com
  `?habit=<id>` opcional; também acessíveis sem missão (sessão avulsa, sem XP).
- **Sessão sobrevive ao app ir para o fundo ou fechar:** o horário de término fica salvo no aparelho;
  ao voltar, o app calcula o que falta e fecha a sessão que já acabou.

### Testes

- SQL: flag ligada/desligada, RLS, duração mínima, limite diário, idempotência, missão de fazer e de
  contar avançando, XP só por `log_habit`.
- Domínio: validação da sessão e o cálculo do avanço da missão.

## Etapa 1: Batalha de foco (cerca de 1 semana)

**Experiência**
1. Escolhe a duração: 15, 25 ou 50 min (padrão 25) e, se veio de uma missão, ela aparece no topo.
2. A tela da batalha: chefe da semana no centro (sprite que já existe), anel do tempo em volta, barra
   de "vida da batalha". **A cada minuto o chefe leva um golpe** (animação `hit` + vibração leve).
3. **Desistir** pede confirmação: "O chefe escapa". A sessão não conta.
4. Fim: notificação local (agendada no início, cancelada se desistir), comemoração, missão avançada.
5. **Acampamento** (intervalo de 5 min, opcional) com o herói descansando; ao fim, "Mais uma batalha?".

**Domínio** (`packages/domain/src/focus.ts`): durações permitidas, golpes por minuto, estado da
sessão a partir do horário de início/fim (`running`, `done`, `abandoned`), validação mínima.

**Sem tela acesa nesta versão:** o tempo continua com o celular bloqueado (o cálculo é pelo horário
de término) e a notificação avisa o fim.

**Métrica:** sessões concluídas por pessoa ativa por semana; % de desistência.

## Etapa 2: Santuário (cerca de 4 dias)

**Experiência**
1. Escolhe o padrão: **Caixa** (4-4-4-4), **Relaxar** (4-7-8) ou **Coerência** (5-5) e a duração:
   1, 3 ou 5 min.
2. O herói medita no centro, com a **aura crescendo na inspiração e diminuindo na expiração**
   (Reanimated + o efeito de aura que já existe); texto "Inspire · Segure · Expire" e **vibração a
   cada troca de fase** (dá para fazer de olhos fechados).
3. Fim: missão de Bem-estar avançada. Se o diário de humor estiver ligado, pergunta o humor antes e
   depois e mostra a diferença em Progresso.

**Domínio** (`breath.ts`): padrões, fase e progresso da fase num instante `t`, quantos ciclos cabem
na duração.

**Cuidados:** sem alegações de saúde no texto; pausa a qualquer momento.

**Métrica:** sessões por semana; diferença média de humor antes/depois (com o diário ligado).

## Etapa 3: Forja (cerca de 1 semana e meia)

**Experiência**
1. **Plano de treino da missão:** lista de exercícios (nome, séries, repetições, carga opcional),
   salva na missão.
2. **Sessão:** um exercício por vez; tocar em "Série feita" (ajusta repetições/carga se mudou) e o
   **descanso** começa (60/90/120 s) com contagem, vibração e notificação local no fim.
3. Cada série é um **golpe** na "bigorna" (animação de forja com faíscas, Skia); fim do treino
   avança a missão de Saúde.
4. **Recordes pessoais** (maior carga ou mais repetições por exercício) com destaque na sessão e no
   histórico; títulos novos ("Mão de Ferro") ficam para uma segunda versão.
5. **Histórico por exercício:** últimas sessões e o recorde.

**Banco:** `workout_plans` (por missão: exercícios em jsonb, com RLS e escrita por RPC
`save_workout_plan`); séries da sessão ficam em `tool_sessions.details`.

**Domínio** (`forge.ts`): validação do plano e da sessão, volume (séries × repetições × carga),
detecção de recorde.

**Métrica:** treinos concluídos por semana; % de missões de Saúde concluídas pela Forja.

## Etapa 4: acabamento (cerca de 3 dias)

- Novidades (uma linha por ferramenta, com `summary`), docs das flags, textos em inglês.
- Teste no iPhone (Metro) e no Android pelo cabo; atualização remota para os testers.
- Ligar uma ferramenta por vez e acompanhar uso e retenção (precisa das métricas de produto da
  Fase 0 do roadmap de lançamento).

## Ordem e prazos

| Etapa | Entrega | Prazo estimado |
|---|---|---|
| 0 | Base comum (sessões, missão com ferramenta, botão no cartão) | 2 dias |
| 1 | Batalha de foco | 1 semana |
| 2 | Santuário | 4 dias |
| 3 | Forja | 1,5 semana |
| 4 | Acabamento e liberação | 3 dias |

Total: cerca de 4 semanas, cada etapa liberável sozinha atrás da sua flag.

## Para o próximo build nativo

`expo-keep-awake` (tela acesa no foco e no treino), `expo-audio` (sons e meditações guiadas),
Live Activity / notificação contínua do timer e integração com Saúde. Juntar com o build do iOS
pago ou com o próximo APK, para os testers reinstalarem uma vez só.
