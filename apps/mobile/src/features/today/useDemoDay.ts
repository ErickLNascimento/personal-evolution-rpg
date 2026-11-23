import { useMemo, useState } from 'react';
import {
  ALL_DAYS,
  dayProgress,
  DEFAULT_XP_TABLE,
  habitLogXpKey,
  levelFromXp,
  missionsForDay,
  perfectDayXpKey,
  reversalKey,
  toLocalDate,
  xpBalance,
  xpForHabit,
  type Habit,
  type XpTransaction,
} from '@per/domain';

/**
 * Dados de demonstração quando o Supabase não está configurado (sem .env.local).
 * Repete localmente a mesma lógica das funções log_habit / undo_habit_log do banco.
 */
const DEMO_USER = 'demo';
const TIME_ZONE = 'America/Manaus';

const DEMO_HABITS: Habit[] = [
  { id: 'treino', title: 'Treinar', difficulty: 'hard', scheduleDays: [1, 2, 3, 4, 5], startDate: '2026-01-01' },
  { id: 'espanhol', title: 'Estudar espanhol 10 min', difficulty: 'medium', scheduleDays: ALL_DAYS, startDate: '2026-01-01' },
  { id: 'leitura', title: 'Ler 10 páginas', difficulty: 'easy', scheduleDays: ALL_DAYS, startDate: '2026-01-01' },
];

interface DemoLog {
  id: string;
  habitId: string;
}

export function useDemoDay() {
  const today = toLocalDate(new Date(), TIME_ZONE);
  const [logs, setLogs] = useState<DemoLog[]>([]);
  const [transactions, setTransactions] = useState<XpTransaction[]>([
    { amount: 380, idempotencyKey: 'demo:saldo-inicial' },
  ]);
  const [counter, setCounter] = useState(0);

  const completed = useMemo(() => new Set(logs.map((l) => l.habitId)), [logs]);
  const missions = missionsForDay(DEMO_HABITS, completed, today);
  const progress = dayProgress(missions);
  const level = levelFromXp(xpBalance(transactions));

  function perfectDayNet(txs: XpTransaction[]) {
    return txs
      .filter((t) => t.idempotencyKey.includes(`perfect-day:${DEMO_USER}:${today}`))
      .reduce((sum, t) => sum + t.amount, 0);
  }

  function toggle(habitId: string) {
    const habit = DEMO_HABITS.find((h) => h.id === habitId);
    if (!habit) return;
    const existing = logs.find((l) => l.habitId === habitId);

    if (existing) {
      const nextLogs = logs.filter((l) => l !== existing);
      const original = habitLogXpKey(existing.id);
      const next: XpTransaction[] = [
        ...transactions,
        { amount: -xpForHabit(habit.difficulty), idempotencyKey: reversalKey(original) },
      ];
      if (perfectDayNet(next) > 0) {
        const occurrence = next.filter((t) => t.idempotencyKey.startsWith(`perfect-day:`)).length;
        next.push({
          amount: -DEFAULT_XP_TABLE.perfectDayBonus,
          idempotencyKey: reversalKey(perfectDayXpKey(DEMO_USER, today, occurrence)),
        });
      }
      setLogs(nextLogs);
      setTransactions(next);
      return;
    }

    const logId = `log-${counter + 1}`;
    setCounter(counter + 1);
    const nextLogs = [...logs, { id: logId, habitId }];
    const next: XpTransaction[] = [
      ...transactions,
      { amount: xpForHabit(habit.difficulty), idempotencyKey: habitLogXpKey(logId) },
    ];
    const nowPerfect = dayProgress(missionsForDay(DEMO_HABITS, new Set(nextLogs.map((l) => l.habitId)), today)).perfect;
    if (nowPerfect && perfectDayNet(next) === 0) {
      const occurrence = next.filter((t) => t.idempotencyKey.startsWith('perfect-day:')).length + 1;
      next.push({
        amount: DEFAULT_XP_TABLE.perfectDayBonus,
        idempotencyKey: perfectDayXpKey(DEMO_USER, today, occurrence),
      });
    }
    setLogs(nextLogs);
    setTransactions(next);
  }

  return { today, missions, progress, level, toggle };
}
