-- Pedido de feedback (espelha packages/domain/src/feedbackPrompt.ts).
--   · Pop-up com nota de 1 a 5 (e comentário opcional) depois de momentos bons: dia perfeito,
--     subir de nível ou derrotar o chefe. As regras ficam no app; os números, aqui em app_settings,
--     para a equipe ajustar sem publicar versão:
--       feedback_prompt_min_days        dias desde o primeiro registro (padrão 5)
--       feedback_prompt_min_missions    missões registradas no total (padrão 15)
--       feedback_prompt_cooldown_days   intervalo mínimo entre pedidos (padrão 30)
--       feedback_prompt_max_dismissals  "Agora não" até parar de perguntar (padrão 3)
--   · A nota vai para public.feedback (source = 'prompt', rating 1..5), que a equipe já lê.
--     Só a função submit_feedback_rating grava notas; o formulário continua inserindo direto.
--   · Feature flag: app_settings.feature_feedback_prompt (começa desligada). Desligada, o app não
--     mostra o pop-up e submit_feedback_rating recusa com PR050. Para ligar:
--       update public.app_settings set value = 1 where key = 'feature_feedback_prompt';

insert into public.app_settings (key, value) values
  ('feature_feedback_prompt', 0),
  ('feedback_prompt_min_days', 5),
  ('feedback_prompt_min_missions', 15),
  ('feedback_prompt_cooldown_days', 30),
  ('feedback_prompt_max_dismissals', 3);

alter table public.feedback
  add column rating smallint check (rating between 1 and 5),
  add column source text not null default 'form' check (source in ('form', 'prompt'));

-- Mensagem: obrigatória no formulário; opcional (até 1000) na nota do pop-up.
alter table public.feedback alter column message drop not null;
alter table public.feedback drop constraint feedback_message_check;
alter table public.feedback add constraint feedback_message_check check (
  (source = 'form' and message is not null and char_length(btrim(message)) between 3 and 2000)
  or (source = 'prompt' and rating is not null and (message is null or char_length(message) <= 1000))
);

-- O app só insere direto pelo formulário; notas do pop-up passam por submit_feedback_rating.
drop policy "feedback: criar o próprio" on public.feedback;
create policy "feedback: criar o próprio" on public.feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()) and source = 'form' and rating is null);

create or replace function public.submit_feedback_rating(
  p_rating integer,
  p_message text default null,
  p_app_version text default null,
  p_platform text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  perform public.require_feature('feature_feedback_prompt');
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Nota inválida' using errcode = '22023';
  end if;
  if v_message is not null and char_length(v_message) > 1000 then
    raise exception 'Comentário longo demais' using errcode = '22023';
  end if;
  if p_platform is not null and p_platform not in ('android', 'ios', 'web') then
    raise exception 'Plataforma inválida' using errcode = '22023';
  end if;

  insert into public.feedback (user_id, kind, message, rating, source, app_version, platform)
  values (v_user, case when p_rating >= 4 then 'elogio' else 'outro' end, v_message, p_rating,
          'prompt', left(p_app_version, 40), p_platform)
  returning id into v_id;
  return v_id;
end;
$$;

-- Uso para as regras do pop-up: primeiro registro, total de missões e se já deu nota.
create or replace function public.my_feedback_prompt_usage()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'first_log_date', (select min(local_date) from public.habit_logs where user_id = auth.uid()),
    'missions_done', (select count(*) from public.habit_logs where user_id = auth.uid()),
    'already_rated', exists (select 1 from public.feedback
                             where user_id = auth.uid() and source = 'prompt')
  )
$$;

revoke execute on function public.submit_feedback_rating(integer, text, text, text) from public, anon;
revoke execute on function public.my_feedback_prompt_usage() from public, anon;
grant execute on function public.submit_feedback_rating(integer, text, text, text) to authenticated;
grant execute on function public.my_feedback_prompt_usage() to authenticated;
