"""Ícone do app em pixel art: brasão roxo com borda dourada e uma seta de "subir de nível"
(três chevrons que clareiam de baixo para cima), faíscas de XP e fundo escuro com brilho.

Uso: python tools/sprites/gen_icon.py [pasta_de_preview]
Desenha numa grade de 64x64 e amplia 16x (1024 px) sem suavizar. Grava em apps/mobile/assets:
  icon.png                     1024, RGB (iOS e padrão; sem transparência)
  android-icon-foreground.png  1024, RGBA (só o brasão, dentro da zona segura de 66%)
  android-icon-background.png  1024, RGB  (fundo com brilho e estrelas)
  android-icon-monochrome.png  1024, RGBA (silhueta branca, para ícones temáticos do Android 13+)
  splash-icon.png              1024, RGBA (o brasão)
  favicon.png                  48, RGBA
"""
import math
import os
import sys

from PIL import Image

N = 64
SCALE = 16


def hexc(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


OUT = hexc("#0B0716")
BG = [hexc(h) for h in ("#0E0A1C", "#170F33", "#22164D", "#2F1D6B", "#3D2689")]
SH_D, SH, SH_L, SH_LL = hexc("#3A1F86"), hexc("#5B34C9"), hexc("#7C55F0"), hexc("#A58BFF")
GOLD_D, GOLD, GOLD_L = hexc("#B9791F"), hexc("#F5B942"), hexc("#FFE08A")
WHITE = hexc("#FFFFFF")
CYAN = hexc("#9EE7FF")


def blank(color=(0, 0, 0, 0)):
    return [[color] * N for _ in range(N)]


# ── brasão ──────────────────────────────────────────────────
X0, X1, Y0, YM, YT = 15, 48, 12, 36, 54  # bordas, início da ponta e ponta


def in_shield(x, y, inset=0.0):
    """Ponto dentro do brasão (com `inset` px de margem para dentro)."""
    cx = (X0 + X1) / 2
    half = (X1 - X0) / 2 - inset
    if y < Y0 + inset or y > YT - inset:
        return False
    if y <= YM:
        # cantos de cima arredondados
        r = 3
        if y < Y0 + inset + r:
            dx = abs(x + 0.5 - cx) - (half - r)
            dy = (Y0 + inset + r) - (y + 0.5)
            if dx > 0 and dx * dx + dy * dy > r * r:
                return False
        return abs(x + 0.5 - cx) <= half
    t = (y - YM) / (YT - inset - YM)
    return abs(x + 0.5 - cx) <= half * (1 - t ** 1.6)


def chevron(cx, top, w, thick):
    """Pixels de um chevron (^) com ponta em (cx, top)."""
    pts = set()
    for k in range(w):
        for j in range(thick):
            y = top + k + j
            pts.add((cx - k - 1, y))
            pts.add((cx + k, y))
    return pts


def draw_shield(g, mono=False):
    cx = (X0 + X1) // 2
    for y in range(N):
        for x in range(N):
            if not in_shield(x, y):
                continue
            if not in_shield(x, y, 1):
                g[y][x] = WHITE if mono else OUT
            elif not in_shield(x, y, 3):
                if mono:
                    g[y][x] = WHITE
                    continue
                # aro dourado com luz em cima/esquerda
                g[y][x] = GOLD_L if (x < cx - 6 and y < 30) or y < Y0 + 2 else GOLD if y < 44 else GOLD_D
            elif not in_shield(x, y, 4):
                g[y][x] = (0, 0, 0, 0) if mono else OUT
            else:
                if mono:
                    g[y][x] = (0, 0, 0, 0)
                    continue
                # interior roxo: claro em cima à esquerda, escuro embaixo
                k = (x - X0) / (X1 - X0) * 0.55 + (y - Y0) / (YT - Y0) * 0.9
                g[y][x] = SH_LL if k < 0.32 else SH_L if k < 0.62 else SH if k < 0.95 else SH_D
    # seta de subir de nível: três chevrons, de baixo (roxo claro) para cima (branco)
    for top, color, edge in ((32, SH_LL, SH_L), (25, GOLD, GOLD_D), (18, GOLD_L, WHITE)):
        pts = chevron(cx, top, 8, 3)
        for (x, y) in pts:
            if mono:
                g[y][x] = WHITE
            else:
                # contorno escuro em volta do chevron
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if (nx, ny) not in pts and in_shield(nx, ny, 4) and g[ny][nx] not in (GOLD, GOLD_L, WHITE, GOLD_D):
                        g[ny][nx] = OUT
        if not mono:
            for (x, y) in pts:
                top_px = (x, y - 1) not in pts
                g[y][x] = edge if top_px else color
    # brilho na ponta da seta
    if not mono:
        g[17][cx - 1] = WHITE
        g[17][cx] = WHITE


def sparkle(g, x, y, big, color):
    g[y][x] = WHITE
    for k in range(1, 3 if big else 2):
        for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)):
            if 0 <= x + dx < N and 0 <= y + dy < N:
                g[y + dy][x + dx] = color if k == 1 else hexc("#FFFFFF", 160)


