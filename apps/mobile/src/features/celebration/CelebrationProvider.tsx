import { DEFAULT_HERO, isTitleId, sanitizeHero, type TitleId } from '@per/domain';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { LevelUpOverlay } from '@/components/celebration/LevelUpOverlay';
import { TitleUnlockedOverlay } from '@/components/celebration/TitleUnlockedOverlay';
import { useProfile } from '@/features/profile/ProfileProvider';

type Celebration = { kind: 'level'; from: number; to: number } | { kind: 'title'; id: TitleId };

interface CelebrationState {
  /** Mostra a cena de subida de nível (de `from` para `to`). */
  celebrateLevelUp: (from: number, to: number) => void;
  /** Mostra a cena de título desbloqueado, uma por título. */
  celebrateTitles: (ids: readonly string[]) => void;
}

const CelebrationContext = createContext<CelebrationState>({
  celebrateLevelUp: () => undefined,
  celebrateTitles: () => undefined,
});

/**
 * Dona das cenas de recompensa, que ficam por cima de qualquer tela.
 * Usa uma fila: subir de nível e ganhar um título na mesma missão mostra as duas, em ordem.
 */
export function CelebrationProvider({ children }: { children: ReactNode }) {
  const { profile, update, refresh } = useProfile();
  const [queue, setQueue] = useState<Celebration[]>([]);

  const celebrateLevelUp = useCallback((from: number, to: number) => {
    if (to > from) setQueue((q) => [...q, { kind: 'level', from, to }]);
  }, []);

  const celebrateTitles = useCallback(
    (ids: readonly string[]) => {
      const titles = ids.filter(isTitleId).map((id) => ({ kind: 'title' as const, id }));
      if (titles.length === 0) return;
      setQueue((q) => [...q, ...titles]);
      // Atualiza a lista de títulos conquistados (para escolher e exibir).
      void refresh();
    },
    [refresh],
  );

  const current = queue[0];
  const next = () => setQueue((q) => q.slice(1));
  const level = current?.kind === 'level' ? current.to : 1;
  const hero = profile ? sanitizeHero(profile.hero, level, profile.owned) : DEFAULT_HERO;

  return (
    <CelebrationContext.Provider value={{ celebrateLevelUp, celebrateTitles }}>
      {children}
      {current?.kind === 'level' && (
        <LevelUpOverlay visible fromLevel={current.from} toLevel={current.to} hero={hero} onClose={next} />
      )}
      {current?.kind === 'title' && (
        <TitleUnlockedOverlay
          key={current.id}
          titleId={current.id}
          form={hero.form}
          onClose={next}
          onEquip={() => {
            void update({ equipped_title: current.id });
            next();
          }}
        />
      )}
    </CelebrationContext.Provider>
  );
}

export function useCelebration() {
  return useContext(CelebrationContext);
}
