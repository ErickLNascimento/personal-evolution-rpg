import { addDays, isLocalDate, startOfWeek, toLocalDate, weekday } from './dates';

describe('datas locais', () => {
  it('usa o fuso do usuário, não o UTC', () => {
    // 02:30 UTC de 23/11 ainda é 22/11 em Manaus (UTC-4)
    const instant = new Date('2026-11-23T02:30:00Z');
    expect(toLocalDate(instant, 'America/Manaus')).toBe('2026-11-22');
    expect(toLocalDate(instant, 'UTC')).toBe('2026-11-23');
  });

  it('vira o dia à meia-noite local', () => {
    expect(toLocalDate(new Date('2026-11-23T03:59:59Z'), 'America/Manaus')).toBe('2026-11-22');
    expect(toLocalDate(new Date('2026-11-23T04:00:00Z'), 'America/Manaus')).toBe('2026-11-23');
  });

  it('soma dias atravessando meses e anos', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('calcula dia da semana e início da semana (segunda)', () => {
    expect(weekday('2026-11-22')).toBe(0); // domingo
    expect(startOfWeek('2026-11-22')).toBe('2026-11-16');
    expect(startOfWeek('2026-11-16')).toBe('2026-11-16');
  });

  it('valida datas', () => {
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2026-11-22')).toBe(true);
    expect(isLocalDate('22/11/2026')).toBe(false);
    expect(() => addDays('2026-13-01', 1)).toThrow();
  });
});
