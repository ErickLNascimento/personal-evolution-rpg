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

/** Imagem já decodificada (ou null enquanto carrega); re-renderiza quando ficar pronta. */
export function useSkiaImage(source: number): SkImage | null {
  const [, setVersion] = useState(0);
  const img = loaded.get(source) ?? null;
  useEffect(() => {
    if (img) return;
    let alive = true;
    void loadSkiaImage(source).then((ready) => {
      if (alive && ready) setVersion((v) => v + 1);
    });
    return () => {
      alive = false;
    };
  }, [source, img]);
  return img;
}
