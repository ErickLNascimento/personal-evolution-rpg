import { HERO_TITLES, heroTitle } from './hero';
import { displayedTitle, hasTitle, levelTitleId, TITLE_CATALOG, TITLE_IDS, titleName, type TitleInfo } from './titles';

describe('títulos', () => {
  it('os títulos de nível batem com os títulos do herói', () => {
    for (const t of HERO_TITLES) {
      const id = levelTitleId(t.level);
      expect(titleName(id, 'masculino')).toBe(heroTitle(t.level, 'masculino'));
      expect(titleName(id, 'feminino')).toBe(heroTitle(t.level, 'feminino'));
    }
  });

  it('todo secreto tem pista; nenhum outro tem', () => {
    for (const id of TITLE_IDS) {
      const info: TitleInfo = TITLE_CATALOG[id];
      expect(Boolean(info.hint)).toBe(info.kind === 'secret');
    }
  });

  it('nível: tem quando alcança; especial: só quando concedido', () => {
    const none = new Set<string>();
    expect(hasTitle('nivel-10', 9, none)).toBe(false);
    expect(hasTitle('nivel-10', 10, none)).toBe(true);
    expect(hasTitle('fenix', 50, none)).toBe(false);
    expect(hasTitle('fenix', 1, new Set(['fenix']))).toBe(true);
  });

  it('exibe o escolhido se ainda vale; senão, o de nível', () => {
    const earned = new Set(['fenix']);
    expect(displayedTitle('fenix', 3, earned)).toBe('fenix');
    expect(displayedTitle('nivel-5', 7, earned)).toBe('nivel-5');
    expect(displayedTitle('nivel-20', 7, earned)).toBe('nivel-5');
    expect(displayedTitle('centuriao', 7, earned)).toBe('nivel-5');
    expect(displayedTitle(null, 12, earned)).toBe('nivel-10');
    expect(displayedTitle('inexistente', 1, earned)).toBe('nivel-1');
  });

  it('concordância de gênero nos especiais', () => {
    expect(titleName('mestre-das-manhas', 'feminino')).toBe('Mestra das Manhãs');
    expect(titleName('lorde-dos-cristais', 'feminino')).toBe('Lady dos Cristais');
    expect(titleName('conquista-finance', 'feminino')).toBe('Guardiã do Tesouro');
  });
});
