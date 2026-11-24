/**
 * Tour do app: aparece quando a última versão que o usuário viu é menor que a versão atual,
 * definida pela equipe em `app_settings` (key = 'tour_version'). Aumentar a versão reexibe
 * o tour para todos, inclusive para quem já tem conta.
 */
export function shouldShowTour(seenVersion: number, currentVersion: number | null): boolean {
  if (currentVersion === null || !Number.isFinite(currentVersion)) return false;
  return seenVersion < currentVersion;
}
