/**
 * Social: amigos e grupos (espelha 20261126000100_social.sql).
 *
 * Privacidade: amigos e colegas de grupo veem só o resumo (herói, nível, streak e quantas
 * missões do dia foram feitas). Os nomes dos hábitos nunca saem da conta.
 * Adicionar: pelo código de amigo (ex.: K7Q-2PM) ou pela busca por nome; a amizade só vale
 * depois que o outro aceita. Quem não quer ser encontrado desliga a busca no Perfil.
 */
import { addDays, type LocalDate } from './dates';
import { ACT_II_BOSSES, BOSSES, bossForWeek, type Boss } from './challenges';
import { DEFAULT_LOCALE, type Locale } from './i18n';

/** Sem 0/O e 1/I, para não confundir ao ditar ou digitar. */
export const SOCIAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const SOCIAL_CODE_LENGTH = 6;
export const MAX_FRIENDS = 100;
export const MAX_GROUPS = 5;
export const MAX_GROUP_MEMBERS = 6;
export const GROUP_NAME_MAX = 40;
export const SEARCH_MIN_CHARS = 2;
/** Cristais para cada membro quando o grupo derrota o chefe (padrão; o banco usa coin_rules). */
export const GROUP_BOSS_REWARD = 30;

/** Normaliza o que o usuário digitou ("k7q 2pm", "K7Q-2PM") para "K7Q2PM", ou `null` se inválido. */
export function normalizeSocialCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== SOCIAL_CODE_LENGTH) return null;
  for (const ch of code) if (!SOCIAL_CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** "K7Q2PM" → "K7Q-2PM". */
export function formatSocialCode(code: string): string {
  return code.length === SOCIAL_CODE_LENGTH ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

export function validateGroupName(
  name: string,
  locale: Locale = DEFAULT_LOCALE,
): { value: string; error: string | null } {
  const en = locale === 'en';
  const value = name.trim().replace(/\s+/g, ' ');
  if (!value) return { value, error: en ? 'Give the group a name.' : 'Dê um nome ao grupo.' };
  if (value.length > GROUP_NAME_MAX)
    return {
      value,
      error: en
        ? `Use at most ${GROUP_NAME_MAX} characters.`
        : `Use no máximo ${GROUP_NAME_MAX} caracteres.`,
    };
  return { value, error: null };
}

/** Texto de busca limpo, ou `null` se curto demais. */
export function searchQuery(input: string): string | null {
  const q = input.trim().replace(/\s+/g, ' ');
  return q.length >= SEARCH_MIN_CHARS ? q : null;
}

/** Nome mostrado para quem não definiu um. */
export function socialName(
  displayName: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return displayName?.trim() || (locale === 'en' ? 'Nameless adventurer' : 'Aventureiro sem nome');
}

/** Chefe do grupo: outro da lista, para não repetir o chefe individual da mesma semana. */
export function groupBossForWeek(weekStart: LocalDate): Boss {
  // Três posições adiante no ato do chefe solo: bando e solo nunca enfrentam o mesmo chefe.
  const solo = bossForWeek(weekStart);
  const act = BOSSES.some((b) => b.id === solo.id) ? BOSSES : ACT_II_BOSSES;
  const i = act.findIndex((b) => b.id === solo.id);
  return act[(i + 3) % act.length]!;
}

export interface GroupBossState {
  boss: Boss;
  weekStart: LocalDate;
  weekEnd: LocalDate;
  maxHp: number;
  damage: number;
  hp: number;
  defeated: boolean;
}

/** Monta o estado do chefe do grupo com os números que o banco calculou. */
export function groupBossState(weekStart: LocalDate, maxHp: number, damage: number): GroupBossState {
  return {
    boss: groupBossForWeek(weekStart),
    weekStart,
    weekEnd: addDays(weekStart, 6),
    maxHp,
    damage,
    hp: Math.max(0, maxHp - damage),
    defeated: maxHp > 0 && damage >= maxHp,
  };
}
