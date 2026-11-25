-- App em inglês: feature flag do seletor de idioma (o app lê o idioma do celular).
-- Desligada, o app fica todo em português. Para ligar:
--   update public.app_settings set value = 1 where key = 'feature_english';
insert into public.app_settings (key, value) values ('feature_english', 0);
