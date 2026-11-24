import type { Mood } from '@per/domain';
import { Image, View } from 'react-native';
import { colors } from '@/theme/tokens';

const FACES: Record<Mood, number> = {
  1: require('../../../assets/sprites/mood/mood_1.png'),
  2: require('../../../assets/sprites/mood/mood_2.png'),
  3: require('../../../assets/sprites/mood/mood_3.png'),
  4: require('../../../assets/sprites/mood/mood_4.png'),
  5: require('../../../assets/sprites/mood/mood_5.png'),
};

/** Rostinho de humor em pixel art (tools/sprites/gen_mood.py); sem humor, um círculo vazio. */
export function MoodFace({
  mood,
  size = 40,
  dim = false,
}: {
  mood: Mood | null;
  size?: number;
  dim?: boolean;
}) {
  if (mood === null)
    return (
      <View
        style={{
          width: size * 0.8,
          height: size * 0.8,
          margin: size * 0.1,
          borderRadius: size,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: colors.border,
        }}
      />
    );
  return (
    <Image
      source={FACES[mood]}
      style={{ width: size, height: size, opacity: dim ? 0.35 : 1 }}
      resizeMode="contain"
      fadeDuration={0}
    />
  );
}
