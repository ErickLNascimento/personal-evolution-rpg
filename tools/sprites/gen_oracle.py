"""Oráculo em pixel art 64x64: vidente encapuzado flutuando com uma esfera de cristal.

Uso: python tools/sprites/gen_oracle.py [pasta_de_preview]
Grava apps/mobile/assets/sprites/oracle/oracle_idle.png|json (cores fixas, sem troca de paleta).

Plano dos frames (12 frames, 8 fps, loop):
  flutua 2 px em senoide (ease in/out natural) · esfera pulsa nos frames 3–5 e 9–11 com anel no pico
  · três faíscas em órbita elíptica, atrás do corpo na metade de cima da órbita · barra do manto
  ondula · olhos piscam no frame 9.
"""
import math
import os
import sys

from sprite_tools import build_sheet, grid_to_rgba, hex_rgb, write_color_sheet

W = H = 64

OUT, ROBE_D, ROBE, ROBE_L, GOLD, GOLD_L, VOID, EYE, ORB, ORB_L, WHITE, SHADOW = range(1, 13)
PALETTE = [(0, 0, 0, 0)] + [(*hex_rgb(h), 255) for h in (
    "#191626", "#34257A", "#5B44C2", "#8468F0", "#E8BE58", "#FFE58A",
    "#0B0A14", "#5CF2E0", "#3FD3E6", "#B8FFF7", "#FFFFFF")] + [(0, 0, 0, 70)]


class Part:
    def __init__(self, outline=True):
        self.px = {}
        self.outline = outline

    def set(self, x, y, i):
        x, y = round(x), round(y)
        if 0 <= x < W and 0 <= y < H:
            self.px[(x, y)] = i

    def rect(self, x0, y0, x1, y1, i):
        for y in range(round(y0), round(y1) + 1):
            for x in range(round(x0), round(x1) + 1):
                self.set(x, y, i)

    def ellipse(self, cx, cy, rx, ry, i):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0:
                    self.set(x, y, i)


def compose(parts):
    g = [[0] * W for _ in range(H)]
    for p in parts:
        if p.outline:
            for (x, y) in p.px:
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in p.px:
                        g[ny][nx] = OUT
        for (x, y), i in p.px.items():
            g[y][x] = i
    return g


def sparkle(p, x, y, big, color):
    p.set(x, y, WHITE)
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        p.set(nx, ny, color)
    if big:
        for nx, ny in ((x + 2, y), (x - 2, y), (x, y + 2), (x, y - 2)):
            p.set(nx, ny, color)


