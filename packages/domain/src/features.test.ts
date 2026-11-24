import { enabledFeatures, FEATURES, LEGACY_FEATURES } from './features';

describe('feature flags', () => {
  it('recursos novos só ligam com 1', () => {
    const on = enabledFeatures([
      { key: 'feature_mood_journal', value: 1 },
      { key: 'tour_version', value: 1 },
    ]);
    expect(on.has(FEATURES.moodJournal)).toBe(true);
    expect(on.has('tour_version')).toBe(false);
    expect(enabledFeatures([]).has(FEATURES.moodJournal)).toBe(false);
  });

  it('recursos antigos ficam ligados sem a linha e só 0 desliga', () => {
    expect([...LEGACY_FEATURES].every((k) => enabledFeatures([]).has(k))).toBe(true);
    const on = enabledFeatures([{ key: FEATURES.shop, value: 0 }]);
    expect(on.has(FEATURES.shop)).toBe(false);
    expect(on.has(FEATURES.social)).toBe(true);
  });
});
