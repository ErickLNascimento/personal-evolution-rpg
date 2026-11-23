-- Sprint 1: o cadastro grava o fuso do aparelho (enviado em raw_user_meta_data.timezone).
-- Fuso ausente ou inválido cai no padrão da coluna, para o cadastro nunca falhar por isso.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text := nullif(new.raw_user_meta_data ->> 'timezone', '');
begin
  if v_tz is not null
     and not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    v_tz := null;
  end if;

  insert into public.profiles (id, display_name, timezone)
  values (
    new.id,
    left(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 60),
    coalesce(v_tz, 'America/Sao_Paulo')
  );
  return new;
end;
$$;
