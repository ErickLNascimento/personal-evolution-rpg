import { shouldRecheckUpdate, updateBanner } from './appUpdates';

const none = { isUpdateAvailable: false, isUpdatePending: false, isDownloading: false };

describe('aviso de atualização', () => {
  it('sem versão nova não mostra nada', () => {
    expect(updateBanner(none, null)).toBeNull();
  });

  it('encontrada: avisa que está baixando, com a porcentagem', () => {
    expect(
      updateBanner(
        { ...none, isUpdateAvailable: true, isDownloading: true, downloadProgress: 0.42 },
        null,
      ),
    ).toMatchObject({ kind: 'downloading', text: expect.stringContaining('42%') });
    expect(updateBanner({ ...none, isUpdateAvailable: true }, null)?.kind).toBe('downloading');
  });

  it('baixada: diz que será aplicada na próxima abertura', () => {
    const b = updateBanner(
      { ...none, isUpdateAvailable: true, isUpdatePending: true, updateId: 'u1' },
      null,
    );
    expect(b).toMatchObject({ kind: 'ready', text: expect.stringContaining('próxima vez') });
  });

  it('fechado pelo usuário, some só para aquela versão', () => {
    const pending = { ...none, isUpdatePending: true, updateId: 'u1' };
    expect(updateBanner(pending, 'u1')).toBeNull();
    expect(updateBanner({ ...pending, updateId: 'u2' }, 'u1')?.kind).toBe('ready');
  });

  it('confere de novo só depois de 30 minutos', () => {
    const t = new Date('2026-11-24T10:00:00Z');
    expect(shouldRecheckUpdate(null, t)).toBe(true);
    expect(shouldRecheckUpdate(new Date('2026-11-24T09:45:00Z'), t)).toBe(false);
    expect(shouldRecheckUpdate(new Date('2026-11-24T09:30:00Z'), t)).toBe(true);
  });
});
