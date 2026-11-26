# Monetização: Herói Lendário (proposta)

Princípio: **o jogo inteiro funciona de graça, para sempre.** Ao contrário de apps em que tudo fica
atrás da assinatura, aqui o gratuito cria hábitos, ganha XP, mantém a sequência e enfrenta todos os
chefes. O Premium dá **mais**, sem tirar o que o gratuito tem e sem vender vantagem no jogo
(não vende XP nem Cristais).

## O que fica em cada plano

| Recurso | Gratuito | Herói Lendário |
|---|---|---|
| Hábitos e missões, XP, nível, sequência | Ilimitado | Ilimitado |
| Chefe da semana, emboscadas, Lorde do mês, bestiário | Sim | Sim |
| Herói, raças, caminhos e estágios | Sim | Sim |
| Amigos | Sim | Sim |
| Exportar e excluir dados (LGPD) | Sim | Sim |
| **Oráculo (IA)** | Plano inicial + 1 revisão por mês | Revisão toda semana e troca de sugestões |
| **Grupos (bandos)** | 1 grupo | 5 grupos |
| **Escudos de sequência guardados** | Até 2 (como hoje) | Até 4 |
| **Jornadas ativas** | 3 (como hoje) | 5 |
| **Estatísticas** | Últimos 30 dias | Histórico completo, humor × missões por área |
| **Visuais** | Loja com Cristais | + coleção lendária exclusiva (auras, roupas) e um visual novo por mês |
| **Selo no herói** | — | Moldura dourada visível para os amigos na Fogueira |
| **Recompensas personalizadas** | Até 5 | Ilimitadas |

O Oráculo é o recurso que tem custo real por uso (chamadas de IA), então é o limite que mais pesa.
Os demais são extras de quem já usa muito.

**Quem já usa hoje não perde nada:** grupos, recompensas e jornadas que já existem acima do limite
continuam; o limite só vale para criar novos.

## Preço sugerido (Brasil)

- Mensal: R$ 9,90
- Anual: R$ 59,90 (cerca de 50% de desconto)
- 7 dias grátis na primeira assinatura

A Play cobra 15% de taxa nas assinaturas.

## Como funciona por dentro

- **Cobrança:** Google Play Billing (e depois App Store) pelo **RevenueCat** (`react-native-purchases`,
  com plugin do Expo). Ele cuida de recibos, renovação, teste grátis e cancelamento. É grátis até
  US$ 2,5 mil de receita por mês.
- **Fonte da verdade no banco:** tabela `entitlements` (usuário, plano, validade), gravada **só** por
  uma Edge Function que recebe o webhook do RevenueCat. Uma função `is_premium(uid)` é usada pelas
  RPCs para aplicar os limites (por exemplo, `create_group` recusa o 2º grupo do gratuito). O app
  nunca grava a assinatura.
- **Flag:** `feature_premium`. Desligada, ninguém vê a tela de assinatura e **nenhum limite é
  aplicado** (todos ficam como hoje). Ligada, os limites do gratuito passam a valer.
- **Tela "Herói Lendário":** no Perfil e nos pontos em que o limite aparece (por exemplo, "Criar 2º
  grupo" abre a oferta), com os planos, o teste grátis e "Restaurar compra".
- **Build nativo novo:** o RevenueCat tem código nativo; entra no próximo AAB da Play (e no APK).

## Ordem

1. App na Play em teste fechado, sem cobrança (agora).
2. Com a conta da Play criada: produtos de assinatura no Play Console + projeto no RevenueCat.
3. Código: tabela, webhook, limites nas RPCs com testes SQL, tela de oferta, tudo atrás de
   `feature_premium` desligada.
4. Novo AAB no teste fechado; testar a compra com contas de teste (a Play não cobra delas).
5. Ligar `feature_premium` quando o app for para produção.
