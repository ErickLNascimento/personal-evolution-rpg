import {
  addDays,
  countShown,
  dayProgress,
  DEFAULT_XP_TABLE,
  levelFromXp,
  LOGGABLE_DAYS_BACK,
  missionsForDay,
  recentDays,
  type LocalDate,
  type XpTable,
} from '@per/domain';
import { useCallback, useRef, useState } from 'react';
import { useCelebration } from '@/features/celebration/CelebrationProvider';
import { useToday } from '@/features/profile/useToday';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { fetchFlashMission, type FlashMission } from '@/features/hero/pathApi';
import { syncReminders } from '@/lib/reminders';
import {
  awardKey,
  fetchDay,
  logHabit,
  setHabitCount,
  undoHabitLog,
  type DayData,
  type LogOutcome,
} from './api';

export type DayChoice = 'today' | 'yesterday';

/** Ontem e hoje: os únicos dias que ainda aceitam registro. */
const LOGGABLE_DAYS = LOGGABLE_DAYS_BACK + 1;

/**
 * Missões reais do dia escolhido (hoje ou ontem).
 * XP e registros mudam só pelas funções do banco; a tela atualiza na hora
 * e desfaz a mudança se o banco recusar.
 */
export function useDay(choice: DayChoice) {
  const { today, ready } = useToday();
  const yesterday = addDays(today, -1);
  const date: LocalDate = choice === 'today' ? today : yesterday;

  const load = useCallback(
    () => fetchDay(Array.from({ length: LOGGABLE_DAYS }, (_, i) => addDays(today, -i))),
    [today],
  );
  const { data, setData, error, setError, loading, failed, refreshing, refresh } =
    useFocusLoad<DayData>(load, ready);
  // Missão relâmpago de hoje (o banco sorteia na primeira consulta do dia). Falhar aqui não trava a tela.
  const flashLoad = useCallback(() => fetchFlashMission(), []);
  const flash = useFocusLoad<FlashMission | null>(flashLoad, ready);
  const { celebrateLevelUp, celebrateTitles } = useCelebration();
  const [notice, setNotice] = useState<string | null>(null);
  // Aviso rápido "+N Cristais"; `key` muda a cada ganho para reanimar.
  const [crystalGain, setCrystalGain] = useState<{ amount: number; key: number } | null>(null);
  const [cheer, setCheer] = useState(0);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const pendingRef = useRef(new Set<string>());

  const xpTable: XpTable = data?.xpTable ?? DEFAULT_XP_TABLE;
  const completed = data?.logged.get(date) ?? new Set<string>();
  const missions = data ? missionsForDay(data.habits, completed, date) : [];
  const progress = dayProgress(missions);
  const level = levelFromXp(data?.totalXp ?? 0);
  const days = data ? recentDays(data.habits, data.logged, today, LOGGABLE_DAYS) : [];

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
    // O herói comemora no toque, sem esperar o banco (se o banco recusar, a missão volta).
    if (!wasDone) setCheer((n) => n + 1);
    setError(null);
    setNotice(null);

    const r = wasDone ? await undoHabitLog(habitId, date) : await logHabit(habitId, date);
    if (r.error !== null) {
      setLogged(habitId, wasDone);
      setError(r.error);
    } else applyOutcome(habitId, wasDone, r.data);

    pendingRef.current.delete(habitId);
    setPending(new Set(pendingRef.current));
  }

  /** Contagem do dia que o contador mostra. */
  function countOf(habitId: string): number {
    const habit = data?.habits.find((h) => h.id === habitId);
    return countShown(
      data?.counts.get(awardKey(date, habitId)),
      habit?.targetQty ?? 1,
      completed.has(habitId),
    );
  }

  function setCountLocal(habitId: string, qty: number) {
    setData((d) => {
      if (!d) return d;
      const counts = new Map(d.counts);
      counts.set(awardKey(date, habitId), qty);
      return { ...d, counts };
    });
  }

  /** Soma `delta` ao contador; ao cruzar a meta, o banco conclui ou desfaz a missão. */
  async function changeCount(habitId: string, delta: number) {
    const habit = data?.habits.find((h) => h.id === habitId);
    if (!data || !habit || habit.targetQty === null || pendingRef.current.has(habitId)) return;
    const before = countOf(habitId);
    const next = Math.max(0, Math.min(9999, before + delta));
    if (next === before) return;
    pendingRef.current.add(habitId);
    setPending(new Set(pendingRef.current));

    const wasDone = completed.has(habitId);
    const nowDone = next >= habit.targetQty;
    setCountLocal(habitId, next);
    if (nowDone !== wasDone) setLogged(habitId, nowDone);
    if (nowDone && !wasDone) setCheer((n) => n + 1);
    setError(null);
    setNotice(null);

    const r = await setHabitCount(habitId, date, next);
    if (r.error !== null) {
      setCountLocal(habitId, before);
      setLogged(habitId, wasDone);
      setError(r.error);
    } else if (r.data.change) {
      applyOutcome(habitId, r.data.change.kind === 'undone', r.data.change.outcome);
    }

    pendingRef.current.delete(habitId);
    setPending(new Set(pendingRef.current));
  }

  /** Atualiza XP, Cristais, títulos e avisos depois que o banco registrou ou desfez a missão. */
  function applyOutcome(habitId: string, wasDone: boolean, outcome: LogOutcome) {
    if (!data) return;
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
    // Refaz os avisos: o de streak em risco sai com o dia perfeito; o relâmpago, ao concluir.
    void syncReminders().catch(() => undefined);
    // A resposta do banco diz se o bônus relâmpago entrou (ou saiu, ao desfazer).
    if (flash.data && flash.data.habitId === habitId && date === today) {
      flash.setData({
        ...flash.data,
        done: !wasDone,
        awarded: !wasDone && outcome.flashBonus > 0,
      });
    }
    if (!wasDone && outcome.crystals > 0)
      setCrystalGain({ amount: outcome.crystals, key: Date.now() });
    if (outcome.perfectDayBonus > 0)
      setNotice(`Todas as missões feitas: +${outcome.perfectDayBonus} XP de bônus.`);
  }

  return {
    date,
    loading,
    /** Falhou antes de carregar qualquer coisa: a tela mostra só o erro e "Tentar de novo". */
    failed,
    refreshing,
    refresh: () => {
      refresh();
      flash.refresh();
    },
    hasHabits: (data?.habits.length ?? 0) > 0,
    missions,
    progress,
    /** Ontem e hoje, com o progresso de cada um (para o seletor de dia). */
    days,
    level,
    xpTable,
    crystals: data?.crystals ?? 0,
    crystalGain,
    /** Sobe a cada missão concluída (o herói comemora). */
    cheer,
    /** XP ganho no registro desta missão na data escolhida, se houver. */
    awardedXp: (habitId: string) => data?.awarded.get(awardKey(date, habitId)),
    pending,
    error,
    notice,
    toggle,
    /** Contagem do dia de um hábito contador. */
    countOf,
    changeCount,
    /** Prazo e bônus, se a missão é a relâmpago de hoje (só na aba Hoje). */
    flashFor: (habitId: string) =>
      choice === 'today' && flash.data?.habitId === habitId
        ? { deadline: flash.data.deadline, awarded: flash.data.awarded }
        : null,
  };
}