def draw_background(g):
    cx, cy = 31.5, 31.5
    for y in range(N):
        for x in range(N):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy) / 46
            g[y][x] = BG[max(0, min(4, 4 - int(d * 5)))]
    for x, y in ((8, 10), (55, 8), (6, 44), (57, 50), (12, 58), (50, 22), (20, 4), (44, 59)):
        g[y][x] = hexc("#C9B8FF", 200)


def draw_sparkles(g):
    sparkle(g, 9, 20, True, GOLD_L)
    sparkle(g, 54, 14, False, CYAN)
    sparkle(g, 53, 41, True, GOLD_L)
    sparkle(g, 11, 47, False, CYAN)


def to_image(g, scale=SCALE, mode="RGBA"):
    im = Image.new("RGBA", (N, N))
    im.putdata([c for row in g for c in row])
    im = im.resize((N * scale, N * scale), Image.NEAREST)
    return im.convert(mode) if mode != "RGBA" else im


def shrink(g, factor):
    """Brasão menor e centrado (zona segura do ícone adaptativo do Android)."""
    big = to_image(g, 1)
    size = round(N * factor)
    small = big.resize((size, size), Image.NEAREST)
    canvas = Image.new("RGBA", (N, N))
    canvas.alpha_composite(small, ((N - size) // 2, (N - size) // 2))
    return canvas.resize((N * SCALE, N * SCALE), Image.NEAREST)


if __name__ == "__main__":
    root = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(root, "..", "..", "apps", "mobile", "assets")
    prev = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "out")
    os.makedirs(prev, exist_ok=True)

    full = blank()
    draw_background(full)
    draw_shield(full)
    draw_sparkles(full)
    to_image(full, mode="RGB").save(os.path.join(out, "icon.png"))

    fg = blank()
    draw_shield(fg)
    draw_sparkles(fg)
    # o Android recorta o ícone (círculo, squircle…): o desenho precisa caber nos 66% do centro
    shrink(fg, 0.78).save(os.path.join(out, "android-icon-foreground.png"))
    shrink(fg, 1.0).save(os.path.join(out, "splash-icon.png"))

    bgg = blank()
    draw_background(bgg)
    to_image(bgg, mode="RGB").save(os.path.join(out, "android-icon-background.png"))

    mono = blank()
    draw_shield(mono, mono=True)
    shrink(mono, 0.78).save(os.path.join(out, "android-icon-monochrome.png"))

    to_image(full).resize((48, 48), Image.LANCZOS).save(os.path.join(out, "favicon.png"))

    # prévia: ícone cheio, recortes do Android (círculo e squircle) e tamanhos pequenos
    icon = to_image(full)
    adaptive = to_image(bgg)
    adaptive.alpha_composite(shrink(fg, 0.78))
    sheet = Image.new("RGBA", (1024 + 3 * 400 + 80, 1024 + 40), (240, 240, 244, 255))
    sheet.alpha_composite(icon, (20, 20))
    from PIL import ImageDraw
    for i, shape in enumerate(("circle", "squircle")):
        m = Image.new("L", (1024, 1024), 0)
        d = ImageDraw.Draw(m)
        if shape == "circle":
            d.ellipse((0, 0, 1023, 1023), fill=255)
        else:
            d.rounded_rectangle((0, 0, 1023, 1023), radius=300, fill=255)
        clipped = Image.new("RGBA", (1024, 1024))
        clipped.paste(adaptive, (0, 0), m)
        sheet.alpha_composite(clipped.resize((380, 380), Image.LANCZOS), (1064 + i * 400, 20))
    for i, s in enumerate((192, 96, 48)):
        sheet.alpha_composite(icon.resize((s, s), Image.LANCZOS), (1064 + i * 220, 460))
    mono_prev = Image.new("RGBA", (1024, 1024), (40, 40, 52, 255))
    mono_prev.alpha_composite(shrink(mono, 0.78))
    sheet.alpha_composite(mono_prev.resize((380, 380), Image.LANCZOS), (1864, 460))
    path = os.path.join(prev, "icon_preview.png")
    sheet.save(path)
    print(path)
