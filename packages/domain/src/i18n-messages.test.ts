import { isDeleteConfirmation, normalizeDisplayName, validateCredentials, validateNewPassword } from './account';
import { canStartJourney } from './challenges';
import { validateFeedback } from './feedback';
import { validateFocusAreas } from './onboarding';
import { formatRemaining } from './paths';
import { socialName, validateGroupName } from './social';

describe('mensagens em inglês', () => {
  it('conta e login', () => {
    expect(validateCredentials({ email: '', password: '', mode: 'sign-in' }, 'en')).toBe('Enter your email.');
    expect(validateNewPassword('12345678', '87654321', 'en')).toBe("The passwords don't match.");
    expect(normalizeDisplayName('a'.repeat(61), 'en').error).toMatch(/at most/);
    expect(isDeleteConfirmation('delete', 'en')).toBe(true);
    expect(isDeleteConfirmation('excluir', 'en')).toBe(false);
    expect(isDeleteConfirmation('excluir')).toBe(true);
  });

  it('foco, feedback, social e desafios', () => {
    expect(validateFocusAreas([], 'en')).toBe('Pick at least one area.');
    expect(validateFeedback('a', 'en')).toMatch(/Write a bit more/);
    expect(socialName(null, 'en')).toBe('Nameless adventurer');
    expect(validateGroupName(' ', 'en').error).toBe('Give the group a name.');
    expect(canStartJourney('a', [{ habitId: 'a', status: 'active' }], 'en')).toMatch(/already on a journey/);
    expect(formatRemaining(10_000, 'en')).toBe('less than 1min');
  });

  it('sem idioma, tudo em português como antes', () => {
    expect(validateFocusAreas([])).toBe('Escolha pelo menos uma área.');
    expect(socialName(null)).toBe('Aventureiro sem nome');
  });
});
