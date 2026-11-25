import {
  afterFeedbackPrompt,
  DEFAULT_HERO,
  FEATURES,
  feedbackPromptConfig,
  heroLook,
  isTitleId,
  shouldPromptFeedback,
  toLocalDate,
  type FeedbackMoment,
  type TitleId,
} from '@per/domain';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { FeedbackPromptModal } from '@/components/feedback/FeedbackPromptModal';
import {
  fetchFeedbackUsage,
  loadFeedbackMemory,
  saveFeedbackMemory,
} from '@/features/feedback/prompt';
import { LevelUpOverlay } from '@/components/celebration/LevelUpOverlay';
import { TitleUnlockedOverlay } from '@/components/celebration/TitleUnlockedOverlay';
import { useProfile } from '@/features/profile/ProfileProvider';

type Celebration =
  | { kind: 'level'; from: number; to: number }
  | { kind: 'title'; id: TitleId }
  | { kind: 'feedback' };

interface CelebrationState {
  /** Mostra a cena de subida de nível (de `from` para `to`). */
  celebrateLevelUp: (from: number, to: number) => void;
  /** Mostra a cena de título desbloqueado, uma por título. */
  celebrateTitles: (ids: readonly string[]) => void;
  /**
   * Um momento bom aconteceu (dia perfeito, nível, chefe): se as regras deixarem, o pedido de
   * feedback entra no fim da fila, depois das cenas de recompensa.
   */
  askFeedback: (moment: FeedbackMoment) => void;
}

const CelebrationContext = createContext<CelebrationState>({
  celebrateLevelUp: () => undefined,
  celebrateTitles: () => undefined,
  askFeedback: () => undefined,
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

  // Um pedido por vez: evita dois momentos seguidos (nível + dia perfeito) enfileirarem dois.
  const asking = useRef(false);
  const askFeedback = useCallback(
    (_moment: FeedbackMoment) => {
      if (!profile || !profile.features.has(FEATURES.feedbackPrompt) || asking.current) return;
      const today = toLocalDate(new Date(), profile.timezone);
      const memory = loadFeedbackMemory(profile.id);
      const config = feedbackPromptConfig(profile.settings);
      asking.current = true;
      void fetchFeedbackUsage().then((usage) => {
        if (usage && shouldPromptFeedback(memory, usage, config, today)) {
          // Marca já como mostrado: se o app fechar com o pop-up aberto, conta o intervalo.
          saveFeedbackMemory(profile.id, { ...memory, lastShown: today });
          setQueue((q) => [...q, { kind: 'feedback' }]);
        } else {
          asking.current = false;
        }
      });
    },
    [profile],
  );

  const current = queue[0];
  const next = () => setQueue((q) => q.slice(1));
  const level = current?.kind === 'level' ? current.to : 1;
  const hero = profile ? heroLook(profile.hero, level, profile.heroPath, profile.race, profile.cosmetics) : DEFAULT_HERO;

  return (
    <CelebrationContext.Provider value={{ celebrateLevelUp, celebrateTitles, askFeedback }}>
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
      {current?.kind === 'feedback' && profile && (
        <FeedbackPromptModal
          onAnswer={(answer) => {
            const today = toLocalDate(new Date(), profile.timezone);
            saveFeedbackMemory(
              profile.id,
              afterFeedbackPrompt(loadFeedbackMemory(profile.id), answer, today),
            );
            asking.current = false;
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
