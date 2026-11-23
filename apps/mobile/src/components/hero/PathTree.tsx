import { Ionicons } from '@expo/vector-icons';
import {
  BRANCH_TIER,
  PATH_INFO,
  stageName,
  STAGE_RULES,
  type Branch,
  type HeroForm,
  type HeroPathState,
  type PathId,
  type Tier,
} from '@per/domain';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';

/**
 * Árvore do caminho: tronco (estágios 0–2) e os dois ramos (3–5) lado a lado.
 * Estágios alcançados ficam marcados; o atual em destaque; os próximos mostram o requisito.
 */
export function PathTree({
  state,
  form,
}: {
  state: HeroPathState & { path: PathId };
  form: HeroForm;
}) {
  const info = PATH_INFO[state.path];
  const trunk = ([0, 1, 2] as Tier[]).map((t) => (
    <Node key={t} name={stageName(state.path, null, t, form)} tier={t} state={state} />
  ));
  return (
    <View style={styles.tree}>
      {trunk}
      <View style={styles.split}>
        {(['A', 'B'] as Branch[]).map((b) => (
          <View
            key={b}
            style={[styles.branch, state.branch && state.branch !== b && styles.otherBranch]}
          >
            <Text style={styles.branchLabel}>{info.branches[b].label.toUpperCase()}</Text>
            {([3, 4, 5] as Tier[]).map((t) => (
              <Node
                key={t}
                name={stageName(state.path, b, t, form)}
                tier={t}
                state={state}
                branch={b}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function Node({
  name,
  tier,
  state,
  branch,
}: {
  name: string;
  tier: Tier;
  state: HeroPathState;
  branch?: Branch;
}) {
  const onBranch = tier < BRANCH_TIER || !state.branch || state.branch === branch;
  const reached =
    onBranch && tier <= state.stage && (tier < BRANCH_TIER || state.branch === branch);
  const current = reached && tier === state.stage;
  const rule = STAGE_RULES[tier]!;
  return (
    <View
      style={[styles.node, current && styles.current, reached && !current && styles.reached]}
      accessible
      accessibilityLabel={`${name}${current ? ', estágio atual' : reached ? ', alcançado' : `, requer nível ${rule.minLevel} e ${rule.minMissions} missões`}`}
    >
      <Ionicons
        name={current ? 'star' : reached ? 'checkmark-circle' : 'lock-closed'}
        size={14}
        color={current ? colors.xp : reached ? colors.accent : colors.textSecondary}
      />
      <View style={styles.nodeText}>
        <Text style={[styles.name, !reached && styles.locked]} numberOfLines={1}>
          {name}
        </Text>
        {!reached && tier > 0 && (
          <Text style={typography.caption}>
            Nv {rule.minLevel} · {rule.minMissions} missões
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tree: { gap: spacing.xs },
  split: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  branch: { flex: 1, gap: spacing.xs },
  otherBranch: { opacity: 0.45 },
  branchLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colors.textSecondary },
  node: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reached: { borderColor: colors.accent },
  current: { borderColor: colors.xp, backgroundColor: colors.surfaceRaised },
  nodeText: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  locked: { color: colors.textSecondary },
});
