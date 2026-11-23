import type { Difficulty, HeroLook, ObjectiveCategory, OnboardingHabit } from '@per/domain';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

export interface Profile {
  id: string;
  displayName: string | null;
  timezone: string;
  aiConsentAt: string | null;
  difficulty: Difficulty;
  focusAreas: ObjectiveCategory[];
  onboardingDone: boolean;
  /** Aparência do herói como salva (jsonb); leia com `sanitizeHero` do domínio. */
  hero: unknown;
  /** Classes compradas na loja (as iniciais são grátis e não aparecem aqui). */
  owned: ReadonlySet<string>;
  /** Título escolhido para exibir (null = o de nível atual). */
  equippedTitle: string | null;
  /** Títulos especiais já concedidos pelo banco. */
  earnedTitles: ReadonlySet<string>;
}

/** O que vem de outras tabelas além de `profiles`. */
interface ProfileExtras {
  owned: ReadonlySet<string>;
  earnedTitles: ReadonlySet<string>;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  timezone: string;
  ai_consent_at: string | null;
  difficulty: Difficulty;
  focus_areas: ObjectiveCategory[];
  onboarding_done: boolean;
  hero: unknown;
  equipped_title: string | null;
}

export type ProfileChanges = Partial<{
  display_name: string | null;
  timezone: string;
  ai_consent_at: string | null;
  focus_areas: ObjectiveCategory[];
  difficulty: Difficulty;
  hero: HeroLook;
  equipped_title: string | null;
}>;

export interface OnboardingInput {
  displayName: string;
  focusAreas: ObjectiveCategory[];
  difficulty: Difficulty;
  timezone: string;
  habits: OnboardingHabit[];
}

const COLUMNS = 'id, display_name, timezone, ai_consent_at, difficulty, focus_areas, onboarding_done, hero, equipped_title';

function fromRow(row: ProfileRow, extras: ProfileExtras): Profile {
  return {
    ...extras,
    equippedTitle: row.equipped_title,
    id: row.id,
    displayName: row.display_name,
    timezone: row.timezone,
    aiConsentAt: row.ai_consent_at,
    difficulty: row.difficulty,
    focusAreas: row.focus_areas,
    onboardingDone: row.onboarding_done,
    hero: row.hero,
  };
}

async function fetchProfile(userId: string): Promise<{ profile: Profile | null; error: string | null }> {
  if (!supabase) return { profile: null, error: 'Supabase não configurado.' };
  const [profile, unlocks, titles] = await Promise.all([
    supabase.from('profiles').select(COLUMNS).eq('id', userId).single<ProfileRow>(),
    supabase.from('user_unlocks').select('item_id').returns<{ item_id: string }[]>(),
    supabase.from('user_titles').select('title_id').returns<{ title_id: string }[]>(),
  ]);
  if (profile.error) return { profile: null, error: 'Não foi possível carregar o perfil.' };
  return {
    profile: fromRow(profile.data, {
      owned: new Set((unlocks.data ?? []).map((u) => u.item_id)),
      earnedTitles: new Set((titles.data ?? []).map((t) => t.title_id)),
    }),
    error: null,
  };
}

interface ProfileState {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Salva e devolve uma mensagem de erro em português, ou `null` se deu certo. */
  update: (changes: ProfileChanges) => Promise<string | null>;
  /** Conclui o primeiro acesso (perfil + hábitos escolhidos) numa transação. */
  completeOnboarding: (input: OnboardingInput) => Promise<string | null>;
  /** Recarrega o perfil sem passar pela tela de carregamento (ex.: depois de uma compra). */
  refresh: () => Promise<void>;
}

const ProfileContext = createContext<ProfileState | null>(null);

/**
 * Perfil do usuário logado, carregado uma vez e compartilhado por todas as telas.
 * O RLS garante que só o próprio perfil é lido e alterado.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  // Guarda de quem é o perfil carregado, para nunca mostrar o de outra conta após trocar de login.
  const [loaded, setLoaded] = useState<{ userId: string; profile: Profile | null; error: string | null } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    fetchProfile(userId).then((r) => {
      if (active) setLoaded({ userId, profile: r.profile, error: r.error });
    });
    return () => {
      active = false;
    };
  }, [userId, attempt]);

  const current = loaded && loaded.userId === userId ? loaded : null;

  const reload = useCallback(() => {
    setLoaded(null);
    setAttempt((n) => n + 1);
  }, []);

  const update = useCallback(
    async (changes: ProfileChanges) => {
      if (!supabase || !userId) return 'Você precisa estar conectado.';
      const { data, error } = await supabase
        .from('profiles')
        .update(changes)
        .eq('id', userId)
        .select(COLUMNS)
        .single<ProfileRow>();
      if (error) {
        if (error.code === '22023') return 'Fuso horário inválido.';
        if (error.code === '23514') return 'Valor inválido. Confira os campos.';
        if (error.code === 'PR005') return 'Essa classe ainda não foi comprada na Loja.';
        if (error.code === 'PR007') return 'Esse título ainda não foi conquistado.';
        return 'Não foi possível salvar. Tente de novo.';
      }
      setLoaded((prev) => ({
        userId,
        profile: fromRow(
          data,
          prev?.userId === userId && prev.profile
            ? { owned: prev.profile.owned, earnedTitles: prev.profile.earnedTitles }
            : { owned: new Set(), earnedTitles: new Set() },
        ),
        error: null,
      }));
      return null;
    },
    [userId],
  );

  const completeOnboarding = useCallback(
    async (input: OnboardingInput) => {
      if (!supabase || !userId) return 'Você precisa estar conectado.';
      const { error } = await supabase.rpc('complete_onboarding', {
        p_display_name: input.displayName,
        p_focus_areas: input.focusAreas,
        p_difficulty: input.difficulty,
        p_timezone: input.timezone,
        p_habits: input.habits,
      });
      if (error) {
        // Já concluído (ex.: toque duplo ou outro aparelho): só recarrega.
        if (error.code === 'PR001') {
          reload();
          return null;
        }
        if (error.code === '22023') return 'Fuso horário inválido.';
        return 'Não foi possível salvar. Verifique a internet e tente de novo.';
      }
      const r = await fetchProfile(userId);
      setLoaded({ userId, profile: r.profile, error: r.error });
      return r.error;
    },
    [userId, reload],
  );

  const refresh = useCallback(async () => {
    if (!userId) return;
    const r = await fetchProfile(userId);
    if (r.profile) setLoaded({ userId, profile: r.profile, error: null });
  }, [userId]);

  const value: ProfileState = {
    refresh,
    profile: current?.profile ?? null,
    loading: Boolean(userId) && !current,
    error: current?.error ?? null,
    reload,
    update,
    completeOnboarding,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileState {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile precisa estar dentro de <ProfileProvider>');
  return ctx;
}
