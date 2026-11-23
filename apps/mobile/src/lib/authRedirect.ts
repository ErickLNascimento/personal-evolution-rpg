/**
 * Lê os parâmetros que o Supabase põe no link de redefinição de senha.
 * Eles podem vir no fragmento (#access_token=…) ou na query (?code=… no fluxo PKCE).
 */
export interface AuthRedirectParams {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  type: string | null;
  error: string | null;
}

export function parseAuthRedirect(url: string): AuthRedirectParams {
  const params = new URLSearchParams();
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  if (queryIndex !== -1) {
    const end = hashIndex > queryIndex ? hashIndex : url.length;
    new URLSearchParams(url.slice(queryIndex + 1, end)).forEach((v, k) => params.set(k, v));
  }
  if (hashIndex !== -1) {
    new URLSearchParams(url.slice(hashIndex + 1)).forEach((v, k) => params.set(k, v));
  }
  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    code: params.get('code'),
    type: params.get('type'),
    error: params.get('error_description') ?? params.get('error'),
  };
}
