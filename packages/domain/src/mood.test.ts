import { addDays } from './dates';
import {
  cleanMoodInput,
  MOOD_NOTE_MAX,
  moodInsight,
  moodInsightText,
  moodLabel,
  moodStrip,
  moodTagLabel,
  type MoodEntry,
} from './mood';
import type { DayStatus } from './streak';

const e = (date: string, mood: 1 | 2 | 3 | 4 | 5): MoodEntry => ({
  date,
  mood,
  tags: [],
  note: null,
});

describe('diário de humor', () => {
  it('limpa sentimentos e nota', () => {
    expect(cleanMoodInput(['grato', 'feliz', 'motivado', 'grato'], '  oi  ')).toEqual({
      tags: ['motivado', 'grato'],
      note: 'oi',
      error: null,
    });
    expect(cleanMoodInput([], '   ').note).toBeNull();
    expect(cleanMoodInput([], 'a'.repeat(501)).error).toBeTruthy();
  });

  it('faixa dos últimos dias, com buracos sem registro', () => {
    const strip = moodStrip([e('2026-11-24', 4), e('2026-11-20', 2)], '2026-11-24', 5);
    expect(strip.map((d) => d.mood)).toEqual([2, null, null, null, 4]);
    expect(strip[0]!.date).toBe('2026-11-20');
  });

  it('descoberta só com dados suficientes dos dois lados', () => {
    const statuses = new Map<string, DayStatus>();
    const entries: MoodEntry[] = [];
    for (let i = 0; i < 6; i++) {
      const d = addDays('2026-11-01', i);
      statuses.set(d, i < 3 ? 'complete' : 'missed');
      entries.push(e(d, i < 3 ? 5 : 3));
    }
    const ins = moodInsight(entries, statuses)!;
    expect(ins).toMatchObject({ completeAvg: 5, missedAvg: 3, completeDays: 3, missedDays: 3 });
    expect(moodInsightText(ins)).toContain('5,0');
    expect(moodInsight(entries.slice(0, 5), statuses)).toBeNull();
  });

  it('texto quando não há diferença', () => {
    expect(
      moodInsightText({ completeAvg: 3.6, missedAvg: 3.5, completeDays: 3, missedDays: 3 }),
    ).toMatch(/parecido/);
  });
});

describe('humor em inglês', () => {
  it('rótulos, validação e descoberta', () => {
    expect(moodLabel(5, 'en')).toBe('Great');
    expect(moodLabel(5)).toBe('Ótimo');
    expect(moodTagLabel('grato', 'en')).toBe('Grateful');
    expect(cleanMoodInput([], 'x'.repeat(MOOD_NOTE_MAX + 1), 'en').error).toBe(
      `Use at most ${MOOD_NOTE_MAX} characters.`,
    );
    expect(
      moodInsightText({ completeAvg: 4.2, missedAvg: 3, completeDays: 3, missedDays: 3 }, 'en'),
    ).toBe('On days you finish all your missions, your mood averages 4.2; on other days, 3.0.');
  });
});
