import {
  dataExportFileName,
  DEFAULT_TIME_ZONE,
  hasAiConsent,
  isDeleteConfirmation,
  isValidTimeZone,
  normalizeDisplayName,
  resolveTimeZone,
  validateCredentials,
  validateNewPassword,
} from './account';

describe('fuso horário', () => {
  it('aceita nomes IANA', () => {
    expect(isValidTimeZone('America/Manaus')).toBe(true);
    expect(isValidTimeZone('Europe/Lisbon')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
  });

  it('recusa valores inválidos ou vazios', () => {
    expect(isValidTimeZone('Manaus/Errado')).toBe(false);
    expect(isValidTimeZone('GMT-4')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });

  it('usa o padrão quando o fuso do aparelho não serve', () => {
    expect(resolveTimeZone('America/Manaus')).toBe('America/Manaus');
    expect(resolveTimeZone(null)).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone('nada')).toBe(DEFAULT_TIME_ZONE);
  });
});

describe('nome de exibição', () => {
  it('limpa espaços e trata vazio como nulo', () => {
    expect(normalizeDisplayName('  Erick   Lenon ')).toEqual({ value: 'Erick Lenon', error: null });
    expect(normalizeDisplayName('   ')).toEqual({ value: null, error: null });
  });

  it('recusa nome longo demais', () => {
    expect(normalizeDisplayName('a'.repeat(61)).error).not.toBeNull();
    expect(normalizeDisplayName('a'.repeat(60)).error).toBeNull();
  });
});

describe('credenciais', () => {
  const ok = { email: 'ana@teste.dev', password: '12345678' };

  it('aceita dados válidos', () => {
    expect(validateCredentials({ ...ok, mode: 'sign-up' })).toBeNull();
    expect(validateCredentials({ ...ok, email: ' ana@teste.dev ', mode: 'sign-in' })).toBeNull();
  });

  it('exige e-mail válido', () => {
    expect(validateCredentials({ ...ok, email: '', mode: 'sign-in' })).toBe('Informe seu e-mail.');
    expect(validateCredentials({ ...ok, email: 'ana@', mode: 'sign-in' })).toBe('E-mail inválido.');
  });

  it('exige senha, e senha forte só no cadastro', () => {
    expect(validateCredentials({ ...ok, password: '', mode: 'sign-in' })).toBe(
      'Informe sua senha.',
    );
    expect(validateCredentials({ ...ok, password: '123', mode: 'sign-in' })).toBeNull();
    expect(validateCredentials({ ...ok, password: '1234567', mode: 'sign-up' })).toMatch(
      /8 caracteres/,
    );
  });
});

describe('consentimento da IA', () => {
  it('depende da data de consentimento', () => {
    expect(hasAiConsent({ aiConsentAt: null })).toBe(false);
    expect(hasAiConsent({ aiConsentAt: '2026-11-22T10:00:00Z' })).toBe(true);
  });
});

describe('nova senha', () => {
  it('exige o mínimo e a confirmação igual', () => {
    expect(validateNewPassword('1234567', '1234567')).toMatch(/8 caracteres/);
    expect(validateNewPassword('12345678', '12345679')).toBe('As senhas não conferem.');
    expect(validateNewPassword('12345678', '12345678')).toBeNull();
  });
});

describe('confirmação de exclusão', () => {
  it('aceita EXCLUIR sem diferenciar maiúsculas e espaços', () => {
    expect(isDeleteConfirmation(' excluir ')).toBe(true);
    expect(isDeleteConfirmation('EXCLUIR')).toBe(true);
    expect(isDeleteConfirmation('excluir conta')).toBe(false);
    expect(isDeleteConfirmation('')).toBe(false);
  });
});

describe('exportação de dados', () => {
  it('nome do arquivo com a data', () => {
    expect(dataExportFileName('2026-11-24')).toBe('personal-evolution-rpg-dados-2026-11-24.json');
  });
});
