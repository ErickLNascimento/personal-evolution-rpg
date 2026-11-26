# Roadmap

Atualizado em 24/11/2026. Baseado na comparação com apps parecidos (Habitica, Finch, Duolingo,
Life Reset, Habitify) e no que o app já tem: missões diárias, XP e níveis, streak, herói que evolui
(raça, caminho, promoções), Cristais, missão relâmpago, Oráculo (IA), lembretes por hábito, tour e
feedback.

## 1. Antes de ampliar o grupo de testes (concluído)

Objetivo: enxergar os problemas dos testadores e proteger a retenção nos primeiros dias.

| # | Item | Por quê | Status |
|---|---|---|---|
| 1.1 | **Relatório de erros** (Sentry) | Hoje um travamento só chega se o testador escrever. | Feito: erros, desempenho, logs e replay só em erros (mascarado). Analytics de uso (PostHog) adiado. |
| 1.2 | **Atualizações sem reinstalar** (expo-updates + EAS Update) | Correções de JavaScript chegam aos testadores sozinhas, sem novo APK. | Configurado; vale a partir do próximo build |
| 1.3 | **Proteção de streak** (escudos com Cristais) | Recurso de retenção mais forte do Duolingo e do Finch: perder o streak é quando mais gente abandona. | Feito: até 2 escudos (60 Cristais cada), usados sozinhos |
| 1.4 | **Notificações inteligentes**: streak em risco à noite, missão relâmpago sorteada, promoção disponível | Os avisos com mais efeito sobre a volta ao app. Aproveitam os lembretes e a missão relâmpago que já existem. | Feito: locais, com interruptor no Perfil |

## 2. Mais motivos para voltar (concluído)

| # | Item | Por quê | Status |
|---|---|---|---|
| 2.1 | **Loja de cosméticos** (fase 4 da evolução do herói) | Os Cristais se acumulam sem ter onde gastar. | Feito: auras, roupas e cabelos exclusivos |
| 2.2 | **Recompensas personalizadas** ("ver um episódio = 50 Cristais") | Liga o jogo à vida real, como no Habitica; barato de fazer. | Feito: criar, editar, resgatar e histórico |
| 2.3 | **Desafios com prazo**: jornada de 21/66 dias, chefe da semana | Objetivo maior que o dia a dia (Life Reset, Habitica). | Feito: jornada vence com 80% dos dias (120 ou 450 Cristais); chefe com vida de 80% das missões da semana (40 Cristais) |
| 2.4 | **Estatísticas por hábito**: mapa de calor, taxa de conclusão, melhor sequência | Crítica mais comum ao Life Reset: "não mostra resultados". | Feito |
| 2.5 | **Tipos de hábito**: hábitos a evitar e contador com progresso parcial | "Não fumar", "2 de 8 copos". | Feito |

## 3. Mais adiante

| # | Item | Observação |
|---|---|---|
| 3.1 | **Social**: amigos, grupo, streak compartilhado | +22% de conclusão diária no Duolingo; a parte mais cara de construir. Feito: amigos (código e busca), grupos de até 6 com chefe em conjunto; amigos veem só o resumo. |
| 3.2 | **Widget na tela inicial** | Herói e missões do dia sem abrir o app (Finch, Streaks). Exige código nativo. |
| 3.3 | **Integração com saúde** (Health Connect, Apple Health) | Missões de passos e sono concluídas sozinhas. |
| 3.4 | **Diário ou check-in de humor** | Combina com a revisão semanal do Oráculo (Finch). Feito: check-in na tela Hoje (humor, sentimentos, nota; +3 Cristais no dia) e histórico com a relação humor × missões em Progresso. |
| 3.6 | **Modo férias** | Pausar até 14 dias (30 por ano) sem perder o streak; escolhido em vez de saúde (3.3) por chegar via EAS Update, sem APK novo. Feito: flag `feature_vacation` (desligada até a migration ir para produção). |
| 3.7 | **Aviso de convite de amizade** | Feito (25/11/2026) como opção (B), aviso dentro do app: contador na aba Fogueira e cartão na tela Hoje com Aceitar/Recusar/Depois. Flag `feature_friend_alerts` (desligada até a migration ir para produção). Push de verdade (A) continua para quando houver build nativo novo. |
| 3.5 | **Lançamento**: monetização, iOS (TestFlight), exportar dados (LGPD), inglês | Antes da publicação nas lojas. Exportar dados: código pronto e **em espera** (sem deploy por decisão do produto; flag `feature_data_export` desligada; falta publicar `delete-account` e testar o download no Storage). **Google Play e monetização em espera** (25/11/2026): guia, ficha da loja e páginas de privacidade/exclusão prontos em `docs/google-play/` e `docs/site/`; plano do Premium em `docs/monetizacao.md`. Inglês ligado (`feature_english` = 1). |

