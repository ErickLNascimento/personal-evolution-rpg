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
| 3.1 | **Social**: amigos, grupo, streak compartilhado | +22% de conclusão diária no Duolingo; a parte mais cara de construir. |
| 3.2 | **Widget na tela inicial** | Herói e missões do dia sem abrir o app (Finch, Streaks). Exige código nativo. |
| 3.3 | **Integração com saúde** (Health Connect, Apple Health) | Missões de passos e sono concluídas sozinhas. |
| 3.4 | **Diário ou check-in de humor** | Combina com a revisão semanal do Oráculo (Finch). |
| 3.5 | **Lançamento**: monetização, iOS (TestFlight), exportar dados (LGPD), inglês | Antes da publicação nas lojas. |
