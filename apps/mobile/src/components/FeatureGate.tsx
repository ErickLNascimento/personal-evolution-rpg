import type { FeatureKey } from '@per/domain';
import type { ReactNode } from 'react';
import { Placeholder, StackScreen } from '@/components/Screen';
import { useFeature } from '@/features/profile/useFeature';
import { useT } from '@/i18n';

/** Tela de um recurso com feature flag: desligado, mostra um aviso no lugar. */
export function FeatureGate({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { t } = useT();
  const on = useFeature(feature);
  if (on) return <>{children}</>;
  return (
    <StackScreen>
      <Placeholder text={t('feature.disabled')} />
    </StackScreen>
  );
}
