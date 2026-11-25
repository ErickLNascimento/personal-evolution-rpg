"""Chefe "Sombra da Dúvida" em pixel art 64x64 (cores fixas, sem troca de paleta).

Uso: python tools/sprites/gen_boss_sombra.py [pasta_de_preview]
Grava apps/mobile/assets/sprites/bosses/sombra_<estado>.png|json.

Conceito: espectro de fumaça curvado, sem pernas, de contorno incerto; olhos ocos azul-claros,
braços finos com um dedo comprido; um "?" orbita a cabeça. A frase dele é
"Para que tentar? Não vai dar certo." — ele não ataca com força, faz hesitar.

Plano dos frames:
  idle (8, 8 fps, loop): flutua 2 px em senoide; olhos olham esq → centro → dir → centro
    (hesitação); frame 5 o corpo pisca pontilhado (meio transparente); "?" em órbita elíptica,
    atrás da cabeça na metade de cima; fiapos da cauda ondulam.
  taunt (8, 10 fps): 0 pose · 1 anticipation (recua e estica para cima) · 2 avança apontando ·
    3–5 hold: dedo esticado, "?" grande, sussurro "..." aparece ponto a ponto, olhos estreitos ·
    6 recolhe · 7 pose.
  hit (6, 12 fps): 0 clarão branco + recuo · 1 olhos espremidos, pedaço da direita se solta ·
    2 partículas voam, mordida no corpo · 3 partículas somem, volta 1 px · 4–5 assenta.
  weak (8, 8 fps, loop): 80% do tamanho, pontilhado que cintila, tremor ±1 px, "!" pisca no lugar
    do "?", olhos menores.
  defeat (12, 10 fps): derrubada e fica caída, olhos fechados, estrelinhas de nocaute
    (knockdown.py; o app para no último frame).
"""
import math
import os
import sys

from knockdown import FRAMES as KO_FRAMES, knockdown
from sprite_tools import build_sheet, grid_to_rgba, hex_rgb, write_color_sheet

W = H = 64

OUT, SH_D, SH, SH_L, SH_LL, EYE, EYE_L, GOLD, SHADOW = range(1, 10)
PALETTE = [(0, 0, 0, 0)] + [(*hex_rgb(h), 255) for h in (
    "#0E0B1A", "#1E1A3A", "#2F2A57", "#4A4478", "#6E6A99", "#9EE7FF", "#E6FBFF", "#FFD45A")] + [
    (0, 0, 0, 70)]
KEEP = {EYE, EYE_L, GOLD}  # nunca somem no pontilhado

QUESTION = [".###.", "#...#", "....#", "..##.", "..#..", ".....", "..#.."]
BANG = ["#", "#", "#", "#", "#", ".", "#"]


def noise(x, y, n):
    v = (x * 73856093) ^ (y * 19349663) ^ (n * 83492791)
    return ((v * 2654435761) & 0xFFFF) / 65536.0


class Part:
    def __init__(self, outline=True):
        self.px = {}
        self.outline = outline

    def set(self, x, y, i):
        x, y = round(x), round(y)
        if 0 <= x < W and 0 <= y < H:
            self.px[(x, y)] = i

    def ellipse(self, cx, cy, rx, ry, i):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0:
                    self.set(x, y, i)

    def line(self, pts, width, i):
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            steps = max(1, int(max(abs(x1 - x0), abs(y1 - y0)) * 2))
            for k in range(steps + 1):
                t = k / steps
                x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                r = width / 2
                for yy in range(int(y - r), int(y + r) + 1):
                    for xx in range(int(x - r), int(x + r) + 1):
                        self.set(xx, yy, i)

    def glyph(self, rows, x0, y0, color, scale=1):
        x0, y0 = round(x0), round(y0)
        for gy, row in enumerate(rows):
            for gx, ch in enumerate(row):
                if ch == "#":
                    for sy in range(scale):
                        for sx in range(scale):
                            self.set(x0 + gx * scale + sx, y0 + gy * scale + sy, color)


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


def dither(g, phase, keep_ratio=0.5, from_y=0):
    """Some com metade dos pixels (xadrez) para parecer meio transparente; olhos e brilhos ficam."""
    for y in range(from_y, H):
        for x in range(W):
            if g[y][x] and g[y][x] not in KEEP and g[y][x] != SHADOW:
                if keep_ratio <= 0.5 and (x + y + phase) % 2 == 0:
                    g[y][x] = 0
    return g


