import { DEFAULT_LOCALE, type Locale } from './i18n';

/**
 * Novidades: a cada atualização entregue aos usuários (build novo ou EAS Update), acrescente
 * uma entrada no INÍCIO de RELEASE_NOTES com `version` maior que a anterior. Quem abrir o app
 * vê um tour curto só com o que mudou desde a última nota que viu.
 * Recurso novo vira um slide; correção de bug (`kind: 'fix'`) não ganha slide: entra só numa
 * lista curta no último slide, com o `text` como nota.
 */

export interface ReleaseNoteItem {
  /** 'feature' (padrão): ganha um slide. 'fix': só uma linha na lista de correções. */
  kind?: 'feature' | 'fix';
  /** Nome de um ícone do Ionicons (ex.: 'stats-chart'). */
  icon: string;
  title: string;
  text: string;
  /** Tela para "Ver agora" (rota do Expo Router), se houver. */
  route?: string;
  /** Só aparece com esta feature flag ligada (ver features.ts). */
  flag?: string;
  /** Título e texto em inglês (obrigatórios nas notas novas). */
  en?: { title: string; text: string };
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
    version: 13,
    date: '2026-11-26',
    items: [
      {
        icon: 'flag',
        flag: 'feature_duo_quests',
        title: 'Missões em equipe',
        text: 'Chame um amigo na Fogueira para um desafio da semana: cada um faz suas missões numa área da vida, e quando os dois batem a meta, os dois ganham Cristais.',
        en: {
          title: 'Team quests',
          text: 'Invite a friend at the Campfire to a weekly challenge: each of you does your own missions in an area of life, and when both reach the goal, both earn Crystals.',
        },
        route: '/social',
      },
      {
        icon: 'shirt',
        title: 'Vestiário do herói',
        text: 'Seu herói agora fica num pedestal entre tochas, e as escolhas ficam em abas: deslize entre Herói, Visual, Equipamento, Título e Caminho, e veja cada peça no próprio herói antes de escolher.',
        en: {
          title: 'Hero wardrobe',
          text: 'Your hero now stands on a pedestal between torches, and the choices live in tabs: swipe between Hero, Looks, Gear, Title and Path, and see each piece on your hero before picking.',
        },
        route: '/hero',
      },
    ],
  },
  {
    version: 12,
    date: '2026-11-25',
    items: [
      {
        icon: 'mail-unread',
        flag: 'feature_friend_alerts',
        title: 'Convites à vista',
        text: 'Quando alguém te convida para a Fogueira, um número aparece na aba e o convite surge na tela Hoje: aceite ou recuse ali mesmo.',
        en: {
          title: 'Invites in sight',
          text: 'When someone invites you to the Campfire, a number shows up on the tab and the invite appears on Today: accept or decline right there.',
        },
        route: '/social',
      },
      {
        kind: 'fix',
        icon: 'phone-portrait',
        title: 'Teclado no Android',
        text: 'No Android, o teclado não cobre mais os campos de texto, como a busca de amigos.',
        en: {
          title: 'Keyboard on Android',
          text: 'On Android, the keyboard no longer covers text fields, like the friend search.',
        },
      },
    ],
  },
  {
    version: 11,
    date: '2026-12-07',
    items: [
      {
        icon: 'planet',
        flag: 'feature_act_2',
        title: 'Ato II: seis chefes novos',
        text: 'Kraken do Perfeccionismo, Quimera da Comparação, Banshee da Culpa, Vampiro da Insônia, Mímico das Desculpas e Medusa do Gasto entram no rodízio, alternando com os antigos.',
        en: {
          title: 'Act II: six new bosses',
          text: 'The Kraken of Perfectionism, Chimera of Comparison, Banshee of Guilt, Vampire of Insomnia, Mimic of Excuses and Medusa of Spending join the rotation, alternating with the old ones.',
        },
        route: '/challenges',
      },
      {
        icon: 'trophy',
        flag: 'feature_monthly_boss',
        title: 'Lorde do mês',
        text: 'Um chefe lendário, dourado, fica o mês inteiro em Desafios: derrube-o com as missões do mês e ganhe 200 Cristais.',
        en: {
          title: 'Lord of the month',
          text: 'A golden legendary boss stays all month in Challenges: bring it down with the month\'s missions and earn 200 Crystals.',
        },
        route: '/challenges',
      },
    ],
  },
  {
    version: 10,
    date: '2026-12-04',
    items: [
      {
        icon: 'ribbon',
        flag: 'feature_boss_ranks',
        title: 'Chefes com patente',
        text: 'Cada chefe que você vence volta mais forte: Capitão, General e Lorde, com mais vida, cores novas e prêmios maiores.',
        en: {
          title: 'Boss ranks',
          text: 'Every boss you beat comes back stronger: Captain, General and Lord, with more HP, new colors and bigger rewards.',
        },
        route: '/challenges',
      },
      {
        icon: 'flash',
        flag: 'feature_boss_weakness',
        title: 'Fraquezas dos chefes',
        text: 'Cada chefe tem uma fraqueza: as missões dessa área da vida tiram 2 de vida dele. O Golem da Preguiça, por exemplo, teme a Saúde.',
        en: {
          title: 'Boss weaknesses',
          text: 'Each boss has a weakness: missions in that area of life deal 2 damage. The Golem of Sloth, for example, fears Health.',
        },
        route: '/challenges',
      },
      {
        icon: 'warning',
        flag: 'feature_ambush',
        title: 'Emboscadas',
        text: 'De vez em quando um minichefe aparece por 2 dias com um desafio curto. Cumpra a tempo e ganhe Cristais extras.',
        en: {
          title: 'Ambushes',
          text: 'Every now and then a mini-boss shows up for 2 days with a short challenge. Beat it in time for extra Crystals.',
        },
      },
      {
        icon: 'skull',
        flag: 'feature_bestiary',
        title: 'Bestiário',
        text: 'Em Progresso, a coleção de todos os chefes: os vencidos aparecem caídos, com a maior patente e quantas vezes caíram.',
        en: {
          title: 'Bestiary',
          text: 'In Progress, the collection of every boss: the ones you beat lie defeated, with the highest rank and how many times they fell.',
        },
        route: '/progress',
      },
    ],
  },
  {
    version: 9,
    date: '2026-12-03',
    items: [
      {
        icon: 'bonfire',
        title: 'A Fogueira',
        text: 'A aba Social virou a Fogueira: veja quantos companheiros já completaram o dia, os pedidos em destaque e os bandos que enfrentam o chefe juntos.',
        en: {
          title: 'The Campfire',
          text: 'The Social tab is now the Campfire: see how many companions have completed the day, requests up front and the bands that face the boss together.',
        },
        route: '/social',
      },
      {
        icon: 'stats-chart',
        title: 'Progresso renovado',
        text: 'Seu herói, o nível e as gemas de sequência, escudos e XP no topo; o resto em capítulos que abrem com um toque.',
        en: {
          title: 'Progress, renewed',
          text: 'Your hero, level and gems for streak, shields and XP up top; everything else in chapters that open with a tap.',
        },
        route: '/progress',
      },
      {
        icon: 'trophy',
        flag: 'feature_weekly_recap',
        title: 'Crônica da semana',
        text: 'De segunda a quarta, um ponto dourado no Progresso avisa: lá está como foi a sua semana, com missões, dias perfeitos, XP, o hábito mais constante e o chefe.',
        en: {
          title: 'Weekly chronicle',
          text: 'Monday to Wednesday, a gold dot on Progress lets you know: your week is there, with missions, perfect days, XP, your most consistent habit and the boss.',
        },
        route: '/progress',
      },
    ],
  },
  {
    version: 8,
    date: '2026-12-02',
    items: [
      {
        icon: 'book',
        title: 'Perfil em capítulos',
        text: 'O Perfil virou um grimório: seu herói no topo e os ajustes em capítulos que abrem com um toque.',
        en: {
          title: 'Profile in chapters',
          text: 'Your Profile is now a grimoire: your hero up top and settings in chapters that open with a tap.',
        },
        route: '/profile',
      },
    ],
  },
  {
    version: 7,
    date: '2026-12-01',
    items: [
      {
        icon: 'airplane',
        flag: 'feature_vacation',
        title: 'Modo férias',
        text: 'Vai viajar ou precisa de uma pausa? Em Perfil → Modo férias, marque até 14 dias: as missões somem e o seu streak fica guardado.',
        en: {
          title: 'Vacation mode',
          text: 'Traveling or need a break? In Profile → Vacation mode, schedule up to 14 days: your missions disappear and your streak is kept safe.',
        },
        route: '/profile',
      },
    ],
  },
  {
    version: 6,
    date: '2026-11-30',
    items: [
      {
        kind: 'fix',
        icon: 'skull',
        title: 'Chefes à vista',
        text: 'Os monstros do chefe da semana e o Oráculo não somem mais da tela.',
        en: {
          title: 'Bosses in sight',
          text: 'The weekly boss monsters and the Oracle no longer disappear from the screen.',
        },
        route: '/challenges',
      },
      {
        icon: 'language',
        flag: 'feature_english',
        title: 'Inglês no app todo',
        text: 'Herói, caminhos, títulos, chefes, Oráculo e notificações agora também em inglês.',
        en: {
          title: 'English everywhere',
          text: 'Your hero, paths, titles, bosses, the Oracle and notifications now speak English too.',
        },
      },
    ],
  },
  {
    version: 5,
    date: '2026-11-29',
    items: [
      {
        icon: 'language',
        flag: 'feature_english',
        title: 'Now in English',
        text: 'O app agora fala inglês: ele segue o idioma do celular, e dá para escolher em Perfil → Idioma.',
        en: {
          title: 'Now in English',
          text: 'The app now speaks English: it follows your phone\'s language, and you can choose in Profile → Language.',
        },
        route: '/profile',
      },
    ],
  },
  {
    version: 4,
    date: '2026-11-28',
    items: [
      {
        icon: 'download',
        flag: 'feature_data_export',
        title: 'Baixe os seus dados',
        text: 'Em Perfil → Seus dados, baixe um arquivo com tudo o que o app guarda sobre você: hábitos, registros, XP, Cristais, diário e mais.',
        en: {
          title: 'Download your data',
          text: 'In Profile → Your data, download a file with everything the app stores about you: habits, logs, XP, Crystals, journal and more.',
        },
        route: '/profile',
      },
    ],
  },
  {
    version: 3,
    date: '2026-11-27',
    items: [
      {
        icon: 'shield',
        title: 'Ícone novo',
        text: 'O app ganhou um brasão próprio na tela inicial: o escudo com a seta de subir de nível.',
        en: {
          title: 'New icon',
          text: 'The app has its own crest on your home screen: the shield with the level-up arrow.',
        },
      },
      {
        icon: 'happy',
        flag: 'feature_mood_journal',
        title: 'Diário de humor',
        text: 'Na tela Hoje, conte como você está com um toque (e, se quiser, sentimentos e uma nota). O primeiro registro do dia rende 3 Cristais. Só você vê.',
        en: {
          title: 'Mood journal',
          text: 'On the Today screen, share how you feel with one tap (plus feelings and a note, if you like). Your first check-in of the day earns 3 Crystals. Only you can see it.',
        },
      },
      {
        icon: 'analytics',
        flag: 'feature_mood_journal',
        title: 'O que mexe com o seu humor',
        text: 'Em Progresso, veja seu humor dos últimos 14 dias e se ele melhora nos dias em que você cumpre todas as missões.',
        en: {
          title: 'What moves your mood',
          text: 'In Progress, see your mood over the last 14 days and whether it improves on days you finish all your missions.',
        },
        route: '/progress',
      },
    ],
  },
  {
    version: 2,
    date: '2026-11-26',
    items: [
      {
        icon: 'people',
        title: 'Amigos',
        text: 'Na nova aba Social, adicione amigos pelo código ou pelo nome. Vocês veem o herói, o nível, o streak e quantas missões cada um fez hoje. Os nomes dos hábitos continuam só seus.',
        en: {
          title: 'Friends',
          text: 'In the new Social tab, add friends by code or name. You see each other\'s hero, level, streak and how many missions each did today. Your habit names stay private.',
        },
        route: '/social',
      },
      {
        icon: 'shield-half',
        title: 'Grupos contra o chefe',
        text: 'Crie um grupo de até 6 pessoas: cada missão de qualquer um tira 1 de vida do chefe da semana do grupo. Derrotado, cada membro ganha 30 Cristais.',
        en: {
          title: 'Groups vs. the boss',
          text: 'Create a group of up to 6 people: every mission anyone completes takes 1 HP from the group\'s weekly boss. Once it\'s defeated, each member earns 30 Crystals.',
        },
        route: '/social',
      },
      {
        icon: 'skull',
        title: 'Os chefes ganharam vida',
        text: 'Golem, Hidra, Lich, Dragão, Sombra e Basilisco agora são monstros animados: provocam você, sentem cada missão feita, enfraquecem e se desfazem em luz quando derrotados.',
        en: {
          title: 'The bosses came alive',
          text: 'Golem, Hydra, Lich, Dragon, Shadow and Basilisk are now animated monsters: they taunt you, feel every mission you complete, weaken and dissolve into light when defeated.',
        },
        route: '/challenges',
      },
      {
        icon: 'happy',
        title: 'Comemoração sempre à vista',
        text: 'Concluiu uma missão lá embaixo na lista? Seu herói aparece num balão e comemora com você.',
        en: {
          title: 'Celebration always in view',
          text: 'Completed a mission far down the list? Your hero pops up in a bubble and celebrates with you.',
        },
      },
      {
        icon: 'cloud-download',
        title: 'Atualizações avisadas',
        text: 'Quando sair uma versão nova, o app avisa, baixa em segundo plano e aplica na próxima vez que você abrir.',
        en: {
          title: 'Update notices',
          text: 'When a new version comes out, the app lets you know, downloads it in the background and applies it the next time you open it.',
        },
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
        en: {
          title: 'Weekly boss',
          text: 'A new boss shows up every week. Each mission you complete takes 1 HP from it. Defeat it to earn 40 Crystals.',
        },
        route: '/challenges',
      },
      {
        icon: 'trail-sign',
        title: 'Jornadas de 21 e 66 dias',
        text: 'Escolha um hábito e um prazo. Faça-o em 80% dos dias da agenda para vencer e ganhar até 450 Cristais.',
        en: {
          title: '21- and 66-day journeys',
          text: 'Pick a habit and a duration. Do it on 80% of its scheduled days to win up to 450 Crystals.',
        },
        route: '/challenges',
      },
      {
        icon: 'water',
        title: 'Novos tipos de hábito',
        text: 'Além de “Fazer”, agora há “Evitar” (ex.: não fumar) e “Contar” (ex.: 8 copos de água, com + e − no card).',
        en: {
          title: 'New habit types',
          text: 'Besides “Do”, there\'s now “Avoid” (e.g. no smoking) and “Count” (e.g. 8 glasses of water, with + and − on the card).',
        },
        route: '/habit/new',
      },
      {
        icon: 'stats-chart',
        title: 'Estatísticas por hábito',
        text: 'Toque num hábito para ver a taxa de conclusão, a melhor sequência e o mapa das últimas 12 semanas.',
        en: {
          title: 'Habit stats',
          text: 'Tap a habit to see its completion rate, best streak and a map of the last 12 weeks.',
        },
      },
      {
        icon: 'storefront',
        title: 'Loja',
        text: 'Gaste Cristais em auras, roupas e cabelos exclusivos, ou crie recompensas da vida real (“ver um episódio = 50 Cristais”).',
        en: {
          title: 'Shop',
          text: 'Spend Crystals on exclusive auras, outfits and hair colors, or create real-life rewards (“watch an episode = 50 Crystals”).',
        },
        route: '/shop',
      },
    ],
  },
];

