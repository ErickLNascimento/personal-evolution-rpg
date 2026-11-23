import {
  addDays,
  dayProgress,
  DEFAULT_XP_TABLE,
  levelFromXp,
  missionsForDay,
  type LocalDate,
  type XpTable,
} from '@per/domain';
import { useCallback, useRef, useState } from 'react';
import { useCelebration } from '@/features/celebration/CelebrationProvider';
import { useToday } from '@/features/profile/useToday';
import { useFocusLoad } from '@/lib/useFocusLoad';
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

  const load = useCallback(() => fetchDay([yesterday, today]), [yesterday, today]);
  const { data, setData, error, setError, loading, failed, refreshing, refresh } = useFocusLoad<DayData>(load, ready);
  const { celebrateLevelUp, celebrateTitles } = useCelebration();
  const [notice, setNotice] = useState<string | null>(null);
  // Aviso rápido "+N Cristais"; `key` muda a cada ganho para reanimar.
  const [crystalGain, setCrystalGain] = useState<{ amount: number; key: number } | null>(null);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const pendingRef = useRef(new Set<string>());

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
      // O XP total vem do banco: se cruzou um nível, dispara a cena de evolução.
      const before = levelFromXp(data.totalXp).level;
      const after = levelFromXp(outcome.totalXp).level;
      if (after > before) celebrateLevelUp(before, after);
      if (outcome.titles.length > 0) celebrateTitles(outcome.titles);
      setData((d) => {
        if (!d) return d;
        // Guarda o XP ganho neste registro (ou o tira, ao desfazer) para o card mostrar o valor real.
        const awarded = new Map(d.awarded);
        const key = awardKey(date, habitId);
        if (wasDone) awarded.delete(key);
        else if (outcome.changed) awarded.set(key, outcome.xp);
        return { ...d, totalXp: outcome.totalXp, crystals: outcome.crystalBalance, awarded };
      });
      if (!wasDone && outcome.crystals > 0) setCrystalGain({ amount: outcome.crystals, key: Date.now() });
      if (r.data.perfectDayBonus > 0) setNotice(`Todas as missões feitas: +${r.data.perfectDayBonus} XP de bônus.`);
    }

    pendingRef.current.delete(habitId);
    setPending(new Set(pendingRef.current));
  }

  return {
    date,
    loading,
    /** Falhou antes de carregar qualquer coisa: a tela mostra só o erro e "Tentar de novo". */
    failed,
    refreshing,
    refresh,
    hasHabits: (data?.habits.length ?? 0) > 0,
    missions,
    progress,
    level,
    xpTable,
    crystals: data?.crystals ?? 0,
    crystalGain,
    /** XP ganho no registro desta missão na data escolhida, se houver. */
    awardedXp: (habitId: string) => data?.awarded.get(awardKey(date, habitId)),
    pending,
    error,
    notice,
    toggle,
  };
}
