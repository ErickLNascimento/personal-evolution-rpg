-- Crônica da semana (espelha packages/domain/src/recap.ts): no topo da aba Progresso, de segunda
-- a quarta, com o balanço da semana anterior (ponto dourado na aba até ser vista). Só leitura: calculado no app a partir dos registros e
-- do XP, sem função nova nem tabela.
--   · Feature flag: app_settings.feature_weekly_recap (começa desligada). Desligada, a crônica e o
--     ponto não aparecem. Para ligar:
--       update public.app_settings set value = 1 where key = 'feature_weekly_recap';

insert into public.app_settings (key, value) values ('feature_weekly_recap', 0);
