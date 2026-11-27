# Plano de estudo: ferramentas extras (Pomodoro, meditação, treinos, bloqueador de tela)

Ponto de partida: concorrentes vendem "a rotina vira missões, XP e sequência diária" **e** ferramentas
extras dentro do app: timer Pomodoro, meditação, contador de treinos e bloqueador de tela. O objetivo
deste estudo é decidir **quais** trazer, **como** encaixar no RPG (não virar um canivete suíço sem
alma) e **quanto custa** cada uma no nosso stack (Expo SDK 58, Supabase, flags).

Regra de ouro: cada ferramenta precisa **alimentar o jogo**. Usar a ferramenta conclui (ou avança)
uma missão, dá XP pelo caminho de sempre (`log_habit`) e tira vida do chefe. Ferramenta solta, que
não conversa com as missões, fica de fora.

## Perguntas que o estudo precisa responder

1. Os testers usariam cada ferramenta **dentro** do app, ou já usam outro app para isso?
2. A ferramenta aumenta a retenção (D7/D30) ou só enfeita a ficha da loja?
3. Dá para fazer sem código nativo (chega por atualização remota) ou exige APK novo?
4. Há risco de política de loja (permissões sensíveis, revisão da Apple)?
5. É Premium ou grátis? (ver `docs/monetizacao.md`)

## As quatro ferramentas

### 1. Timer de foco (Pomodoro): "Batalha de foco"

- **No RPG:** uma sessão de 25 min é uma batalha contra o chefe da semana. Cada sessão completa
  conclui (ou soma) uma missão de foco e dá o golpe no chefe; abandonar no meio "deixa o chefe
  escapar". Intervalos de 5 min viram "acampamento".
- **Encaixe no que já existe:** missões de **Contar** ("4 sessões de foco") e a categoria
  Produtividade (fraqueza de alguns chefes).
- **Técnico (a validar nos docs do SDK 58):** timer em JS com o horário de término salvo (o app pode
  ir para o fundo); notificação local agendada para o fim da sessão. Avançado: Live Activity no iOS e
  notificação contínua no Android (nativo, fase posterior).
- **Esforço:** baixo a médio. **Sem código nativo** na versão básica.
- **Riscos:** quase nenhum.

### 2. Meditação e respiração: "Santuário"

- **No RPG:** respiração guiada com animação do herói meditando (aura pulsando no ritmo); 1, 3 ou 5
  min. Concluir completa a missão de Bem-estar e recarrega um escudo de sequência? (a decidir).
- **Encaixe:** categoria Bem-estar e o diário de humor (pedir o humor antes e depois e mostrar a
  diferença em Progresso).
- **Técnico:** animação Reanimated/Skia e vibração no ritmo; áudio opcional (`expo-audio`, sons
  próprios ou licenciados). Sem rede.
- **Esforço:** baixo para respiração; médio para meditações guiadas com áudio (conteúdo, voz,
  direitos).
- **Riscos:** direitos de áudio; não fazer alegações de saúde.

### 3. Contador de treinos: "Forja"

- **No RPG:** séries e repetições viram golpes; um treino concluído conclui a missão de Saúde.
  Recordes pessoais viram títulos ("Mão de Ferro").
- **Encaixe:** já existe o tipo **Contar** (ex.: 8 copos). Falta o modo "séries × repetições",
  cronômetro de descanso e histórico por exercício.
- **Técnico:** JS + banco (tabela de séries por registro, com RLS e testes). Integração com Saúde
  (Apple Health / Health Connect) é **nativa** e já está no roadmap (widget e Saúde).
- **Esforço:** médio.
- **Riscos:** baixos sem integração; com Saúde, permissões e revisão de loja.

### 4. Bloqueador de tela: "Selo contra o Basilisco"

- **No RPG:** durante o foco, os apps que distraem ficam "selados"; abrir um deles alimenta o
  Basilisco da Tela. Combina com a Batalha de foco.
- **Técnico (o mais difícil, a validar):**
  - **iOS:** APIs de Tempo de Uso (FamilyControls / ManagedSettings / DeviceActivity). Exigem
    **conta paga da Apple** e **pedido de permissão especial (entitlement) à Apple**, que analisa.
    Módulo nativo próprio (Expo Modules).
  - **Android:** sem API oficial de bloqueio. Caminhos comuns: estatísticas de uso
    (`PACKAGE_USAGE_STATS`) + sobreposição, ou serviço de acessibilidade, que a **Google Play
    restringe** (declaração e justificativa na revisão).
- **Esforço:** alto (nativo nas duas plataformas, APK/build novo).
- **Riscos:** altos: revisão da Apple e da Play, bateria, suporte. Começar com a versão "leve":
  modo foco que **pede** para não usar o celular e mostra quanto tempo a pessoa ficou fora do app
  (sem bloquear de verdade).

## Etapas do estudo

1. **Pesquisa de concorrentes (2 dias):** baixar e usar Life Reset, Finch, Habitica, Forest (foco),
   Opal/One sec (bloqueio) e um app de treino. Anotar: onde a ferramenta fica, como liga ao
   progresso, o que é pago, o que as avaliações elogiam e reclamam.
2. **Conversa com testers (3 dias):** pergunta curta no app (pop-up de feedback já existe) ou
   formulário: "Qual destas você usaria aqui dentro?" e "Que app você usa hoje para isso?".
3. **Protótipos técnicos (1 semana):**
   - Pomodoro: timer que sobrevive ao app ir para o fundo + notificação no fim (iPhone e Android).
   - Respiração: animação do herói no ritmo + vibração.
   - Bloqueador: só leitura de documentação e um teste de viabilidade do módulo nativo; **não**
     implementar antes da decisão.
4. **Decisão (1 dia):** tabela com valor para o usuário × esforço × risco; escolher 1 ou 2 para o
   próximo sprint, cada uma atrás de uma flag `feature_<nome>`.

## Prioridade sugerida (antes do estudo)

| Ordem | Ferramenta | Por quê |
|---|---|---|
| 1 | Batalha de foco (Pomodoro) | Baixo esforço, sem nativo, conversa com chefes e Produtividade |
| 2 | Santuário (respiração) | Baixo esforço, reforça o lado bem-estar (onde o Finch ganha) |
| 3 | Forja (treinos) | Médio; aproveita o tipo Contar; Saúde fica para o build nativo |
| 4 | Selo do Basilisco (bloqueio) | Alto esforço e risco de loja; só depois do lançamento e da conta paga da Apple |

## Como medir

- Uso: % de pessoas ativas que usam a ferramenta por semana.
- Efeito: retenção D7/D30 de quem usa × quem não usa (precisa das métricas de produto, Fase 0 do
  roadmap de lançamento).
- Jogo: missões concluídas por meio da ferramenta.
