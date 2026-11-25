-- Exportação dos dados pessoais (LGPD, art. 18: acesso e portabilidade).
--   · export_my_data() junta num JSON tudo o que é do usuário: perfil, e-mail, objetivos, hábitos,
--     registros, XP, Cristais, títulos, compras, recompensas, planos do Oráculo, jornadas, diário de
--     humor, feedback e os próprios vínculos sociais. Dos amigos, só o id e a situação do vínculo
--     (os dados pessoais deles não entram).
--   · O app grava o arquivo no bucket privado `exports`, na pasta do próprio usuário, e abre um
--     link temporário para baixar.
--   · Feature flag: app_settings.feature_data_export (começa desligada). Para ligar:
--       update public.app_settings set value = 1 where key = 'feature_data_export';

insert into public.app_settings (key, value) values ('feature_data_export', 0);

create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_out jsonb;
  v_rows jsonb;
  t text;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  perform public.require_feature('feature_data_export');

  v_out := jsonb_build_object(
    'formato', 'Personal Evolution RPG: exportação de dados pessoais (LGPD), versão 1',
    'gerado_em', now(),
    'conta', jsonb_build_object(
      'id', v_user,
      'email', (select u.email from auth.users u where u.id = v_user)
    ),
    'perfil', (select to_jsonb(p) from public.profiles p where p.id = v_user)
  );

  -- Tabelas com user_id: todas as linhas do usuário, sem repetir o user_id em cada uma.
  foreach t in array array[
    'objectives', 'habits', 'habit_logs', 'habit_counts', 'xp_transactions', 'coin_transactions',
    'user_titles', 'user_unlocks', 'user_cosmetics', 'hero_history', 'flash_missions',
    'streak_shield_uses', 'custom_rewards', 'reward_redemptions', 'ai_plans', 'journeys',
    'mood_entries', 'feedback', 'group_members'
  ] loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x) - ''user_id''), ''[]''::jsonb) from public.%I x where x.user_id = $1', t)
      into v_rows using v_user;
    v_out := v_out || jsonb_build_object(t, v_rows);
  end loop;

  -- Vínculos sociais: só o id do outro e a situação (nada dos dados pessoais dele).
  v_out := v_out || jsonb_build_object(
    'friendships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'outro_usuario', case when f.requester = v_user then f.addressee else f.requester end,
        'enviado_por_mim', f.requester = v_user,
        'status', f.status,
        'criado_em', f.created_at,
        'aceito_em', f.accepted_at))
      from public.friendships f where v_user in (f.requester, f.addressee)), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'nome', g.name, 'sou_dono', g.owner = v_user,
                                          'criado_em', g.created_at))
      from public.groups g join public.group_members m on m.group_id = g.id and m.user_id = v_user), '[]'::jsonb)
  );
  return v_out;
end;
$$;

revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- Bucket privado para o arquivo (só existe no Supabase de verdade; o banco de teste não tem Storage).
do $storage$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public) values ('exports', 'exports', false)
  on conflict (id) do nothing;

  drop policy if exists "exports: ler o próprio" on storage.objects;
  drop policy if exists "exports: gravar o próprio" on storage.objects;
  drop policy if exists "exports: atualizar o próprio" on storage.objects;
  drop policy if exists "exports: apagar o próprio" on storage.objects;
  create policy "exports: ler o próprio" on storage.objects for select to authenticated
    using (bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text);
  create policy "exports: gravar o próprio" on storage.objects for insert to authenticated
    with check (bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text);
  create policy "exports: atualizar o próprio" on storage.objects for update to authenticated
    using (bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text);
  create policy "exports: apagar o próprio" on storage.objects for delete to authenticated
    using (bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text);
end
$storage$;
