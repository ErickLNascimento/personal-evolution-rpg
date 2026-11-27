/**
 * Até que nível as peças do vestiário já foram vistas (por conta, neste aparelho). As liberadas
 * depois dele ganham o selo "Novo" até a pessoa sair do vestiário.
 */
const key = (userId: string) => `per.wardrobe.seenLevel:${userId}`;

/** Sem registro, conta do nível 1: quem nunca viu o selo vê tudo o que já ganhou como novo uma vez. */
export function seenWardrobeLevel(userId: string): number {
  const n = Number(globalThis.localStorage?.getItem(key(userId)) ?? '1');
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function markWardrobeSeen(userId: string, level: number): void {
  if (level > seenWardrobeLevel(userId)) globalThis.localStorage?.setItem(key(userId), String(level));
}
