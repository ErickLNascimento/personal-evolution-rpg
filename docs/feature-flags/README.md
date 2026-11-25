# Feature flags

Cada recurso do app pode ser ligado e desligado pelo Supabase, sem publicar versão nova.
As flags são linhas `feature_<nome>` na tabela `public.app_settings`:

- `value = 1`: ligado.
- `value = 0`: desligado.

## Onde rodar os comandos

No painel do Supabase, abra **SQL Editor** e rode o comando. Outra opção é abrir
**Table Editor → app_settings** e editar a coluna `value` da linha.

## Testar um recurso só no seu aparelho

No build de desenvolvimento (`npx expo run:ios` ou `npx expo start`), a variável
`EXPO_PUBLIC_DEV_FEATURES` em `apps/mobile/.env.local` liga flags só no app de quem roda o Metro,
sem mexer no Supabase:

```bash
EXPO_PUBLIC_DEV_FEATURES=feature_english,feature_data_export
```

Também aceita chaves só de teste: `dev_feedback_prompt_always` faz o pedido de feedback aparecer
sempre que as regras de uso deixarem, ignorando respostas anteriores e a nota já enviada.

Reinicie o Metro depois de mudar (`npx expo start --clear`). Builds de produção ignoram a variável.
O banco continua seguindo a flag real: RPCs de um recurso desligado ainda recusam com `PR050`.

## Quando a mudança vale

- **No app:** na próxima vez que cada pessoa abrir o app (a flag é lida junto com o perfil).
- **No banco:** na hora. Com a flag desligada, as funções que gravam para o recurso recusam a ação
  (erro `PR050`), mesmo para quem chamar a API direto.

Desligar só esconde o recurso e bloqueia novas ações. Os dados já gravados (XP, Cristais,
registros, amizades, compras) continuam guardados e voltam a aparecer quando a flag é religada.

## Ver o estado de todas as flags

```sql
select key, value from public.app_settings where key like 'feature\_%' order by key;
```

## Flags

### Diário de humor: `feature_mood_journal`

Check-in de humor na tela Hoje, cartão de humor em Progresso e itens do diário nas Novidades.
**Começa desligada.**

```sql
-- ligar
update public.app_settings set value = 1 where key = 'feature_mood_journal';
-- desligar
update public.app_settings set value = 0 where key = 'feature_mood_journal';
```

### Exportação de dados (LGPD): `feature_data_export`

Botão "Baixar meus dados" em Perfil → Seus dados: um arquivo JSON com tudo o que o app guarda
sobre a pessoa. **Começa desligada.**

```sql
-- ligar
update public.app_settings set value = 1 where key = 'feature_data_export';
-- desligar
update public.app_settings set value = 0 where key = 'feature_data_export';
```

### Patentes dos chefes: `feature_boss_ranks`

Cada vitória contra um chefe o faz voltar uma patente acima (Soldado, Capitão, General, Lorde), com
mais vida, outra cor e prêmio maior. Vida e prêmio por patente ficam na tabela `boss_ranks`. A
vitória conta no resgate e fica em `boss_victories`. Desligada, todo chefe é Soldado, com a vida e
o prêmio de antes. Chefe do bando sem patente por enquanto. **Começa desligada.**

```sql
-- ligar
update public.app_settings set value = 1 where key = 'feature_boss_ranks';
-- desligar
update public.app_settings set value = 0 where key = 'feature_boss_ranks';
-- ajustar a vida (%) e o prêmio de uma patente (0 Soldado, 1 Capitão, 2 General, 3 Lorde)
update public.boss_ranks set hp_pct = 90, reward = 120 where rank = 3;
```

### Bestiário: `feature_bestiary`

Capítulo "Bestiário" no Progresso, com os chefes vencidos (caídos, na cor da maior patente) e
silhuetas dos que faltam. Só leitura de `boss_victories`. **Começa desligada.**

```sql
-- ligar
update public.app_settings set value = 1 where key = 'feature_bestiary';
-- desligar
update public.app_settings set value = 0 where key = 'feature_bestiary';
```

### Resumo da semana: `feature_weekly_recap`

