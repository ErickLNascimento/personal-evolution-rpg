import {
  addDays,
  dayProgress,
  DEFAULT_XP_TABLE,
  levelFromXp,
  missionsForDay,
  type LocalDate,
  type XpTable,
} from '@per/domain';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useToday } from '@/features/profile/useToday';
import { awardKey, fetchDay, logHabit, undoHabitLog, type DayData } from './api';

export type DayChoice = 'today' | 'yesterday';

/**
 * Missões reais do dia escolhido (hoje ou ontem).
 * XP e registros mudam só pelas funções do banco; a tela atualiza na hora
 * e desfaz a mudança se o banco recusar.
 */
export function useDay(choice: DayChoice) {
  const { today, ready } = useToday();
  const yesterday = addDays(today, -1);
  const date: LocalDate = choice === 'today' ? today : yesterday;

  const [data, setData] = useState<DayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const pendingRef = useRef(new Set<string>());
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      let active = true;
      // `attempt` muda quando o usuário toca em "Tentar de novo" e força uma nova busca.
      void attempt;
      fetchDay([yesterday, today]).then((r) => {
        if (!active) return;
        setError(r.error);
        if (r.data) setData(r.data);
      });
      return () => {
        active = false;
      };
    }, [ready, today, yesterday, attempt]),
  );

  const xpTable: XpTable = data?.xpTable ?? DEFAULT_XP_TABLE;
  const completed = data?.logged.get(date) ?? new Set<string>();
  const missions = data ? missionsForDay(data.habits, completed, date) : [];
  const progress = dayProgress(missions);
  const level = levelFromXp(data?.totalXp ?? 0);

  function setLogged(habitId: string, on: boolean) {
    setData((d) => {
      if (!d) return d;
      const logged = new Map(d.logged);
      const set = new Set(logged.get(date) ?? []);
      if (on) set.add(habitId);
      else set.delete(habitId);
      logged.set(date, set);
      return { ...d, logged };
    });
  }

  async function toggle(habitId: string) {
    // Um toque por vez em cada missão, para não disparar registro e estorno cruzados.
    if (!data || pendingRef.current.has(habitId)) return;
    pendingRef.current.add(habitId);
    setPending(new Set(pendingRef.current));

    const wasDone = completed.has(habitId);
    setLogged(habitId, !wasDone);
    setError(null);
    setNotice(null);

    const r = wasDone ? await undoHabitLog(habitId, date) : await logHabit(habitId, date);
    if (r.error !== null) {
      setLogged(habitId, wasDone);
      setError(r.error);
    } else {
      const outcome = r.data;
      setData((d) => {
        if (!d) return d;
        // Guarda o XP ganho neste registro (ou o tira, ao desfazer) para o card mostrar o valor real.
        const awarded = new Map(d.awarded);
        const key = awardKey(date, habitId);
        if (wasDone) awarded.delete(key);
        else if (outcome.changed) awarded.set(key, outcome.xp);
        return { ...d, totalXp: outcome.totalXp, awarded };
      });
      if (r.data.perfectDayBonus > 0) setNotice(`Dia perfeito! +${r.data.perfectDayBonus} XP de bônus.`);
    }

    pendingRef.current.delete(habitId);
    setPending(new Set(pendingRef.current));
  }

  return {
    date,
    loading: !data && !error,
    /** Falhou antes de carregar qualquer coisa: a tela mostra só o erro e "Tentar de novo". */
    failed: !data && Boolean(error),
    retry: () => {
      setError(null);
      setAttempt((n) => n + 1);
    },
    hasHabits: (data?.habits.length ?? 0) > 0,
    missions,
    progress,
    level,
    xpTable,
    /** XP ganho no registro desta missão na data escolhida, se houver. */
    awardedXp: (habitId: string) => data?.awarded.get(awardKey(date, habitId)),
    pending,
    error,
    notice,
    toggle,
  };
}
