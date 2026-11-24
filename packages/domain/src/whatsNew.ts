/**
 * Novidades: a cada atualização entregue aos usuários (build novo ou EAS Update), acrescente
 * uma entrada no INÍCIO de RELEASE_NOTES com `version` maior que a anterior. Quem abrir o app
 * vê um tour curto só com o que mudou desde a última nota que viu.
 */

export interface ReleaseNoteItem {
  /** Nome de um ícone do Ionicons (ex.: 'stats-chart'). */
  icon: string;
  title: string;
  text: string;
  /** Tela para "Ver agora" (rota do Expo Router), se houver. */
  route?: string;
}

export interface ReleaseNote {
  /** Inteiro crescente; o app guarda a última versão vista. */
  version: number;
  /** Data da entrega (AAAA-MM-DD). */
  date: string;
  items: ReleaseNoteItem[];
}

export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: 2,
    date: '2026-11-26',
    items: [
      {
        icon: 'people',
        title: 'Amigos',
        text: 'Na nova aba Social, adicione amigos pelo código ou pelo nome. Vocês veem o herói, o nível, o streak e quantas missões cada um fez hoje. Os nomes dos hábitos continuam só seus.',
        route: '/social',
      },
      {
        icon: 'shield-half',
        title: 'Grupos contra o chefe',
        text: 'Crie um grupo de até 6 pessoas: cada missão de qualquer um tira 1 de vida do chefe da semana do grupo. Derrotado, cada membro ganha 30 Cristais.',
        route: '/social',
      },
      {
        icon: 'skull',
        title: 'Os chefes ganharam vida',
        text: 'Golem, Hidra, Lich, Dragão, Sombra e Basilisco agora são monstros animados: provocam você, sentem cada missão feita, enfraquecem e se desfazem em luz quando derrotados.',
        route: '/challenges',
      },
      {
        icon: 'cloud-download',
        title: 'Atualizações avisadas',
        text: 'Quando sair uma versão nova, o app avisa, baixa em segundo plano e aplica na próxima vez que você abrir.',
      },
    ],
  },
  {
    version: 1,
    date: '2026-11-25',
    items: [
      {
        icon: 'skull',
        title: 'Chefe da semana',
        text: 'Toda semana um chefe novo aparece. Cada missão feita tira 1 de vida dele. Derrote-o e ganhe 40 Cristais.',
        route: '/challenges',
      },
      {
        icon: 'trail-sign',
        title: 'Jornadas de 21 e 66 dias',
        text: 'Escolha um hábito e um prazo. Faça-o em 80% dos dias da agenda para vencer e ganhar até 450 Cristais.',
        route: '/challenges',
      },
      {
        icon: 'water',
        title: 'Novos tipos de hábito',
        text: 'Além de “Fazer”, agora há “Evitar” (ex.: não fumar) e “Contar” (ex.: 8 copos de água, com + e − no card).',
        route: '/habit/new',
      },
      {
        icon: 'stats-chart',
        title: 'Estatísticas por hábito',
        text: 'Toque num hábito para ver a taxa de conclusão, a melhor sequência e o mapa das últimas 12 semanas.',
      },
      {
        icon: 'storefront',
        title: 'Loja',
        text: 'Gaste Cristais em auras, roupas e cabelos exclusivos, ou crie recompensas da vida real (“ver um episódio = 50 Cristais”).',
        route: '/shop',
      },
    ],
  },
];

export const LATEST_RELEASE_NOTE_VERSION = RELEASE_NOTES[0]?.version ?? 0;

/** Itens que o usuário ainda não viu (os mais novos primeiro). */
export function unseenReleaseItems(
  seenVersion: number,
  notes: readonly ReleaseNote[] = RELEASE_NOTES,
): ReleaseNoteItem[] {
  return notes
    .filter((n) => n.version > seenVersion)
    .sort((a, b) => b.version - a.version)
    .flatMap((n) => n.items);
}
