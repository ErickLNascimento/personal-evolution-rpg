import type { HeroLook } from '@per/domain';
import { useState } from 'react';
import { View } from 'react-native';

import { AuraFx } from './AuraFx';
import { PIXEL_HERO_ASPECT, PixelHero, type PixelHeroAnim } from './PixelHero';
import { useT } from '@/i18n';

/** Proporção da caixa do herói (largura × 1,2), a mesma do desenho antigo: as telas não mudam de layout. */
const BOX_ASPECT = 1.2;

/**
 * Herói em pixel art (camadas recoloridas por shader; ver PixelHero).
 * - `size`: largura da caixa; a altura é size × 1,2 e o herói fica centralizado nela.
 * - `animated`: respira e pisca em loop; sem isso fica parado (miniaturas em listas).
 * - `cheer`: a cada aumento do número, comemora uma vez (missão concluída) e volta ao normal.
 * - `entrance`: toca uma animação uma vez ao aparecer (ex.: a cena de subir de nível).
 */
export function HeroAvatar({
  hero,
  size = 120,
  animated = false,
  cheer = 0,
  entrance,
}: {
  hero: HeroLook;
  size?: number;
  animated?: boolean;
  cheer?: number;
  entrance?: Exclude<PixelHeroAnim, 'idle'>;
}) {
  const { t } = useT();
  const [anim, setAnim] = useState<PixelHeroAnim>(entrance ?? 'idle');
  const [seenCheer, setSeenCheer] = useState(cheer);
  if (cheer !== seenCheer) {
    setSeenCheer(cheer);
    if (cheer > seenCheer) setAnim('celebrate');
  }

  const height = size * BOX_ASPECT;
  // O pixel art é mais alto que largo: cabe pela altura e fica centralizado na largura.
  const heroWidth = Math.min(size, height / PIXEL_HERO_ASPECT);
  const oneShot = anim !== 'idle';
  return (
    <View
      style={{ width: size, height, alignItems: 'center', justifyContent: 'flex-end' }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('screens.hero')}
    >
      <AuraFx
        aura={hero.aura}
        tier={hero.tier}
        width={heroWidth}
        height={heroWidth * PIXEL_HERO_ASPECT}
        boxWidth={size}
        boxHeight={height}
        animated={animated}
      />
      {/* zIndex: o herói fica sempre na frente do efeito da aura. */}
      <View style={{ zIndex: 1 }}>
        <PixelHero
          hero={hero}
          size={heroWidth}
          anim={anim}
          playing={animated || oneShot}
          onEnd={() => setAnim('idle')}
        />
      </View>
    </View>
  );
}
