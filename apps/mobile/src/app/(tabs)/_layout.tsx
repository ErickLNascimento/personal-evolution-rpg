import { Ionicons } from '@expo/vector-icons';
import { FEATURES } from '@per/domain';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import { useFeature } from '@/features/profile/useFeature';
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
  const { t } = useT();
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
        options={{ title: t('tabs.progress'), tabBarIcon: icon('trophy-outline') }}
      />
      <Tabs.Screen
        name="social"
        // Social desligado (feature flag): a aba some da barra.
        options={{
          title: t('tabs.social'),
          tabBarIcon: icon('people-outline'),
          href: socialOn ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: icon('person-circle-outline') }}
      />
    </Tabs>
  );
}
