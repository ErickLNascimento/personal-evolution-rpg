import {
  afterFeedbackPrompt,
  EMPTY_FEEDBACK_MEMORY,
  FEEDBACK_PROMPT_DEFAULTS,
  feedbackPromptConfig,
  isLowRating,
  parseFeedbackMemory,
  shouldPromptFeedback,
  validateFeedbackRating,
  type FeedbackUsage,
} from './feedbackPrompt';

const TODAY = '2026-11-25';
const ready: FeedbackUsage = { firstLogDate: '2026-11-15', missionsDone: 20, alreadyRated: false };
const cfg = FEEDBACK_PROMPT_DEFAULTS;

describe('quando pedir feedback', () => {
  it('pede com uso suficiente e sem pedido recente', () => {
    expect(shouldPromptFeedback(EMPTY_FEEDBACK_MEMORY, ready, cfg, TODAY)).toBe(true);
  });

  it('espera os dias de uso e as missões mínimas', () => {
    expect(shouldPromptFeedback(EMPTY_FEEDBACK_MEMORY, { ...ready, firstLogDate: null }, cfg, TODAY)).toBe(false);
    expect(shouldPromptFeedback(EMPTY_FEEDBACK_MEMORY, { ...ready, firstLogDate: '2026-11-21' }, cfg, TODAY)).toBe(false);
    expect(shouldPromptFeedback(EMPTY_FEEDBACK_MEMORY, { ...ready, firstLogDate: '2026-11-20' }, cfg, TODAY)).toBe(true);
    expect(shouldPromptFeedback(EMPTY_FEEDBACK_MEMORY, { ...ready, missionsDone: 14 }, cfg, TODAY)).toBe(false);
  });

  it('respeita o intervalo entre pedidos', () => {
    const later = afterFeedbackPrompt(EMPTY_FEEDBACK_MEMORY, 'later', '2026-11-01');
    expect(shouldPromptFeedback(later, ready, cfg, '2026-11-30')).toBe(false);
    expect(shouldPromptFeedback(later, ready, cfg, '2026-12-01')).toBe(true);
  });

  it('para de vez ao enviar, ao pedir para não perguntar ou depois de 3 "Agora não"', () => {
    expect(shouldPromptFeedback(afterFeedbackPrompt(EMPTY_FEEDBACK_MEMORY, 'sent', '2026-01-01'), ready, cfg, TODAY)).toBe(false);
    expect(shouldPromptFeedback(afterFeedbackPrompt(EMPTY_FEEDBACK_MEMORY, 'never', '2026-01-01'), ready, cfg, TODAY)).toBe(false);
    expect(shouldPromptFeedback(EMPTY_FEEDBACK_MEMORY, { ...ready, alreadyRated: true }, cfg, TODAY)).toBe(false);
    const thrice = { lastShown: '2026-01-01', dismissals: 3, done: false };
    expect(shouldPromptFeedback(thrice, ready, cfg, TODAY)).toBe(false);
  });
});

describe('configuração e memória', () => {
  it('lê os números de app_settings, ignorando inválidos', () => {
    const c = feedbackPromptConfig(
      new Map([
        ['feedback_prompt_min_days', 2],
        ['feedback_prompt_cooldown_days', -1],
        ['outra_coisa', 9],
      ]),
    );
    expect(c).toEqual({ ...FEEDBACK_PROMPT_DEFAULTS, minDays: 2 });
  });

  it('memória guardada: lê o que é válido e ignora lixo', () => {
    expect(parseFeedbackMemory(null)).toEqual(EMPTY_FEEDBACK_MEMORY);
    expect(parseFeedbackMemory('{oops')).toEqual(EMPTY_FEEDBACK_MEMORY);
    expect(parseFeedbackMemory('{"lastShown":"2026-11-01","dismissals":2,"done":false}')).toEqual({
      lastShown: '2026-11-01',
      dismissals: 2,
      done: false,
    });
    expect(parseFeedbackMemory('{"dismissals":-3,"done":"sim"}')).toEqual(EMPTY_FEEDBACK_MEMORY);
  });
});

describe('nota e comentário', () => {
  it('nota baixa pede o porquê', () => {
    expect(isLowRating(2)).toBe(true);
    expect(isLowRating(3)).toBe(false);
  });
  it('validação', () => {
    expect(validateFeedbackRating(5, '')).toBeNull();
    expect(validateFeedbackRating(0, '')).toBe('Escolha uma nota de 1 a 5.');
    expect(validateFeedbackRating(6, '', 'en')).toBe('Pick a rating from 1 to 5.');
    expect(validateFeedbackRating(3, 'x'.repeat(1001))).toMatch(/1000/);
  });
});
