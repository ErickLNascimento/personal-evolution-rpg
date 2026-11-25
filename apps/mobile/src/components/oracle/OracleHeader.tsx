import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, radius, spacing } from '@/theme/tokens';
import { Oracle } from './Oracle';
import { useT } from '@/i18n';

/** O Oráculo com um balão de fala: dá voz à IA no topo da tela dele. */
export function OracleHeader({ says }: { says: string }) {
  const { t } = useT();
  return (
    <View style={styles.row}>
      <Oracle size={104} />
      <Animated.View key={says} entering={FadeIn.duration(300)} style={styles.bubble}>
        <View style={styles.tail} />
        <Text style={styles.name}>{t('oracle.name').toUpperCase()}</Text>
        <Text style={styles.text} accessibilityLiveRegion="polite">
          {says}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bubble: {
    flex: 1,
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: '#5CF2E0',
    backgroundColor: '#14202A',
  },
  tail: {
    position: 'absolute',
    left: -7,
    top: '50%',
    width: 12,
    height: 12,
    marginTop: -6,
    transform: [{ rotate: '45deg' }],
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#5CF2E0',
    backgroundColor: '#14202A',
  },
  name: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: '#5CF2E0' },
  text: { fontSize: 15, lineHeight: 21, color: colors.text },
});
