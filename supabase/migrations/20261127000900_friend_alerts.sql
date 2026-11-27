-- Aviso de convite de amizade (espelha packages/domain/src/friendAlerts.ts): quem recebeu um
-- pedido vê um ponto na aba Fogueira e um cartão na tela Hoje com Aceitar e Recusar, sem precisar
-- abrir a aba. Só leitura: aceitar e recusar continuam em respond_friend_request.
--   · Feature flag: app_settings.feature_friend_alerts (começa desligada). Desligada, o app não
--     mostra o aviso e incoming_friend_requests devolve lista vazia. Para ligar:
--       update public.app_settings set value = 1 where key = 'feature_friend_alerts';

insert into public.app_settings (key, value) values ('feature_friend_alerts', 0);

-- Pedidos recebidos e pendentes, do mais novo para o mais antigo (só o cartão curto de quem pediu).
-- Mais leve que my_friends: não calcula o resumo dos amigos.
create or replace function public.incoming_friend_requests()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if not public.feature_on('feature_friend_alerts') or not public.feature_on('feature_social', 1) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'request_id', f.id,
             'created_at', f.created_at,
             'user', public.social_card(f.requester))
           order by f.created_at desc)
    from public.friendships f
    where f.status = 'pending' and f.addressee = v_me), '[]'::jsonb);
end;
$$;

revoke execute on function public.incoming_friend_requests() from public, anon;
grant execute on function public.incoming_friend_requests() to authenticated;
