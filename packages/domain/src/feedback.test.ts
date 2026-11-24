import { FEEDBACK_KINDS, FEEDBACK_KIND_LABEL, FEEDBACK_MAX, validateFeedback } from './feedback';

describe('feedback', () => {
  it('pede um texto mínimo e ignora espaços', () => {
    expect(validateFeedback('')).not.toBeNull();
    expect(validateFeedback('   ok   ')).not.toBeNull();
    expect(validateFeedback('Achei ótimo!')).toBeNull();
  });

  it('limita o tamanho', () => {
    expect(validateFeedback('a'.repeat(FEEDBACK_MAX))).toBeNull();
    expect(validateFeedback('a'.repeat(FEEDBACK_MAX + 1))).not.toBeNull();
  });

  it('todo tipo tem rótulo', () => {
    for (const k of FEEDBACK_KINDS) expect(FEEDBACK_KIND_LABEL[k].length).toBeGreaterThan(0);
  });
});
