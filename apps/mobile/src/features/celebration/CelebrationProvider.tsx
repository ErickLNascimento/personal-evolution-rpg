import { DEFAULT_HERO, sanitizeHero } from '@per/domain';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { LevelUpOverlay } from '@/components/celebration/LevelUpOverlay';
import { useProfile } from '@/features/profile/ProfileProvider';

interface CelebrationState {
  /** Mostra a cena de subida de nível (de `from` para `to`). */
  celebrateLevelUp: (from: number, to: number) => void;
}

const CelebrationContext = createContext<CelebrationState>({ celebrateLevelUp: () => undefined });

/** Dona da cena de subida de nível, que fica por cima de qualquer tela. */
export function CelebrationProvider({ children }: { children: ReactNode }) {
  const { profile } = useProfile();
  const [levelUp, setLevelUp] = useState<{ from: number; to: number } | null>(null);

  const celebrateLevelUp = useCallback((from: number, to: number) => {
    if (to > from) setLevelUp({ from, to });
  }, []);

  const hero = levelUp && profile ? sanitizeHero(profile.hero, levelUp.to, profile.owned) : DEFAULT_HERO;

  return (
    <CelebrationContext.Provider value={{ celebrateLevelUp }}>
      {children}
      {levelUp && (
        <LevelUpOverlay
          visible
          fromLevel={levelUp.from}
          toLevel={levelUp.to}
          hero={hero}
          onClose={() => setLevelUp(null)}
        />
      )}
    </CelebrationContext.Provider>
  );
}

export function useCelebration() {
  return useContext(CelebrationContext);
}
