# Feature flags

Cada recurso do app pode ser ligado e desligado pelo Supabase, sem publicar versão nova.
As flags são linhas `feature_<nome>` na tabela `public.app_settings`:

- `value = 1`: ligado.
- `value = 0`: desligado.

## Onde rodar os comandos

No painel do Supabase, abra **SQL Editor** e rode o comando. Outra opção é abrir
**Table Editor → app_settings** e editar a coluna `value` da linha.

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

- **Recursos antigos** (todos acima, menos o diário de humor): sem a linha, contam como **ligados**.
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
