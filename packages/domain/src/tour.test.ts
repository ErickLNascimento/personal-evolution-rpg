import { shouldShowTour } from './tour';

describe('tour', () => {
  it('mostra para quem nunca viu e para quem viu uma versão antiga', () => {
    expect(shouldShowTour(0, 1)).toBe(true);
    expect(shouldShowTour(1, 2)).toBe(true);
  });

  it('não mostra de novo a versão já vista', () => {
    expect(shouldShowTour(1, 1)).toBe(false);
    expect(shouldShowTour(3, 2)).toBe(false);
  });

  it('sem a versão atual (não carregou), não mostra', () => {
    expect(shouldShowTour(0, null)).toBe(false);
  });
});
