# Evolução do herói: raça, caminho e promoções

Status: aprovado · fases 1 (regras e banco), 2 (app) e 3 (pixel art) implementadas em 24/11/2026

## Objetivo

Hoje a classe é uma escolha estática (ou uma compra na Loja) e o herói só "evolui" no número do nível.
A nova proposta faz o herói **mudar de identidade** à medida que o usuário cresce: ele escolhe uma
raça e um caminho no primeiro acesso e é **promovido** de classe em classe (Aventureiro → Lutador →
Guerreiro → Cavaleiro…), como nas trocas de classe dos RPGs clássicos. A diferença do jogo comum:
a promoção exige nível **e** prática real na área de vida do caminho.

## Decisões já tomadas

| Tema | Decisão |
|---|---|
| Raça | Só visual. Nenhum bônus de jogo. |
| Árvore | Linear no começo e com **bifurcação no meio**; o usuário pode trocar de ramo ou de caminho quando seus objetivos mudarem. |
| Condição de promoção | Nível **e** missões concluídas na área do caminho. |
| Classes compradas com Cristais | Os Cristais são devolvidos. |
| Loja | Deixa de vender classes; volta na fase 4 com cosméticos. Até lá, o botão fica escondido. |
| Incentivo extra | Missão relâmpago (ver abaixo). |

## Raças (só visual)

Humano, Elfo, Anão, Orc, Halfling e Draconato (Tolkien e D&D).

| Raça | O que muda no desenho |
|---|---|
| Humano | Base atual. |
| Elfo | Orelhas pontudas, rosto mais fino. |
| Anão | Barba (masculino) ou tranças laterais com contas (feminino). |
| Orc | Presas, sobrancelha marcada e orelhas pontudas; tons de pele verdes e cinza a mais. |
| Halfling | Sardas e orelhinhas redondas. |
| Draconato | Chifres curvos, narinas e escamas; tons de escama (vermelho, azul, dourado). |

A altura diferente (anão e halfling mais baixos) ficou de fora: exigiria uma versão de cada camada
por altura e o atlas passaria do limite de textura dos celulares.

A raça pode ser trocada a qualquer momento na tela do Herói, sem custo.

## Caminhos e áreas

Cada caminho cobre uma ou duas das 8 áreas de vida. Missões de hábitos sem objetivo contam como
Crescimento pessoal (a mesma regra dos títulos).

| Caminho | Áreas | Lema |
|---|---|---|
| Marcial | Saúde | Disciplina forjada todo dia. |
| Arcano | Conhecimento | Conhecimento é o maior poder. |
| Destreza | Produtividade | Foco no alvo, um passo por vez. |
| Espírito | Bem-estar | Equilíbrio entre corpo e mente. |
| Natureza | Crescimento pessoal | Cresce quem cuida das raízes. |
| Canção | Relacionamentos | Cada laço vira uma canção. |
| Ofício | Carreira e Finanças | Mãos firmes constroem o amanhã. |

## Estágios e requisitos

Seis estágios por caminho. Do estágio 3 em diante o caminho se divide em dois ramos (A e B).

| Estágio | Nível mínimo | Missões na área | Cristais extras na área | Ritmo típico* |
|---|---|---|---|---|
| 0 | 1 | 0 | +5% | início |
| 1 | 5 | 10 | +7% | ~1 semana |
| 2 | 10 | 40 | +10% | ~1 mês |
| 3 (escolhe o ramo) | 20 | 120 | +12% | ~4 meses |
| 4 | 30 | 300 | +15% | ~10 meses |
| 5 (lendário) | 40 | 500 | +20% | ~1,5 ano |

\* Com ~5 missões por dia e ~1 delas na área do caminho.

O bônus é em **Cristais** (como o das classes antigas; o XP de cada missão não muda) e é aplicado
**só pelo banco**, em `log_habit`.

## Árvores

Os nomes têm forma masculina e feminina (como Guerreiro/Guerreira hoje).

**Marcial (Saúde)**
Aventureiro → Lutador → Guerreiro → **A:** Cavaleiro → Paladino → Campeão Sagrado
                                   → **B:** Bárbaro → Berserker → Senhor da Guerra

**Arcano (Conhecimento)**
Aprendiz → Iniciado → Mago → **A:** Feiticeiro → Arquimago → Sábio Supremo
                         → **B:** Ocultista → Necromante → Senhor das Almas

**Destreza (Produtividade)**
Batedor → Explorador → Caçador → **A:** Arqueiro → Patrulheiro → Olho de Falcão
                               → **B:** Ladino → Sombra → Mestre das Sombras

**Espírito (Bem-estar)**
Noviço → Acólito → Discípulo → **A:** Monge → Mestre Zen → Iluminado
                             → **B:** Clérigo → Sacerdote → Santo

**Natureza (Crescimento pessoal)**
Andarilho → Herbalista → Druida → **A:** Xamã → Arquidruida → Avatar da Natureza
                                → **B:** Metamorfo → Guardião Selvagem → Espírito da Floresta

