import { pick, resolveLocale } from './i18n';

describe('idioma', () => {
  it('português para pt, inglês para o resto', () => {
    expect(resolveLocale(['pt-BR'])).toBe('pt-BR');
    expect(resolveLocale(['pt-PT', 'en-US'])).toBe('pt-BR');
    expect(resolveLocale(['en-US'])).toBe('en');
    expect(resolveLocale(['es-ES', 'pt-BR'])).toBe('en');
    expect(resolveLocale([])).toBe('en');
  });

  it('a preferência fixa vence o celular', () => {
    expect(resolveLocale(['en-US'], 'pt-BR')).toBe('pt-BR');
    expect(resolveLocale(['pt-BR'], 'en')).toBe('en');
  });

  it('escolhe o texto do idioma', () => {
    expect(pick({ 'pt-BR': 'Olá', en: 'Hello' }, 'en')).toBe('Hello');
    expect(pick({ 'pt-BR': 'Olá', en: 'Hello' })).toBe('Olá');
  });
});
