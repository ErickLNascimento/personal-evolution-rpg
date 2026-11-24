import { enabledFeatures, FEATURES } from './features';

describe('feature flags', () => {
  it('só as linhas feature_ com valor 1 ficam ligadas', () => {
    const on = enabledFeatures([
      { key: 'feature_mood_journal', value: 1 },
      { key: 'feature_outra', value: 0 },
      { key: 'tour_version', value: 1 },
    ]);
    expect([...on]).toEqual([FEATURES.moodJournal]);
  });

  it('sem linhas, tudo desligado', () => {
    expect(enabledFeatures([]).size).toBe(0);
  });
});
