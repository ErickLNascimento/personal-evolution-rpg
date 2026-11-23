import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import type { Result } from '@/features/habits/api';

/**
 * Carrega dados sempre que a tela ganha foco, com "puxar para atualizar" e "Tentar de novo".
 * `load` deve ser estável (useCallback): quando muda, a tela recarrega.
 * Uma falha depois do primeiro carregamento mantém os dados anteriores e mostra o erro.
 */
export function useFocusLoad<T>(load: () => Promise<Result<T>>, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      let active = true;
      // `attempt` muda em refresh() e força uma nova busca.
      void attempt;
      load().then((r) => {
        if (!active) return;
        setError(r.error);
        if (r.error === null) setData(r.data);
        setRefreshing(false);
      });
      return () => {
        active = false;
        setRefreshing(false);
      };
    }, [load, enabled, attempt]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  return {
    data,
    setData,
    error,
    setError,
    refreshing,
    refresh,
    /** Primeira carga em andamento. */
    loading: data === null && error === null,
    /** A primeira carga falhou: mostrar só o erro e "Tentar de novo". */
    failed: data === null && error !== null,
  };
}
