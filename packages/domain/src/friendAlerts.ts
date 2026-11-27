/**
 * Aviso de convite de amizade (espelha 20261127000900_friend_alerts.sql): pedidos recebidos
 * mostram um contador na aba Fogueira e um cartão na tela Hoje com Aceitar e Recusar.
 * "Depois" tira o convite da tela Hoje, mas o contador continua até a pessoa responder.
 */

/** Acima disso, o contador mostra "9+". */
export const FRIEND_ALERT_BADGE_MAX = 9;

/** Texto do contador da aba, ou `undefined` sem convites. */
export function friendAlertBadge(count: number): string | undefined {
  if (!Number.isFinite(count) || count <= 0) return undefined;
  return count > FRIEND_ALERT_BADGE_MAX ? `${FRIEND_ALERT_BADGE_MAX}+` : String(Math.floor(count));
}

/**
 * Convite para o cartão da tela Hoje: o mais novo que a pessoa não adiou.
 * `requests` vem do mais novo para o mais antigo.
 */
export function todayInvite<T extends { requestId: string }>(
  requests: readonly T[],
  postponed: ReadonlySet<string>,
): { request: T; others: number } | null {
  const visible = requests.filter((r) => !postponed.has(r.requestId));
  const first = visible[0];
  return first ? { request: first, others: visible.length - 1 } : null;
}
