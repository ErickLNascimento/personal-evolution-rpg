/**
 * Avisos de atualização do app (EAS Update). O app procura e baixa a versão nova sozinho ao
 * abrir; ela é aplicada na próxima abertura. Aqui fica o que mostrar e quando conferir de novo.
 */

export interface UpdateStatus {
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
  isDownloading: boolean;
  /** 0..1, só enquanto baixa. */
  downloadProgress?: number;
  /** Id da versão encontrada/baixada, para lembrar se o aviso foi fechado. */
  updateId?: string | null;
}

export type UpdateBanner =
  | { kind: 'downloading'; title: string; text: string }
  | { kind: 'ready'; title: string; text: string };

/** Ao voltar para o app, confere de novo no máximo a cada tantos minutos. */
export const UPDATE_RECHECK_MINUTES = 30;

export function updateBanner(
  status: UpdateStatus,
  dismissedId: string | null,
): UpdateBanner | null {
  if (status.updateId && status.updateId === dismissedId) return null;
  if (status.isUpdatePending)
    return {
      kind: 'ready',
      title: 'Nova versão pronta!',
      text: 'Ela será aplicada na próxima vez que você abrir o app.',
    };
  if (status.isUpdateAvailable || status.isDownloading) {
    const pct = status.downloadProgress;
    return {
      kind: 'downloading',
      title: 'Nova versão disponível',
      text:
        pct !== undefined && pct > 0 && pct < 1
          ? `Baixando em segundo plano… ${Math.round(pct * 100)}%`
          : 'Baixando em segundo plano. Pode continuar usando o app.',
    };
  }
  return null;
}

/** Já passou tempo bastante desde a última conferência? */
export function shouldRecheckUpdate(
  lastCheck: Date | null,
  now: Date,
  minutes = UPDATE_RECHECK_MINUTES,
): boolean {
  return lastCheck === null || now.getTime() - lastCheck.getTime() >= minutes * 60_000;
}