def frame(n):
    dy = round(1.5 * math.sin(2 * math.pi * n / 12))       # flutuar
    pulse = n in (3, 4, 5, 9, 10, 11)
    peak = n in (4, 10)
    blink = n == 9
    parts = []

    shadow = Part(outline=False)
    shadow.ellipse(32, 60.5, 9 - dy, 1.3, SHADOW)
    parts.append(shadow)

    # faíscas em órbita (as de trás primeiro)
    def orbit_sparkles(front):
        p = Part(outline=False)
        for k in range(3):
            a = 2 * math.pi * (n / 12 + k / 3)
            x, y = 32 + 26 * math.cos(a), 33 + dy + 9 * math.sin(a)
            if (math.sin(a) > 0) == front:
                sparkle(p, x, y, big=front and k == 0, color=GOLD_L if k != 1 else EYE)
        return p
    parts.append(orbit_sparkles(front=False))

    # manto (corpo que alarga para baixo) com barra ondulando
    robe = Part()
    for y in range(28, 53):
        half = 8 + (y - 28) * 0.45
        robe.rect(32 - half, y + dy, 32 + half, y + dy, ROBE)
        robe.set(32 - half, y + dy, ROBE_L)
        robe.rect(32 + half - 2, y + dy, 32 + half, y + dy, ROBE_D)
    for x in range(21, 44):  # barra em ondas (sobe e desce com o tempo)
        wave = round(1.2 * math.sin(x / 2.2 + n * math.pi / 3))
        robe.rect(x, 53 + dy, x, 54 + dy + wave, ROBE_D if x % 3 else ROBE)
    for x, y in ((25, 46), (38, 49), (30, 51), (35, 43)):  # estrelas bordadas
        robe.set(x, y + dy, GOLD)
    parts.append(robe)

    # capuz com ponta e borda dourada
    hood = Part()
    hood.ellipse(32, 20 + dy, 11, 11, ROBE)
    for k in range(4):  # ponta caída para trás
        hood.rect(31 + k, 7 - k + dy, 33 + k, 10 - k + dy, ROBE)
    hood.rect(22, 18 + dy, 23, 28 + dy, ROBE_L)
    hood.rect(41, 18 + dy, 42, 28 + dy, ROBE_D)
    hood.rect(26, 11 + dy, 29, 11 + dy, ROBE_L)
    parts.append(hood)

    face = Part()
    face.ellipse(32, 22 + dy, 6.5, 6.5, VOID)
    for y in range(16, 30):  # borda dourada da abertura
        for x in range(24, 41):
            inside = ((x + 0.5 - 32) / 6.5) ** 2 + ((y + 0.5 - 22) / 6.5) ** 2 <= 1.0
            ring = ((x + 0.5 - 32) / 7.6) ** 2 + ((y + 0.5 - 22) / 7.6) ** 2 <= 1.0
            if ring and not inside and y < 21:  # só o arco de cima: borda do capuz
                face.set(x, y + dy, GOLD)
    if blink:
        face.rect(28, 22 + dy, 29, 22 + dy, EYE)
        face.rect(35, 22 + dy, 36, 22 + dy, EYE)
    else:
        for ex in (28, 35):
            face.rect(ex, 21 + dy, ex + 1, 22 + dy, EYE)
            face.set(ex, 21 + dy, WHITE)
    parts.append(face)

    # mangas descem dos ombros até a esfera, na diagonal
    for side in (-1, 1):
        sleeve = Part()
        for t in range(0, 11):
            x = 32 + side * (11 - t * 0.45)
            y = 30 + t
            w = 1 + t // 4
            sleeve.rect(x - w, y + dy, x + w, y + dy, ROBE_L if side < 0 else ROBE)
        cx = 32 + side * 6
        sleeve.rect(cx - 2, 40 + dy, cx + 2, 41 + dy, GOLD)  # punho dourado junto à esfera
        parts.append(sleeve)

    # esfera de cristal (pulsa) e anel de brilho no pico
    orb = Part()
    r = 5.6 if pulse else 5.0
    orb.ellipse(32, 41 + dy, r, r, ORB)
    orb.ellipse(30.5, 39.5 + dy, r * 0.5, r * 0.5, ORB_L)
    orb.set(29, 38 + dy, WHITE)
    orb.set(30, 38 + dy, WHITE)
    parts.append(orb)
    if peak:
        ring = Part(outline=False)
        for k in range(16):
            a = 2 * math.pi * k / 16
            if k % 2 == 0:
                ring.set(32 + 8.5 * math.cos(a), 41 + dy + 8.5 * math.sin(a), EYE)
        parts.append(ring)

    parts.append(orbit_sparkles(front=True))
    return compose(parts)


if __name__ == "__main__":
    root = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(root, "..", "..", "apps", "mobile", "assets", "sprites", "oracle")
    prev = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "out")
    frames = [grid_to_rgba(frame(n), PALETTE) for n in range(12)]
    write_color_sheet(frames, out, "oracle_idle", fps=8, loop=True)
    print(build_sheet(frames, prev, "oracle_idle", fps=8, loop=True, preview_scale=6))
    build_sheet(frames, prev, "oracle_idle_light", fps=8, loop=True, preview_scale=6, bg=(236, 236, 240, 255))
