import { bossForWeek } from './challenges';
import {
  formatSocialCode,
  groupBossForWeek,
  groupBossState,
  normalizeSocialCode,
  searchQuery,
  socialName,
  validateGroupName,
} from './social';

describe('código de amigo', () => {
  it('aceita minúsculas, espaço e hífen', () => {
    expect(normalizeSocialCode('k7q-2pm')).toBe('K7Q2PM');
    expect(normalizeSocialCode(' K7Q 2PM ')).toBe('K7Q2PM');
  });

  it('recusa tamanho errado e letras ambíguas', () => {
    expect(normalizeSocialCode('K7Q2P')).toBeNull();
    expect(normalizeSocialCode('K7Q2PMX')).toBeNull();
    expect(normalizeSocialCode('K0Q2PM')).toBeNull(); // zero
    expect(normalizeSocialCode('KIQ2PM')).toBeNull(); // I
  });

  it('mostra com hífen', () => {
    expect(formatSocialCode('K7Q2PM')).toBe('K7Q-2PM');
  });
});

describe('grupos e busca', () => {
  it('valida o nome do grupo', () => {
    expect(validateGroupName('  Time   da  manhã ')).toEqual({ value: 'Time da manhã', error: null });
    expect(validateGroupName('  ').error).toBeTruthy();
    expect(validateGroupName('a'.repeat(41)).error).toBeTruthy();
  });

  it('busca exige ao menos 2 letras', () => {
    expect(searchQuery(' a ')).toBeNull();
    expect(searchQuery(' Ana  Lu ')).toBe('Ana Lu');
  });

  it('nome vazio vira um padrão', () => {
    expect(socialName(null)).toBe('Aventureiro sem nome');
    expect(socialName(' Bia ')).toBe('Bia');
  });
});

describe('chefe do grupo', () => {
  it('é diferente do chefe individual da semana', () => {
    for (const w of ['2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21'])
      expect(groupBossForWeek(w).id).not.toBe(bossForWeek(w).id);
  });

  it('derrotado quando o dano alcança a vida', () => {
    expect(groupBossState('2026-11-23', 20, 12)).toMatchObject({ hp: 8, defeated: false, weekEnd: '2026-11-29' });
    expect(groupBossState('2026-11-23', 20, 25)).toMatchObject({ hp: 0, defeated: true });
    expect(groupBossState('2026-11-23', 0, 0).defeated).toBe(false);
  });
});
