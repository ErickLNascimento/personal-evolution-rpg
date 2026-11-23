# Personal Evolution RPG

App mobile de evolução pessoal com gamificação RPG e IA. Expo (iOS e Android) + Supabase.
O PRD da Fase 1 define o escopo; este repositório está na **Sprint 6 (conta completa)**. Sprint 1: login e cadastro por e-mail, fuso horário, consentimento da IA e logout. Sprint 2: hábitos (criar, editar, arquivar, agenda, meta e objetivo) e a tela **Hoje** ligada ao banco. Sprint 3: tela **Progresso** com nível, streak, XP por dia e revisão semanal. Sprint 4: **Sugestões da IA** (plano inicial e revisão semanal, com aceite por hábito; a chave da IA fica para depois). Sprint 5: **onboarding** no primeiro acesso (nome, áreas de foco, ritmo e primeiros hábitos a partir de modelos). Sprint 6: **redefinir senha** por e-mail e **excluir a conta** pelo app.

## Estrutura

```
apps/mobile/          App Expo (Expo Router, rotas em src/app/)
packages/domain/      Regras puras: XP, nível, streak, agenda por fuso (com testes)
supabase/migrations/  Schema, RLS e funções log_habit / undo_habit_log
supabase/sql-tests/   Testes de RLS e XP em Postgres puro (rodam no CI)
.github/workflows/    CI: typecheck, lint, testes e banco
```

## Primeiro uso no Windows

Pré-requisitos: Node 22 (`.nvmrc`), Git e VS Code. Para rodar no Android: Android Studio com o SDK, ou o celular com depuração USB.

```powershell
cd Documents\Codex\personal-evolution-rpg
git init
npm install
npm run check          # typecheck + lint + testes
```

Rodar o app:

```powershell
npm start              # abre o Metro; leia o QR code com o Expo Go (iPhone ou Android)
```

Sem `.env.local`, a tela **Hoje** roda em modo demonstração, com dados em memória.

### Ligar o Supabase (projeto de desenvolvimento na nuvem)

1. Crie um projeto em supabase.com (plano gratuito).
2. Copie `apps/mobile/.env.example` para `apps/mobile/.env.local` e preencha a URL e a anon key.
3. Aplique as migrations pela CLI:

```powershell
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Nunca coloque a `service_role` key no app nem no git.

### Redefinir senha (links do e-mail)

No painel do Supabase, em **Authentication → URL Configuration → Redirect URLs**, adicione:

- `evolutionrpg://**` (builds do app)
- `exp://**` (Expo Go, em desenvolvimento)

O e-mail padrão do Supabase só envia para membros da equipe do projeto e tem limite por hora; para usuários reais, configure um SMTP próprio em **Authentication → SMTP Settings**.

### Excluir conta (Edge Function `delete-account`)

```powershell
npx supabase functions deploy delete-account --use-api
```

### Ligar a IA (Edge Function `ai-plan`)

A função chama o Claude no servidor; a chave da Anthropic fica só nos segredos do Supabase.

```powershell
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # cole a sua chave
npx supabase functions deploy ai-plan --use-api         # só se mudar o código da função
```

Limites: 3 planos iniciais por dia e 2 revisões por semana por usuário, e só com a permissão da IA ativa no Perfil.

## Regras do projeto

- **XP só é gravado pelo banco**, pelas funções `log_habit` e `undo_habit_log`. O app nunca insere em `xp_transactions`, e a IA nunca altera XP.
- **Regras de negócio ficam em `packages/domain`**, sem React nem Supabase, sempre com teste.
- **`ios/` e `android/` não vão para o git.** Configuração nativa só em `app.json` (Continuous Native Generation).
- Instale libs nativas com `npx expo install`, nunca `npm install` direto.
- Quebra de linha LF em tudo (`.gitattributes` e `.editorconfig`), para o projeto abrir igual no Windows e no Mac.

## Migrar para o Mac

1. Instale Xcode, Command Line Tools, Homebrew, CocoaPods (`brew install cocoapods`) e Node 22.
2. `git clone` do repositório e `npm ci`.
3. Copie o `apps/mobile/.env.local` manualmente (ele não está no git).
4. Com o iPhone conectado: `cd apps/mobile && npx expo run:ios --device`. No Xcode, use o Personal Team (grátis, reinstala a cada 7 dias).

## Testes

| Comando | O que testa |
| --- | --- |
| `npm test` | Regras de XP, nível, streak e agenda (Jest) |
| `npm run typecheck` | TypeScript em todos os pacotes |
| `npm run lint` | ESLint do app |
| CI `database` | Migrations, RLS entre usuários, idempotência de XP, desfazer e bônus de dia perfeito |
