import { OBJECTIVE_CATEGORIES, validateHabitDraft } from './habits';
import {
  defaultTemplateSelection,
  FOCUS_AREAS_MAX,
  onboardingHabits,
  templatesFor,
  toggleFocusArea,
  validateFocusAreas,
} from './onboarding';

describe('áreas de foco', () => {
  it('liga e desliga, sem passar do máximo', () => {
    expect(toggleFocusArea([], 'health')).toEqual(['health']);
    expect(toggleFocusArea(['health'], 'health')).toEqual([]);
    const full = toggleFocusArea(toggleFocusArea(['health'], 'career'), 'finance');
    expect(full).toHaveLength(FOCUS_AREAS_MAX);
    expect(toggleFocusArea(full, 'knowledge')).toEqual(full);
  });

  it('exige de 1 a 3 áreas', () => {
    expect(validateFocusAreas([])).not.toBeNull();
    expect(validateFocusAreas(['health'])).toBeNull();
    expect(validateFocusAreas(['health', 'career', 'finance', 'knowledge'])).not.toBeNull();
  });
});

describe('modelos de hábito', () => {
  it('toda categoria tem modelos válidos pelas regras de hábito', () => {
    const all = templatesFor(OBJECTIVE_CATEGORIES);
    expect(all.length).toBeGreaterThanOrEqual(OBJECTIVE_CATEGORIES.length * 2);
    for (const t of all) {
      const r = validateHabitDraft({
        title: t.title,
        difficulty: t.difficulty,
        scheduleDays: t.scheduleDays,
        objectiveId: null,
        targetQty: '',
        unit: '',
      });
      expect(r.ok).toBe(true);
    }
    expect(new Set(all.map((t) => t.id)).size).toBe(all.length);
  });

  it('segue a ordem das áreas e pré-seleciona o primeiro de cada', () => {
    const t = templatesFor(['finance', 'health']);
    expect(t[0]?.category).toBe('finance');
    expect(defaultTemplateSelection(['finance', 'health'])).toEqual(['finance-0', 'health-0']);
  });

  it('monta os hábitos escolhidos ligados ao objetivo da área', () => {
    expect(onboardingHabits(['health', 'knowledge'], ['knowledge-0', 'nao-existe'])).toEqual([
      {
        title: 'Ler 10 páginas',
        difficulty: 'easy',
        schedule_days: [0, 1, 2, 3, 4, 5, 6],
        objective_title: 'Conhecimento',
        objective_category: 'knowledge',
      },
    ]);
  });

  it('modelo de área não escolhida é ignorado', () => {
    expect(onboardingHabits(['health'], ['knowledge-0'])).toEqual([]);
  });
});

describe('onboarding em inglês', () => {
  it('modelos e objetivos no idioma escolhido', () => {
    expect(templatesFor(['health'], 'en').map((t) => t.title)).toEqual([
      'Drink 2 L of water',
      'Walk for 20 minutes',
    ]);
    expect(onboardingHabits(['wellbeing'], ['wellbeing-0'], 'en')).toEqual([
      expect.objectContaining({ title: 'Meditate for 5 minutes', objective_title: 'Well-being' }),
    ]);
  });
});
