import {
  LATEST_RELEASE_NOTE_VERSION,
  RELEASE_NOTES,
  releaseItemText,
  unseenReleaseItems,
  type ReleaseNote,
} from './whatsNew';

const item = (title: string) => ({ icon: 'star', title, text: '…' });
const notes: ReleaseNote[] = [
  { version: 3, date: '2026-12-10', items: [item('c')] },
  { version: 2, date: '2026-12-01', items: [item('b1'), item('b2')] },
  { version: 1, date: '2026-11-25', items: [item('a')] },
];

describe('novidades', () => {
  it('mostra só o que veio depois da última nota vista, as mais novas primeiro', () => {
    expect(unseenReleaseItems(1, notes).map((i) => i.title)).toEqual(['c', 'b1', 'b2']);
    expect(unseenReleaseItems(3, notes)).toEqual([]);
    expect(unseenReleaseItems(0, notes)).toHaveLength(4);
  });

  it('itens de feature flag desligada ficam de fora', () => {
    const flagged: ReleaseNote[] = [
      {
        version: 2,
        date: '2026-12-01',
        items: [item('livre'), { ...item('diário'), flag: 'feature_x' }],
      },
    ];
    expect(unseenReleaseItems(0, flagged).map((i) => i.title)).toEqual(['livre']);
    expect(unseenReleaseItems(0, flagged, new Set(['feature_x'])).map((i) => i.title)).toEqual([
      'livre',
      'diário',
    ]);
  });

  it('as notas reais estão em ordem, com versões únicas e itens preenchidos', () => {
    const versions = RELEASE_NOTES.map((n) => n.version);
    expect([...versions].sort((a, b) => b - a)).toEqual(versions);
    expect(new Set(versions).size).toBe(versions.length);
    expect(LATEST_RELEASE_NOTE_VERSION).toBe(versions[0]);
    for (const n of RELEASE_NOTES) {
      expect(n.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(n.items.length).toBeGreaterThan(0);
      for (const i of n.items) expect(i.title && i.text && i.icon).toBeTruthy();
    }
  });
});

describe('novidades em inglês', () => {
  it('toda nota tem versão em inglês', () => {
    for (const note of RELEASE_NOTES) for (const item of note.items) expect(item.en).toBeDefined();
  });
  it('escolhe o texto pelo idioma', () => {
    const item = { icon: 'x', title: 'Loja', text: 'pt', en: { title: 'Shop', text: 'en' } };
    expect(releaseItemText(item, 'en')).toEqual({ title: 'Shop', text: 'en' });
    expect(releaseItemText(item)).toEqual({ title: 'Loja', text: 'pt' });
    expect(releaseItemText({ icon: 'x', title: 'Loja', text: 'pt' }, 'en').title).toBe('Loja');
  });
});
