import { Ionicons } from '@expo/vector-icons';
import { FEATURES, friendAlertBadge, shouldShowRecap } from '@per/domain';
import { useSyncExternalStore } from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, type ColorValue } from 'react-native';
import { useFeature } from '@/features/profile/useFeature';
import { useProfile } from '@/features/profile/useProfile';
import { useToday } from '@/features/profile/useToday';
import { seenRecapWeek, subscribeRecapSeen } from '@/features/recap/api';
import { useInvites } from '@/features/social/invites';
import { colors } from '@/theme/tokens';
import { useT } from '@/i18n';

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, color, size }: { name: IconName; color: ColorValue; size: number }) {
  return (
    <Ionicons
      name={name}
      color={typeof color === 'string' ? color : colors.textSecondary}
      size={size}
    />
  );
}

const icon = (name: IconName) => {
  const renderIcon = ({ color, size }: { color: ColorValue; size: number }) => (
    <TabIcon name={name} color={color} size={size} />
  );
  return renderIcon;
};

export default function TabsLayout() {
  const socialOn = useFeature(FEATURES.social);
  const recapOn = useFeature(FEATURES.weeklyRecap);
  const { profile } = useProfile();
  const { today } = useToday();
  const { t } = useT();
  // Ponto dourado no Progresso de segunda a quarta, até a crônica da semana ser vista.
  const seen = useSyncExternalStore(subscribeRecapSeen, () =>
    profile ? seenRecapWeek(profile.id) : null,
  );
  const recapDot = recapOn && profile !== null && shouldShowRecap(today, seen);
  // Convites de amizade recebidos: contador na Fogueira (e cartão na tela Hoje).
  const alertsOn = useFeature(FEATURES.friendAlerts);
  const invites = useInvites(profile?.id ?? null, socialOn && alertsOn).requests.length;
  const inviteBadge = friendAlertBadge(invites);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.today'), tabBarIcon: icon('sunny-outline') }}
      />
      <Tabs.Screen
        name="habits"
        options={{ title: t('tabs.habits'), tabBarIcon: icon('list-outline') }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: t('tabs.progress'),
          tabBarIcon: icon('trophy-outline'),
          tabBarBadge: recapDot ? '' : undefined,
          tabBarBadgeStyle: styles.dot,
          tabBarAccessibilityLabel: recapDot
            ? `${t('tabs.progress')}, ${t('recap.newBadge')}`
            : undefined,
        }}
      />
      <Tabs.Screen
        name="social"
        // Social desligado (feature flag): a aba some da barra.
        options={{
          title: t('tabs.social'),
          tabBarIcon: icon('bonfire-outline'),
          href: socialOn ? undefined : null,
          tabBarBadge: inviteBadge,
          tabBarBadgeStyle: styles.count,
          tabBarAccessibilityLabel: inviteBadge
            ? invites === 1
              ? t('invites.tabA11yOne', { tab: t('tabs.social') })
              : t('invites.tabA11y', { tab: t('tabs.social'), count: invites })
            : undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: icon('person-circle-outline') }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Ponto pequeno, sem número.
  dot: {
    minWidth: 10,
    maxWidth: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.xp,
    top: 4,
  },
  // Contador de convites, na cor da Fogueira.
  count: {
    backgroundColor: '#FB923C',
    color: colors.background,
    fontSize: 11,
    fontWeight: '800',
  },
});
