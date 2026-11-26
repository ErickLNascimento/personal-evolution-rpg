import { loadData, Skia, type SkImage } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';

/**
 * Imagens do Skia decodificadas uma vez e compartilhadas por todo o app (chefes, Oráculo).
 * Mesmo caminho que o herói usa (loadData + MakeImageFromEncoded): se o carregamento falhar
 * (ex.: rede do Metro em desenvolvimento), tenta de novo na próxima montagem em vez de deixar
 * o desenho vazio para sempre, como acontecia com o useImage.
 */
const loading = new Map<number, Promise<SkImage | null>>();
const loaded = new Map<number, SkImage>();

export function loadSkiaImage(source: number): Promise<SkImage | null> {
  let p = loading.get(source);
  if (!p) {
    p = loadData(source, (d) => Skia.Image.MakeImageFromEncoded(d))
      .catch((e: unknown) => {
        if (__DEV__) console.warn('[sprite] falha ao carregar imagem', source, String(e));
        return null;
      })
      .then((img) => {
        if (img) loaded.set(source, img);
        else loading.delete(source); // tenta de novo na próxima montagem
        return img;
      });
    loading.set(source, p);
  }
  return p;
}

/** Esperas entre tentativas quando o carregamento falha (ms). */
const RETRY_DELAYS = [800, 2000, 5000, 10000];

/**
 * Imagem já decodificada (ou null enquanto carrega); re-renderiza quando ficar pronta.
 * Se falhar (ex.: o Metro reiniciou com o app aberto), tenta de novo sozinha enquanto a tela
 * estiver montada, em vez de deixar o quadro vazio até reabrir o app.
 */
export function useSkiaImage(source: number): SkImage | null {
  const [, setVersion] = useState(0);
  const img = loaded.get(source) ?? null;
  useEffect(() => {
    if (img) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = (n: number) => {
      void loadSkiaImage(source).then((ready) => {
        if (!alive) return;
        if (ready) return setVersion((v) => v + 1);
        const wait = RETRY_DELAYS[Math.min(n, RETRY_DELAYS.length - 1)]!;
        timer = setTimeout(() => attempt(n + 1), wait);
      });
    };
    attempt(0);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [source, img]);
  return img;
}
