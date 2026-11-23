import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

export interface Profile {
  id: string;
  displayName: string | null;
  timezone: string;
  aiConsentAt: string | null;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  timezone: string;
  ai_consent_at: string | null;
}

export type ProfileChanges = Partial<{
  display_name: string | null;
  timezone: string;
  ai_consent_at: string | null;
}>;

const COLUMNS = 'id, display_name, timezone, ai_consent_at';

function fromRow(row: ProfileRow): Profile {
  return { id: row.id, displayName: row.display_name, timezone: row.timezone, aiConsentAt: row.ai_consent_at };
}

async function fetchProfile(userId: string): Promise<{ profile: Profile | null; error: string | null }> {
  if (!supabase) return { profile: null, error: 'Supabase não configurado.' };
  const { data, error } = await supabase.from('profiles').select(COLUMNS).eq('id', userId).single<ProfileRow>();
  if (error) return { profile: null, error: 'Não foi possível carregar o perfil.' };
  return { profile: fromRow(data), error: null };
}

/** Perfil do usuário logado. O RLS garante que só o próprio perfil é lido e alterado. */
export function useProfile() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    fetchProfile(userId).then((result) => {
      if (!active) return;
      setError(result.error);
      if (result.profile) setProfile(result.profile);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [userId, attempt]);

  const reload = useCallback(() => {
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  /** Salva e devolve uma mensagem de erro em português, ou `null` se deu certo. */
  const update = useCallback(
    async (changes: ProfileChanges): Promise<string | null> => {
      if (!supabase || !userId) return 'Você precisa estar conectado.';
      const { data, error: saveError } = await supabase
        .from('profiles')
        .update(changes)
        .eq('id', userId)
        .select(COLUMNS)
        .single<ProfileRow>();
      if (saveError) {
        return saveError.code === '22023' ? 'Fuso horário inválido.' : 'Não foi possível salvar. Tente de novo.';
      }
      setProfile(fromRow(data));
      return null;
    },
    [userId],
  );

  return { profile, loading, error, reload, update };
}
