import { actTwoActive, ACT_II_BOSSES, BOSSES, bossForWeek, setBossCalendar, weekNumber } from './challenges';
import { groupBossForWeek } from './social';

const START = '2026-12-07'; // segunda em que o Ato II começa (no teste)
const startWeek = weekNumber(START);

describe('Ato II no rodízio', () => {
  afterEach(() => setBossCalendar({ act2StartWeek: 0 }));

  it('sem data de início, só o Ato I', () => {
    expect(actTwoActive(START, 0)).toBe(false);
    expect(BOSSES.map((b) => b.id)).toContain(bossForWeek(START, 0).id);
  });

  it('a partir do início, 12 chefes alternando novo e antigo, começando por um novo', () => {
    const ids = Array.from({ length: 12 }, (_, k) => {
      const d = new Date(Date.parse(`${START}T00:00:00Z`) + k * 7 * 86_400_000).toISOString().slice(0, 10);
      return bossForWeek(d, startWeek).id;
    });
    expect(ids).toEqual(['kraken', 'golem', 'quimera', 'hidra', 'banshee', 'lich', 'vampiro', 'dragao', 'mimico', 'sombra', 'medusa', 'basilisco']);
    expect(new Set(ids).size).toBe(12);
  });

  it('semanas anteriores ao início não mudam de chefe', () => {
    expect(bossForWeek('2026-11-23', startWeek).id).toBe('sombra');
    expect(bossForWeek('2026-11-16', startWeek).id).toBe('dragao');
  });

  it('o calendário vale para quem chama sem passar a data', () => {
    setBossCalendar({ act2StartWeek: startWeek });
    expect(bossForWeek(START).id).toBe('kraken');
    setBossCalendar({ act2StartWeek: -3 });
    expect(bossForWeek(START, undefined).id).toBe(bossForWeek(START, 0).id);
  });

  it('o chefe do bando é outro do mesmo ato', () => {
    setBossCalendar({ act2StartWeek: startWeek });
    const g = groupBossForWeek(START);
    expect(ACT_II_BOSSES.map((b) => b.id)).toContain(g.id);
    expect(g.id).not.toBe('kraken');
  });
});
