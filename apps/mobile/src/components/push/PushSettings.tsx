import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { FormMessage } from '@/components/Form';
import {
  enablePush,
  fetchPushSettings,
  registerIfAllowed,
  savePushSettings,
  type PushSettings as Prefs,
} from '@/features/push/push';
import { useT, type TKey } from '@/i18n';
import { colors, spacing, typography } from '@/theme/tokens';

const ROWS: { key: keyof Prefs; label: TKey; hint: TKey }[] = [
  { key: 'social', label: 'push.social', hint: 'push.socialHint' },
  { key: 'bosses', label: 'push.bosses', hint: 'push.bossesHint' },
  { key: 'reengage', label: 'push.reengage', hint: 'push.reengageHint' },
];

/** Perfil → Avisos no celular: liga o push (permissão + registro) e escolhe as categorias. */
export function PushSettings() {
  const { t } = useT();
  const [on, setOn] = useState<boolean | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void Notifications.getPermissionsAsync().then(async (p) => {
      if (!alive) return;
      setBlocked(!p.granted && !p.canAskAgain);
      setOn(p.granted && (await registerIfAllowed()));
    });
    void fetchPushSettings().then((r) => {
      if (!alive) return;
      if (r.error !== null) setError(r.error);
      else setPrefs(r.data);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function toggleMaster(next: boolean) {
    if (!next) {
      // Desligar de vez é nas configurações do celular; aqui só apaga as categorias.
      if (prefs) await change({ social: false, bosses: false, reengage: false });
      return;
    }
    const ok = await enablePush();
    setOn(ok);
    if (!ok) {
      const p = await Notifications.getPermissionsAsync();
      setBlocked(!p.canAskAgain);
    } else if (prefs && !prefs.social && !prefs.bosses && !prefs.reengage) {
      await change({ social: true, bosses: true, reengage: true });
    }
  }

  async function change(next: Prefs) {
    const before = prefs;
    setPrefs(next);
    setError(null);
    const r = await savePushSettings(next);
    if (r.error !== null) {
      setPrefs(before);
      setError(r.error);
    }
  }

  const anyOn = prefs ? prefs.social || prefs.bosses || prefs.reengage : true;
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={typography.body}>{t('push.master')}</Text>
          <Text style={typography.caption}>{t('push.masterHint')}</Text>
        </View>
        <Switch
          value={Boolean(on) && anyOn}
          disabled={on === null}
          onValueChange={(v) => void toggleMaster(v)}
          accessibilityLabel={t('push.master')}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>
      {blocked && <Text style={typography.caption}>{t('push.blocked')}</Text>}
      {on && prefs && (
        <>
          {ROWS.map((r) => (
            <View key={r.key} style={[styles.row, styles.sub]}>
              <View style={styles.text}>
                <Text style={typography.body}>{t(r.label)}</Text>
                <Text style={typography.caption}>{t(r.hint)}</Text>
              </View>
              <Switch
                value={prefs[r.key]}
                onValueChange={(v) => void change({ ...prefs, [r.key]: v })}
                accessibilityLabel={t(r.label)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
          ))}
          <Text style={typography.caption}>{t('push.quiet')}</Text>
        </>
      )}
      <FormMessage text={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sub: { paddingLeft: spacing.md },
  text: { flex: 1, gap: 2 },
});