**Canção (Relacionamentos)**
Menestrel → Trovador → Bardo → **A:** Cronista → Mestre das Histórias → Voz das Eras
                             → **B:** Skald → Arauto de Guerra → Lenda Épica

**Ofício (Carreira e Finanças)**
Aprendiz de Ofício → Artesão → Artífice → **A:** Inventor → Engenheiro Arcano → Grão-Artífice
                                        → **B:** Mercador → Mestre da Guilda → Barão do Comércio

As vantagens especiais das classes atuais passam para o ramo equivalente:
Destreza B (Ladino) — missão registrada em "Ontem" rende Cristais cheios; Canção — +5 Cristais no dia
perfeito; Natureza — +2 Cristais por missão fácil; Arcano B (Necromante) — +3 Cristais por missão
depois das 20h.

## Promoção

1. Quando nível e missões na área atingem o próximo estágio, aparece o card **"Promoção disponível"**
   na tela Hoje.
2. O usuário abre a **cerimônia de promoção**: no estágio 3 ele escolhe o ramo (A ou B), vendo o
   desenho e a linha completa de cada um; nos demais, só confirma.
3. A função do banco `promote_hero()` confere os requisitos e grava o novo estágio. O app nunca grava
   estágio direto (mesma regra do XP).
4. Cena de evolução: o herói brilha, troca de equipamento e ganha o novo nome; o título de classe
   entra no histórico.

A promoção é sempre confirmada pelo usuário (é um momento de ritual, e no estágio 3 há escolha).

## Trocar de ramo ou de caminho

Os objetivos mudam, e o alinhamento do herói acompanha:

- **Trocar de ramo** (a partir do estágio 3): livre, com espera de 14 dias entre trocas.
- **Trocar de caminho**: livre, com a mesma espera. O nível não muda. O estágio é recalculado pelas
  missões já feitas na área do novo caminho (o histórico conta), então quem já pratica a nova área
  não recomeça do zero.
- A espera evita trocas impulsivas e mantém o significado da escolha.

## O herói mostra a evolução

O material do equipamento (ombreiras, peitoral, lâminas, escudo) muda com o estágio:
couro (0–1) → ferro (2) → aço (3) → prata (4) → ouro (5), e o estágio 5 ganha aura dourada própria.
Cada estágio usa um "kit" (corpo + arma + cabeça + costas). As 9 classes antigas são kits; os ramos
sem desenho equivalente ganharam kits novos: Bárbaro (machado), Feiticeiro (chapéu pontudo e orbe),
Clérigo (maça e escudo), Xamã (cocar e cajado com penas), Metamorfo (orelhas de lobo e garras),
Cronista (livro), Skald (elmo com chifres e trompa), Artesão (martelo), Inventor (óculos e chave
inglesa) e Mercador (boné e bolsa de moedas).

## O que acontece com o que já existe

- **Classes atuais → caminhos:** guerreiro → Marcial; paladino → Marcial A; mago → Arcano;
  necromante → Arcano B; arqueiro → Destreza A; ladino → Destreza B; monge → Espírito A;
  druida → Natureza; bardo → Canção. O estágio de cada conta é calculado pelos requisitos.
- **Cristais:** cada compra de classe é devolvida por um lançamento de estorno no banco (idempotente).
- **Loja:** deixa de vender classes. Proposta: passa a vender **cosméticos exclusivos** (auras
  especiais, armas alternativas, molduras do retrato), que não alteram o jogo.
- **Contas existentes:** ao abrir o app depois da atualização, uma tela única pede a raça e confirma
  o caminho sugerido pela migração.
- **Títulos de nível** continuam como estão; os nomes de classe passam a ser exibidos junto.

## Missão relâmpago

Incentivo para agir cedo, sem premiar quem deixa tudo para a última hora.

- Na primeira vez que o usuário abre o app no dia, uma das missões de hoje ainda não feitas é
  sorteada como **relâmpago**, com prazo de **4 horas** (sem passar da meia-noite local).
- O card mostra a contagem regressiva.
- Concluída hoje dentro do prazo: **+50% do XP da missão** e **+10 Cristais**. Desfazer estorna os dois.
- O sorteio fica fixo no dia. Quem o faz e quem concede o bônus é o banco
  (`my_flash_mission` e `log_habit`).

## Fases de implementação

1. **Regras e banco** (feita). Catálogo de caminhos e estágios; estado do herói (raça, caminho, ramo,
   estágio, data da última troca); contagem de missões por área; `promote_hero()` e
   `change_path()`; bônus por estágio em `log_habit`; migração das contas e devolução dos Cristais;
   RLS e testes SQL; regras puras em `packages/domain` com Jest.
2. **App** (feita). Raça e caminho no onboarding; árvore do caminho na tela do Herói; card "Promoção
   disponível"; cerimônia e cena de evolução; troca de ramo e de caminho; Loja sem classes.
3. **Pixel art** (feita). Camada de raça (6 raças × 2 formas); equipamento por estágio; armas e emblemas
   dos 14 ramos.
4. **Loja de cosméticos.**

## Em aberto

- Lista dos cosméticos da Loja (fase 4).
- Se a cerimônia de promoção deve virar também uma notificação push.