export const LATEST_RELEASE_NOTE_VERSION = RELEASE_NOTES[0]?.version ?? 0;

/**
 * Itens que o usuário ainda não viu (os mais novos primeiro). Itens de uma feature flag
 * desligada ficam de fora.
 */
export function unseenReleaseItems(
  seenVersion: number,
  notes: readonly ReleaseNote[] = RELEASE_NOTES,
  features: ReadonlySet<string> = new Set(),
): ReleaseNoteItem[] {
  return notes
    .filter((n) => n.version > seenVersion)
    .sort((a, b) => b.version - a.version)
    .flatMap((n) => n.items)
    .filter((i) => !i.flag || features.has(i.flag));
}

/** Título e texto do item no idioma (sem tradução, fica o português). */
export function releaseItemText(
  item: ReleaseNoteItem,
  locale: Locale = DEFAULT_LOCALE,
): { title: string; text: string } {
  return locale === 'en' && item.en ? item.en : { title: item.title, text: item.text };
}

/** Separa os itens em recursos novos (slides) e correções (lista no último slide). */
export function splitReleaseItems(items: readonly ReleaseNoteItem[]): {
  features: ReleaseNoteItem[];
  fixes: ReleaseNoteItem[];
} {
  return {
    features: items.filter((i) => i.kind !== 'fix'),
    fixes: items.filter((i) => i.kind === 'fix'),
  };
}