## Tarefa: feature flags para os recursos existentes (feita)

Feita em 24/11/2026 na migration `20261126000300_feature_flags.sql`: as 9 flags abaixo nascem ligadas e, para os recursos antigos, a linha ausente também conta como ligada. Caminhos do herói ficaram sem flag (recurso central). Desligar a flag do Oráculo bloqueia novos planos já pelo banco; a Edge Function `ai-plan` também confere a flag (vale para a troca de sugestões) depois de publicada de novo (`npx supabase functions deploy ai-plan`).

Regra desde 24/11/2026 (AGENTS.md): todo recurso novo nasce atrás de uma flag `feature_<nome>` em
`app_settings`. Os recursos abaixo vieram antes da regra e ainda não têm flag.

Como fazer, para cada um:
- Uma migration insere a linha com **valor 1** (ligada). Esses recursos já estão com os testers; com 0 eles sumiriam do app.
- Registrar a chave em `FEATURES` (`packages/domain/src/features.ts`) e esconder a UI com `useFeature`.
- Nas RPCs que gravam para o recurso, recusar com `PR050` quando desligada, com teste SQL dos dois estados.
- Desligar só esconde e bloqueia novas ações: os dados já gravados (XP, Cristais, registros) continuam.

| Recurso | Flag sugerida | O que esconder ou bloquear | Cuidado |
|---|---|---|---|
| Loja (cosméticos e recompensas) | `feature_shop` | Botão Loja, tela `/shop`; `buy_cosmetic`, `redeem_reward` | Cosméticos já comprados continuam no herói. |
| Desafios (jornadas e chefe da semana) | `feature_challenges` | Tela `/challenges`, atalho do chefe na tela Hoje; `start_journey`, `resolve_journey`, `claim_weekly_boss` | Jornadas em andamento ficam paradas enquanto desligado. |
| Social (amigos e grupos) | `feature_social` | Aba Social, tela do grupo; RPCs de amizade, busca, grupo e `claim_group_boss` | Amizades e grupos ficam guardados. |
| Tipos de hábito (Evitar e Contar) | `feature_habit_kinds` | Seletor de tipo no formulário; `set_habit_count` | Hábitos já criados como Contar precisam continuar funcionando (só esconder a criação). |
| Estatísticas por hábito | `feature_habit_stats` | Cartão na tela do hábito | Só leitura: sem RPC. |
| Missão relâmpago | `feature_flash_mission` | Selo e prazo no card; bônus em `log_habit` | O bônus é dado dentro de `log_habit`: bloquear só o bônus, nunca o registro. |
| Escudos de streak | `feature_streak_shields` | Linha de escudos em Progresso, uso automático; `buy_streak_shield`, `use_streak_shield` | Escudos já usados continuam protegendo os dias. |
| Oráculo (IA) | `feature_oracle` | Chamadas ao Oráculo em Hábitos, Progresso e no formulário; Edge Function `ai-plan` | Útil para cortar custo de IA sem novo build. |
| Notificações inteligentes | `feature_smart_notifications` | Interruptor no Perfil e o agendamento em `syncReminders` | Ao desligar, cancelar os avisos já agendados. |
| Caminhos e promoções do herói | `feature_hero_paths` | Banner de promoção, telas `/path` e `/promotion`; `choose_path`, `promote_hero` | Recurso central: avaliar se vale ter flag. |
| Diário de humor | `feature_mood_journal` | — | **Já tem flag** (padrão do modelo). |