def tone(x, cx, head=False, y=0, cy=0):
    rel = x - cx
    if head and rel < -4 and y < cy - 3:
        return SH_LL
    if rel < -3:
        return SH_L
    if rel > 3:
        return SH_D
    return SH


def body(cx, cy, s, n, lean=0.0, stretch=1.0, bite=None):
    """Espectro encapuzado: capuz pontudo caído para trás, ombros com fiapos, manto que alarga
    e termina em barra rasgada (dentes que ondulam)."""
    p = Part()
    top, hem = cy - 4 * s * stretch, cy + 17 * s
    y = top
    while y <= hem + 5 * s:
        t = (y - top) / (hem - top)
        half = (8 + 7 * min(t, 1.0)) * s if t < 0.25 else (9.8 + 5 * min(t, 1.0)) * s
        sway = math.sin(t * 4 + n * math.pi / 4) * 1.6 * max(0.0, t - 0.4)
        mid = cx + lean * (1 - min(t, 1.0)) + sway
        for x in range(int(mid - half), int(mid + half) + 1):
            if bite and (x - bite[0]) ** 2 + (y - bite[1]) ** 2 < bite[2] ** 2:
                continue
            if y > hem:
                # barra rasgada: dentes de alturas diferentes que ondulam
                k = int((x - (mid - half)) // (3 * s))
                tooth = (2 + (k * 7 + 3) % 4 + math.sin(n * math.pi / 4 + k) * 1.2) * s
                local = (x - (mid - half)) % (3 * s) / (3 * s)
                if y - hem > tooth * (1 - abs(local - 0.5) * 2):
                    continue
            elif y > hem - 6 * s and noise(x, int(y), n) < 0.08:
                continue  # furos na fumaça
            p.set(x, y, tone(x, mid))
        y += 1
    # fiapos pontudos nos ombros
    for side in (-1, 1):
        for k in range(3):
            bx = cx + side * (8 + k * 2.2) * s
            by = cy - 4 * s + k * 1.5
            for j in range(int((3 - k * 0.6) * s)):
                p.set(bx + side * j * 0.6, by - j, SH_D if side > 0 else SH_L)
    # capuz
    hx, hy = cx - 2 * s + lean, cy - 12 * s * stretch
    head = Part()
    rx, ry = 9 * s, 9.5 * s
    for yy in range(int(hy - ry) - 1, int(hy + ry) + 2):
        for xx in range(int(hx - rx) - 1, int(hx + rx) + 2):
            if ((xx + 0.5 - hx) / rx) ** 2 + ((yy + 0.5 - hy) / ry) ** 2 <= 1.0:
                head.set(xx, yy, tone(xx, hx, head=True, y=yy, cy=hy))
    # ponta do capuz: sobe e cai para trás (direita)
    for k in range(int(9 * s)):
        w = max(1, int((4 - k * 0.4) * s))
        tx = hx + 3 * s + k * 0.9
        ty = hy - ry + 1 - k * 0.55 + (k * k) * 0.05
        for j in range(w):
            head.set(tx + j * 0.3, ty + j, SH_D if j else SH)
    # abertura do rosto: vazio escuro
    for yy in range(int(hy - 6 * s), int(hy + 7 * s)):
        for xx in range(int(hx - 6.5 * s), int(hx + 5.5 * s) + 1):
            if ((xx + 0.5 - (hx - 0.5)) / (6 * s)) ** 2 + ((yy + 0.5 - (hy + 1)) / (6.2 * s)) ** 2 <= 1.0:
                head.set(xx, yy, OUT)
    p.px.update(head.px)
    return p, (hx - 0.5, hy + 1)


def eyes(hx, hy, s, look=0, squint=False, narrow=False, small=False):
    """Olhos em fenda, mais altos por fora e baixos junto ao centro (cara fechada, desconfiada)."""
    e = Part(outline=False)
    for side in (-1, 1):
        inner = round(hx + side * 1.5 + look)  # ponta de dentro (mais baixa)
        ey = round(hy + 1)
        if squint:  # "> <" de dor: ponta virada para o centro
            tip = inner + side
            for x, y in ((tip, ey - 1), (tip + side, ey - 2), (tip + side, ey), (tip + side * 2, ey - 3),
                         (tip + side * 2, ey + 1)):
                e.set(x, y, EYE)
            continue
        length = 2 if small else 4
        for k in range(length):
            x = inner + side * k
            y = ey - k // 2 - (1 if k == length - 1 and not small else 0)
            e.set(x, y, EYE)
            if not narrow and not small and 0 < k < length - 1:
                e.set(x, y + 1, EYE)
        if not small and not narrow:
            e.set(inner + side, ey, EYE_L)
    return e


def arms(cx, cy, s, n, point=0.0):
    """Braços finos e ossudos com garras. `point` 0..1 estica o braço da frente apontando."""
    a = Part()
    sway = math.sin(n * math.pi / 4) * 1.0
    # braço de trás (direita), pendurado, com garras
    pts = [(cx + 10 * s, cy - 2 * s), (cx + 14 * s, cy + 5 * s + sway), (cx + 13 * s, cy + 11 * s + sway)]
    a.line(pts, 1.6 * s, SH_D)
    tx, ty = pts[-1]
    for k in (-1, 0, 1):
        a.line([(tx, ty), (tx + k * 1.5, ty + 3 * s)], 1.0, SH_L)
    # braço da frente: pendurado → apontando
    sx, sy = cx - 10 * s, cy - 2 * s
    hang = [(sx, sy), (sx - 4 * s, sy + 7 * s + sway), (sx - 2 * s, sy + 13 * s + sway)]
    reach = [(sx, sy), (sx - 8 * s, sy - 3 * s), (sx - 15 * s, sy - 4 * s)]
    pts = [(h[0] + (r[0] - h[0]) * point, h[1] + (r[1] - h[1]) * point) for h, r in zip(hang, reach)]
    a.line(pts, 1.8 * s, SH_L)
    tx, ty = pts[-1]
    if point > 0.6:  # dedo comprido apontando, os outros dobrados
        a.line([(tx, ty), (tx - 6 * s, ty - 1)], 1.0, SH_LL)
        a.set(tx - 1, ty + 1.5, SH_L)
        a.set(tx, ty + 2, SH_L)
    else:
        for k in (-1, 0, 1):
            a.line([(tx, ty), (tx + k * 1.5, ty + 3 * s)], 1.0, SH_LL)
    return a


def mark(hx, hy, n, frames, glyph=QUESTION, scale=1, fixed=None):
    """O "?" em órbita (ou fixo). Devolve (atrás, frente)."""
    back, front = Part(), Part()
    if fixed:
        front.glyph(glyph, fixed[0], fixed[1], EYE, scale)
        if glyph is QUESTION:
            front.set(fixed[0] + scale, fixed[1], EYE_L)
        return back, front
    # meia órbita atrás do capuz (direita), sem cruzar o rosto
    ang = math.pi * (0.5 + 0.5 * math.sin(2 * math.pi * n / frames))  # oscila de 90° a 270°... reflete
    x = round(hx + 11 + 4 * math.cos(ang * 0.5))
    y = round(hy - 16 + 3 * math.sin(2 * math.pi * n / frames))
    back.glyph(glyph, x, y, EYE, scale)
    back.set(x + 1, y, EYE_L)
    return back, front


def shadow(cx, dy, s=1.0, w=10):
    p = Part(outline=False)
    p.ellipse(cx, 60.5, max(2, (w - dy) * s), 1.3, SHADOW)
    return p


def pose(n, frames, cx=33, cy=34, s=1.0, look=0, lean=0.0, stretch=1.0, point=0.0, bite=None,
         eyes_kw=None, mark_kw=None, flash=False, dy=0):
    cy = cy + dy
    torso, (hx, hy) = body(cx, cy, s, n, lean, stretch, bite)
    parts = [shadow(cx, dy, s)]
    mk = mark_kw if mark_kw is not None else {}
    back = front = None
    if mk is not False:
        back, front = mark(hx, hy, n, frames, **mk)
        parts.append(back)
    parts += [torso, arms(cx + lean * 0.6, cy, s, n, point)]
    g_parts = parts + [eyes(hx, hy, s, look, **(eyes_kw or {}))]
    if front:
        g_parts.append(front)
    g = compose(g_parts)
    if flash:  # clarão: silhueta branca, contorno mantido
        for y in range(H):
            for x in range(W):
                if g[y][x] in (SH_D, SH, SH_L, SH_LL):
                    g[y][x] = EYE_L
    return g, (hx, hy)


def particles(g, pts):
    for x, y, c in pts:
        x, y = round(x), round(y)
        if 0 <= x < W and 0 <= y < H:
            g[y][x] = c


# ─────────────────────────────────────────────────────────────
# Animações
# ─────────────────────────────────────────────────────────────
LOOK = [-1, -1, -1, 0, 1, 1, 1, 0]


def idle(n):
    dy = round(2 * math.sin(2 * math.pi * n / 8))
    g, _ = pose(n, 8, look=LOOK[n], dy=dy)
    if n == 5:
        dither(g, n)
    return g


def taunt(n):
    lean = [0, 2, -3, -4, -4, -4, -1, 0][n]
    stretch = [1, 1.08, 1, 1, 1, 1, 1, 1][n]
    point = [0, 0, 0.8, 1, 1, 1, 0.4, 0][n]
    holding = 3 <= n <= 5
    g, (hx, hy) = pose(n, 8, look=-1, lean=lean, stretch=stretch, point=point,
                       eyes_kw={"narrow": holding},
                       mark_kw={"glyph": QUESTION, "scale": 2, "fixed": (round(hx_guess(lean)) + 8, 2)}
                       if 2 <= n <= 5 else None)
    if holding:  # sussurro "..." ponto a ponto, à frente da cabeça
        for k in range(n - 2):
            x, y = hx - 11 - k * 3, hy - 6
            particles(g, [(x, y, EYE_L), (x + 1, y, EYE), (x, y + 1, EYE), (x + 1, y + 1, EYE)])
    return g


def hx_guess(lean):
    return 33 - 2 + lean


def hit(n):
    dx = [3, 3, 2, 1, 0, 0][n]
    bite = (47 + dx, 38, [0, 4.5, 5.5, 4, 2, 0][n]) if 1 <= n <= 4 else None
    g, _ = pose(n, 6, cx=33 + dx, look=0, flash=n == 0, bite=bite,
                eyes_kw={"squint": n in (0, 1, 2)}, mark_kw=False if n < 3 else None)
    if 1 <= n <= 3:  # pedaços de fumaça voando para a direita
        spread = n * 3
        pts = []
        for k in range(8 - n * 2):
            a = -0.9 + k * 0.28
            r = 5 + spread + k % 3
            x, y = 48 + dx + r * math.cos(a), 38 + r * math.sin(a)
            c = SH_LL if k % 2 else SH_L
            pts += [(x, y, c), (x + 1, y, c), (x, y + 1, c), (x + 1, y + 1, OUT)]
        particles(g, pts)
    return g


def weak(n):
    jit = 1 if n % 2 else -1
    g, (hx, hy) = pose(n, 8, cx=33 + jit, cy=38, s=0.8, look=0, eyes_kw={"small": True},
                       mark_kw={"glyph": BANG, "fixed": (round(hx_guess(0)) + 10, 10)} if n % 4 < 2 else False)
    dither(g, n, from_y=36)  # só a metade de baixo: ela está se desfazendo
    return g


def defeat_knockdown(n):
    """Derrota: a Sombra é derrubada e fica caída (ver knockdown.py)."""
    eyes = {"squint": {"squint": True}, "closed": {"narrow": True}, "normal": {}}

    def p(k, mode):
        g, _ = pose(k, KO_FRAMES, eyes_kw=eyes[mode], mark_kw=False)
        return g
    return knockdown(n, p, {
        "outline": OUT, "shadow": SHADOW, "eye_l": EYE_L, "gold": GOLD, "dust": [SH_LL, SH_L],
        "body": {SH_D, SH, SH_L, SH_LL}, "dim": {SH_LL: SH_L, SH_L: SH},
    })


ANIMS = {
    "idle": (idle, 8, 8, True),
    "taunt": (taunt, 8, 10, False),
    "hit": (hit, 6, 12, False),
    "weak": (weak, 8, 8, True),
    "defeat": (defeat_knockdown, KO_FRAMES, 10, False),
}

if __name__ == "__main__":
    root = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(root, "..", "..", "apps", "mobile", "assets", "sprites", "bosses")
    prev = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "out")
    for name, (fn, count, fps, loop) in ANIMS.items():
        frames = [grid_to_rgba(fn(n), PALETTE) for n in range(count)]
        write_color_sheet(frames, out, f"sombra_{name}", fps=fps, loop=loop)
        print(build_sheet(frames, prev, f"sombra_{name}", fps=fps, loop=loop, preview_scale=6))
        build_sheet(frames, prev, f"sombra_{name}_light", fps=fps, loop=loop, preview_scale=6,
                    bg=(236, 236, 240, 255))
