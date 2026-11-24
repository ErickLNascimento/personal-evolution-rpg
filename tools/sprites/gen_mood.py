"""Rostinhos de humor (1 a 5) em pixel art 16x16, ampliados 8x (128 px) sem suavizar.

Uso: python tools/sprites/gen_mood.py [pasta_de_preview]
Grava apps/mobile/assets/sprites/mood/mood_<1..5>.png.
1 Péssimo (vermelho, boca caída e lágrima) · 2 Ruim (laranja, boca torta para baixo) ·
3 Ok (amarelo, boca reta) · 4 Bem (verde, sorriso) · 5 Ótimo (verde-água, sorrisão e olhos de estrela).
"""
import os
import sys

from PIL import Image

N, S = 16, 8
OUT = (14, 11, 26, 255)
EYE = (14, 11, 26, 255)
WHITE = (255, 255, 255, 255)
TEAR = (120, 200, 255, 255)
FACES = {
    1: ("#F2617A", "#B83A55", "#FF9DB0"),
    2: ("#F59E42", "#B9701F", "#FFC98A"),
    3: ("#F5D142", "#B99A1F", "#FFE98A"),
    4: ("#5BD08A", "#2E9A5C", "#A8F0C4"),
    5: ("#3FE0C5", "#159C88", "#B8FFF2"),
}
MOUTHS = {
    1: [(5, 12), (6, 11), (7, 10), (8, 10), (9, 11), (10, 12)],
    2: [(6, 11), (7, 10), (8, 10), (9, 11)],
    3: [(6, 11), (7, 11), (8, 11), (9, 11)],
    4: [(5, 10), (6, 11), (7, 11), (8, 11), (9, 11), (10, 10)],
    5: [(5, 10), (6, 10), (7, 10), (8, 10), (9, 10), (10, 10), (6, 11), (7, 12), (8, 12), (9, 11)],
}


def hexc(h):
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)


def face(mood):
    base, dark, light = (hexc(c) for c in FACES[mood])
    im = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    px = im.load()
    c = 7.5
    for y in range(N):
        for x in range(N):
            d = ((x - c) ** 2 + (y - c) ** 2) ** 0.5
            if d <= 7.4:
                px[x, y] = OUT
            if d <= 6.4:
                # luz em cima à esquerda, sombra embaixo à direita
                k = (x - c) * 0.5 + (y - c) * 0.8
                px[x, y] = light if k < -3.2 else dark if k > 3.2 else base
    # olhos
    if mood == 5:
        for ex in (5, 10):  # olhos de estrela
            for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
                px[ex + dx, 6 + dy] = WHITE if (dx, dy) == (0, 0) else EYE
    else:
        for ex in (5, 10):
            px[ex, 6] = EYE
            px[ex, 7] = EYE
            if mood >= 3:
                px[ex, 6] = EYE
        if mood <= 2:  # sobrancelhas caídas
            px[4, 4] = EYE
            px[11, 4] = EYE
            px[5, 5 - (1 if mood == 1 else 0)] = dark
    for x, y in MOUTHS[mood]:
        px[x, y] = EYE
    if mood == 1:  # lágrima
        px[4, 8] = TEAR
        px[4, 9] = TEAR
    if mood >= 4:  # bochechas
        px[3, 9] = light
        px[12, 9] = light
    return im.resize((N * S, N * S), Image.NEAREST)


if __name__ == "__main__":
    root = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(root, "..", "..", "apps", "mobile", "assets", "sprites", "mood")
    prev = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "out")
    os.makedirs(out, exist_ok=True)
    os.makedirs(prev, exist_ok=True)
    sheet = Image.new("RGBA", (5 * 136 + 8, 144), (26, 29, 37, 255))
    for m in range(1, 6):
        f = face(m)
        f.save(os.path.join(out, f"mood_{m}.png"), optimize=True)
        sheet.alpha_composite(f, (8 + (m - 1) * 136, 8))
    sheet.save(os.path.join(prev, "mood_preview.png"))
    print(os.path.join(prev, "mood_preview.png"))