"Crônica da semana" no topo da aba Progresso, de segunda a quarta, com o balanço da semana
anterior: manchete pela taxa de conclusão, missões, dias perfeitos e XP (comparados com a semana de
antes), o hábito mais constante e se o chefe caiu. Um ponto dourado na aba Progresso avisa até a
pessoa abrir a aba. Só leitura: sem função no banco. **Começa desligada.**

```sql
-- ligar
update public.app_settings set value = 1 where key = 'feature_weekly_recap';
-- desligar
update public.app_settings set value = 0 where key = 'feature_weekly_recap';
```

### Pedido de feedback: `feature_feedback_prompt`

Pop-up "O Oráculo quer ouvir você", com nota de 1 a 5 em gemas e comentário (com nota 1 ou 2,
pergunta o que melhorar). Aparece logo depois de um momento bom (dia perfeito, subir de nível ou
derrotar o chefe), só para quem já usa o app há algum tempo, no máximo uma vez a cada 30 dias, e
nunca mais depois de enviar, de "Não perguntar mais" ou de 3 "Agora não". Desligada, o pop-up não
aparece e `submit_feedback_rating` recusa com `PR050`. **Começa desligada.**

```sql
-- ligar
update public.app_settings set value = 1 where key = 'feature_feedback_prompt';
-- desligar
update public.app_settings set value = 0 where key = 'feature_feedback_prompt';
```

Os números das regras também ficam em `app_settings` e valem na próxima abertura do app:

| Chave | Padrão | O que é |
|---|---|---|
| `feedback_prompt_min_days` | 5 | dias desde o primeiro registro de missão |
| `feedback_prompt_min_missions` | 15 | missões registradas no total |
| `feedback_prompt_cooldown_days` | 30 | intervalo mínimo entre dois pedidos |
| `feedback_prompt_max_dismissals` | 3 | "Agora não" até parar de perguntar |

```sql
-- ex.: pedir mais cedo
update public.app_settings set value = 2 where key = 'feedback_prompt_min_days';
-- notas recebidas (as mais recentes primeiro)
select created_at, rating, message, platform, app_version
from public.feedback where source = 'prompt' order by created_at desc;
```

### Modo férias: `feature_vacation`

Seção "Modo férias" no Perfil e o aviso de férias na tela Hoje. Nos dias de férias nenhum hábito
fica agendado: as missões somem, o streak não conta nem quebra, e chefe da semana, jornadas e
chefe do grupo ignoram o dia. Até 14 dias por período e 30 por ano. Desligada, o app esconde o
recurso e `start_vacation`/`end_vacation` recusam com `PR050`; férias já marcadas continuam
valendo, para não quebrar o streak de quem está viajando. **Começa desligada.**

```sql
-- ligar
update public.app_settings set value = 1 where key = 'feature_vacation';
-- desligar
update public.app_settings set value = 0 where key = 'feature_vacation';
```

### App em inglês: `feature_english`

Seletor de idioma em Perfil e o app em inglês para quem tem o celular em outro idioma que não
português. Desligada, o app fica todo em português. **Começa desligada.**

Traduzido (fases 1 a 3): todas as telas, o conteúdo do jogo (raças, caminhos, estágios, peças do
herói, títulos, chefes, sugestões de recompensa e modelos de hábito do onboarding), notificações,
Novidades e o tour. O Oráculo responde em inglês quando o app manda `locale: "en"`; para isso a
Edge Function precisa estar publicada na versão com esse suporte:
`npx supabase functions deploy ai-plan`. Hábitos e objetivos que o usuário já criou ficam no
idioma em que foram escritos.

```sql
-- ligar
update public.app_settings set value = 1 where key = 'feature_english';
-- desligar
update public.app_settings set value = 0 where key = 'feature_english';
```

### Loja: `feature_shop`

Botão e tela da Loja; compra de cosméticos e resgate de recompensas. Cosméticos já comprados
continuam no herói.

```sql
-- ligar
update public.app_settings set value = 1 where key = 'feature_shop';
-- desligar
update public.app_settings set value = 0 where key = 'feature_shop';
```

### Desafios: `feature_challenges`

Tela Desafios e atalho do chefe na tela Hoje; jornadas e resgate do chefe da semana. Jornadas em
andamento ficam paradas enquanto desligado.

