/**
 * Notificações inteligentes (locais, agendadas no aparelho a cada sincronização):
 * - streak em risco às 20h30 nos dias com missão (hoje só se o dia ainda não está perfeito);
 * - missão relâmpago: aviso 1 hora antes do prazo, se ainda não foi concluída;
 * - promoção disponível: lembrete na manhã seguinte.
 */
import { addDays, type LocalDate } from './dates';
import { DEFAULT_LOCALE, type Locale } from './i18n';
import { dayProgress, missionsForDay, type Habit } from './schedule';

/** Vagas reservadas para estes avisos, dentro do limite de 64 do iOS (7 + 1 + 1 + 1 + 1). */
export const SMART_NOTIFICATION_SLOTS = 11;
export const STREAK_RISK_TIME = { hour: 20, minute: 30 } as const;
export const PROMOTION_TIME = { hour: 9, minute: 0 } as const;
export const FLASH_WARNING_MINUTES = 60;
const STREAK_DAYS_AHEAD = 7;

export type SmartNotification =
  | {
      id: string;
      kind: 'streak' | 'promotion' | 'return' | 'ambush';
      title: string;
      body: string;
      /** Dia e hora locais do aparelho. */
      date: LocalDate;
      hour: number;
      minute: number;
    }
  | { id: string; kind: 'flash'; title: string; body: string; at: Date };

export interface SmartNotificationInput {
  today: LocalDate;
  /** Minutos desde a meia-noite de hoje (hora local). */
  nowMinutes: number;
  now: Date;
  habits: readonly Habit[];
  /** Hábitos já registrados hoje. */
  completedToday: ReadonlySet<string>;
  flash: { title: string; deadline: Date; done: boolean } | null;
  /** Promoção liberada e ainda não aceita (nome do próximo estágio, se já definido). */
  promotion: { nextName: string | null } | null;
  /** Primeiro dia depois das férias marcadas (aviso de volta às 9h), se houver. */
  vacationReturn?: LocalDate | null;
  /** Emboscada da semana: aviso às 9h do dia em que começa (nome e desafio já no idioma). */
  ambush?: { date: LocalDate; name: string; goal: string } | null;
  /** Idioma dos textos (padrão português). */
  locale?: Locale;
}

export function smartNotifications(input: SmartNotificationInput): SmartNotification[] {
  const out: SmartNotification[] = [];
  const en = (input.locale ?? DEFAULT_LOCALE) === 'en';
  const riskMinutes = STREAK_RISK_TIME.hour * 60 + STREAK_RISK_TIME.minute;

  for (let i = 0; i < STREAK_DAYS_AHEAD; i++) {
    const date = addDays(input.today, i);
    const done = i === 0 ? input.completedToday : new Set<string>();
    const progress = dayProgress(missionsForDay(input.habits, done, date));
    if (progress.total === 0) continue;
    if (i === 0 && (progress.perfect || input.nowMinutes >= riskMinutes)) continue;
    const left = progress.total - progress.done;
    out.push({
      id: `streak:${date}`,
      kind: 'streak',
      title: en ? '🔥 Your streak is at risk' : '🔥 Seu streak está em risco',
      body: en
        ? i === 0
          ? `${left === 1 ? '1 mission' : `${left} missions`} left today. Finish to keep your streak.`
          : 'There are still missions for today. Don’t let your streak slip away.'
        : i === 0
          ? `${left === 1 ? 'Falta 1 missão' : `Faltam ${left} missões`} hoje. Conclua para manter a sequência.`
          : 'Ainda há missões para hoje. Não deixe o streak escapar.',
      date,
      ...STREAK_RISK_TIME,
    });
  }

  if (input.flash && !input.flash.done) {
    const at = new Date(input.flash.deadline.getTime() - FLASH_WARNING_MINUTES * 60_000);
    if (at.getTime() > input.now.getTime() + 60_000) {
      out.push({
        id: 'flash',
        kind: 'flash',
        title: en ? '⚡ Flash mission' : '⚡ Missão relâmpago',
        body: en
          ? `1 hour left for "${input.flash.title}". Finish in time for +50% XP.`
          : `Falta 1 hora para "${input.flash.title}". Conclua a tempo e ganhe +50% de XP.`,
        at,
      });
    }
  }

  if (input.promotion) {
    out.push({
      id: 'promotion',
      kind: 'promotion',
      title: en ? '⭐ Promotion available' : '⭐ Promoção disponível',
      body: en
        ? input.promotion.nextName
          ? `Your hero can become ${input.promotion.nextName}. Tap to accept.`
          : 'Your hero is ready for the next stage. Tap to choose a branch.'
        : input.promotion.nextName
          ? `Seu herói pode virar ${input.promotion.nextName}. Toque para aceitar.`
          : 'Seu herói está pronto para o próximo estágio. Toque para escolher o ramo.',
      date: addDays(input.today, 1),
      ...PROMOTION_TIME,
    });
  }
  const nineAm = PROMOTION_TIME.hour * 60 + PROMOTION_TIME.minute;
  if (
    input.ambush &&
    (input.ambush.date > input.today || (input.ambush.date === input.today && input.nowMinutes < nineAm))
  ) {
    out.push({
      id: `ambush:${input.ambush.date}`,
      kind: 'ambush',
      title: en ? '⚔️ An ambush!' : '⚔️ Uma emboscada!',
      body: en
        ? `${input.ambush.name} showed up. 2-day challenge: ${input.ambush.goal}.`
        : `${input.ambush.name} apareceu. Desafio de 2 dias: ${input.ambush.goal}.`,
      date: input.ambush.date,
      ...PROMOTION_TIME,
    });
  }

  if (input.vacationReturn) {
    out.push({
      id: `return:${input.vacationReturn}`,
      kind: 'return',
      title: en ? '🏕 Welcome back' : '🏕 Bem-vindo de volta',
      body: en
        ? 'Your vacation is over and your missions are back today.'
        : 'As férias acabaram e suas missões voltam hoje.',
      date: input.vacationReturn,
      ...PROMOTION_TIME,
    });
  }
  return out;
}
