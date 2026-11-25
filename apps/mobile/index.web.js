// Entrada do app no web. O Skia (herói em pixel art) roda no navegador pelo CanvasKit (WebAssembly),
// e o objeto `Skia` lê o CanvasKit no momento em que é importado. Por isso o CanvasKit é carregado
// ANTES de importar o app: nenhum arquivo que use o Skia pode ser avaliado antes disto terminar.
// O canvaskit.wasm é copiado para public/ pelo script postinstall (setup-skia-web).
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

LoadSkiaWeb({ locateFile: (file) => `/${file}` }).then(() => import('expo-router/entry'));