```sql
-- ligar
update public.app_settings set value = 1 where key = 'feature_challenges';
-- desligar
update public.app_settings set value = 0 where key = 'feature_challenges';
```

### Social: `feature_social`

Aba Social e tela do grupo; pedidos de amizade, busca por nome, criar e entrar em grupos,
resgate do chefe do grupo. Amizades e grupos ficam guardados.

```sql
-- ligar
update public.app_settings set value = 1 where key = 'feature_social';
-- desligar
update public.app_settings set value = 0 where key = 'feature_social';
```

### Tipos de hábito: `feature_habit_kinds`

Seletor de tipo (Fazer, Evitar, Contar) ao criar hábito. Hábitos que já são Evitar ou Contar
continuam funcionando.

```sql
-- ligar
update public.app_settings set value = 1 where key = 'feature_habit_kinds';
-- desligar
update public.app_settings set value = 0 where key = 'feature_habit_kinds';
```

### Estatísticas por hábito: `feature_habit_stats`

Cartão de estatísticas (taxa, sequências e mapa de calor) na tela do hábito.

```sql
-- ligar
update public.app_settings set value = 1 where key = 'feature_habit_stats';
-- desligar
update public.app_settings set value = 0 where key = 'feature_habit_stats';
```

### Missão relâmpago: `feature_flash_mission`

Sorteio diário, selo com prazo e bônus da missão relâmpago. Concluir missões continua normal.

```sql
-- ligar
update public.app_settings set value = 1 where key = 'feature_flash_mission';
-- desligar
update public.app_settings set value = 0 where key = 'feature_flash_mission';
```

### Escudos de streak: `feature_streak_shields`

Escudos em Progresso, compra e uso automático. Escudos já usados continuam protegendo os dias.

```sql
-- ligar
update public.app_settings set value = 1 where key = 'feature_streak_shields';
-- desligar
update public.app_settings set value = 0 where key = 'feature_streak_shields';
```

### Oráculo (IA): `feature_oracle`

Oráculo nas telas Hábitos e Progresso e no formulário de missão; geração de planos e revisões.
Útil para cortar o custo de IA na hora.

```sql
-- ligar
update public.app_settings set value = 1 where key = 'feature_oracle';
-- desligar
update public.app_settings set value = 0 where key = 'feature_oracle';
```

A troca de sugestões de um plano só é bloqueada depois de publicar a Edge Function com a checagem
da flag (`npx supabase functions deploy ai-plan`).

### Notificações inteligentes: `feature_smart_notifications`

Opção no Perfil e os avisos de streak em risco, missão relâmpago e promoção. Os lembretes de
horário de cada hábito continuam.

```sql
-- ligar
update public.app_settings set value = 1 where key = 'feature_smart_notifications';
-- desligar
update public.app_settings set value = 0 where key = 'feature_smart_notifications';
```

## Linha ausente

- **Recursos antigos** (todos acima, menos o diário de humor, a exportação de dados e o inglês): sem a linha, contam como **ligados**.
  Só `0` desliga.
- **Recursos novos:** sem a linha, contam como **desligados**. Só `1` liga.

Para recriar uma linha apagada:

```sql
insert into public.app_settings (key, value) values ('feature_shop', 1)
on conflict (key) do update set value = excluded.value;
```

## Criar uma flag para um recurso novo

Regra do projeto (AGENTS.md): todo recurso novo nasce atrás de uma flag.

1. Na migration do recurso, insira a flag desligada:
   ```sql
   insert into public.app_settings (key, value) values ('feature_<nome>', 0);
   ```
2. Registre a chave em `FEATURES` (`packages/domain/src/features.ts`).
3. No app, esconda a interface com `useFeature(FEATURES.<nome>)`. Use `FeatureGate` em telas que
   podem ser abertas direto pelo endereço.
4. Nas funções do banco que gravam para o recurso, recuse quando desligada:
   ```sql
   perform public.require_feature('feature_<nome>');
   ```
5. Escreva teste SQL para a flag ligada e desligada.
6. Marque os itens de Novidades do recurso com `flag: 'feature_<nome>'`.
7. Acrescente a flag neste README.
