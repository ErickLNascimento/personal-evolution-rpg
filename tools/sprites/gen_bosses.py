"""Chefes da semana em pixel art 64x64 (cores fixas). A Sombra da Dúvida tem gerador próprio
(gen_boss_sombra.py); aqui ficam os outros cinco e as animações comuns.

Uso: python tools/sprites/gen_bosses.py [pasta_de_preview] [chefe ...]
Grava apps/mobile/assets/sprites/bosses/<chefe>_<estado>.png|json.

Cada chefe desenha o próprio corpo (`draw`) e as animações que mostram a personalidade
(`idle` em loop e `taunt`, a provocação). As outras três vêm de `draw` com opções comuns:
  hit (6, 12 fps): clarão branco e recuo, olhos "> <", lascas na cor do chefe voando.
  weak (8, 8 fps, loop): olhos cansados, tremor ±1 px, metade de baixo se desfazendo, "!" piscando.
  defeat (12, 10 fps): clarão, tremor, dissolve de baixo para cima em luz; uma estrela dourada
    nasce na marca do chefe e fica.
Frases (packages/domain/src/challenges.ts):
  golem     "Fique mais cinco minutos na cama..."   → boceja, cochila, "Z" sobe
  hidra     "Só mais um vídeo. E outro. E outro."    → 3 cabeças fora de sincronia, telinhas
  lich      "Amanhã é um dia melhor para começar."   → ampulheta escorre, vira, mão de "espera"
  dragao    "Você merece pular hoje."                → cochila; o fogo sai como fumaça
  basilisco "Olhe para mim. Só mais uma rolagem."    → rosto de tela rolando, anéis hipnóticos
"""
import math
import os
import sys

from sprite_tools import build_sheet, grid_to_rgba, hex_rgb, write_color_sheet

W = H = 64
OUT, D, M, L, LL, EYE, EYE_L, GOLD, SHADOW, A, A2, A3 = range(1, 13)
BODY = {D, M, L, LL, A, A2, A3}
KEEP = {EYE, EYE_L, GOLD}

Z_SMALL = ["###", "..#", ".#.", "###"]
Z_BIG = ["####", "...#", "..#.", ".#..", "####"]
BANG = ["#", "#", "#", "#", ".", "#"]


def palette(out, d, m, l, ll, eye, eye_l, a, a2, a3, gold="#FFD45A"):
    cols = [out, d, m, l, ll, eye, eye_l, gold]
    return ([(0, 0, 0, 0)] + [(*hex_rgb(h), 255) for h in cols] + [(0, 0, 0, 70)]
            + [(*hex_rgb(h), 255) for h in (a, a2, a3)])


def noise(x, y, n=0):
    v = (int(x) * 73856093) ^ (int(y) * 19349663) ^ (n * 83492791)
    return ((v * 2654435761) & 0xFFFF) / 65536.0


class Part:
    def __init__(self, outline=True):
        self.px = {}
        self.outline = outline

    def set(self, x, y, i):
        x, y = round(x), round(y)
        if 0 <= x < W and 0 <= y < H:
            self.px[(x, y)] = i

    def blob(self, cx, cy, rx, ry, ramp=(D, M, L, LL), texture=0.0, n=0, light=(-0.6, -0.8)):
        """Elipse com volume: luz de cima à esquerda, rampa de 4 tons."""
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                u, v = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                r2 = u * u + v * v
                if r2 > 1.0:
                    continue
                k = light[0] * u + light[1] * v + 0.25 * (1 - r2)
                if texture and noise(x, y) < texture:
                    k -= 0.45
                i = ramp[3] if k > 0.62 else ramp[2] if k > 0.18 else ramp[1] if k > -0.4 else ramp[0]
                self.set(x, y, i)

    def disc(self, cx, cy, rx, ry, i):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0:
                    self.set(x, y, i)

    def rect(self, x0, y0, x1, y1, i):
        for y in range(round(y0), round(y1) + 1):
            for x in range(round(x0), round(x1) + 1):
                self.set(x, y, i)

    def tube(self, pts, r0, r1, ramp=(D, M, L, LL)):
        """Pescoço/cauda/braço: círculos ao longo do caminho, sombreados pelo lado do tubo
        (luz no lado de cima), para parecer um cilindro contínuo e não contas de um colar."""
        for _ in range(3):  # suaviza o caminho (Chaikin): sem "gomos" nas curvas
            sm = [pts[0]]
            for (ax, ay), (bx, by) in zip(pts, pts[1:]):
                sm += [(0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by), (0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by)]
            pts = sm + [pts[-1]]
        total = len(pts) - 1
        for idx, ((x0, y0), (x1, y1)) in enumerate(zip(pts, pts[1:])):
            seg = math.hypot(x1 - x0, y1 - y0) or 1.0
            tx, ty = (x1 - x0) / seg, (y1 - y0) / seg
            nx, ny = -ty, tx
            if ny > 0 or (ny == 0 and nx > 0):
                nx, ny = -nx, -ny  # normal apontando para cima/esquerda (lado iluminado)
            steps = max(2, int(seg * 1.5))
            for k in range(steps + 1):
                t = (idx + k / steps) / total
                x, y = x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps
                r = max(0.8, r0 + (r1 - r0) * t)
                for yy in range(int(y - r) - 1, int(y + r) + 2):
                    for xx in range(int(x - r) - 1, int(x + r) + 2):
                        dx, dy = xx + 0.5 - x, yy + 0.5 - y
                        if dx * dx + dy * dy > r * r:
                            continue
                        kk = (dx * nx + dy * ny) / r
                        i = ramp[3] if kk > 0.6 else ramp[2] if kk > 0.1 else ramp[1] if kk > -0.55 else ramp[0]
                        self.set(xx, yy, i)

    def line(self, pts, width, i):
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            steps = max(1, int(max(abs(x1 - x0), abs(y1 - y0)) * 2))
            for k in range(steps + 1):
                x, y = x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps
                r = width / 2
                for yy in range(int(y - r), int(y + r) + 1):
                    for xx in range(int(x - r), int(x + r) + 1):
                        self.set(xx, yy, i)

    def glyph(self, rows, x0, y0, color):
        x0, y0 = round(x0), round(y0)
        for gy, row in enumerate(rows):
            for gx, ch in enumerate(row):
                if ch == "#":
                    self.set(x0 + gx, y0 + gy, color)


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


def shadow(cx, w, y=60.5):
    p = Part(outline=False)
    p.disc(cx, y, w, 1.4, SHADOW)
    return p


def eyes_pair(p, pts, mode, color=EYE, length=3):
    """Olhos simples: `normal` (fenda 2 px), `tired` (linha caída), `closed`, `squint` ("> <"), `wide`."""
    for side, (x, y) in zip((-1, 1), pts):
        x, y = round(x), round(y)
        if mode == "squint":
            for dx, dy in ((0, 0), (side, -1), (side, 1)):
                p.set(x - side + dx, y + dy, color)
        elif mode == "closed":
            for k in range(length):
                p.set(x - length // 2 + k, y, D)
        elif mode == "tired":
            for k in range(length):
                p.set(x - length // 2 + k, y + (1 if (k == 0 and side < 0) or (k == length - 1 and side > 0) else 0), color)
        elif mode == "wide":
            p.rect(x - 1, y - 1, x, y, color)
            p.set(x - 1, y - 1, EYE_L)
        else:
            for k in range(length):
                p.set(x - length // 2 + k, y, color)
                if k == length // 2:
                    p.set(x - length // 2 + k, y - 1, color)
            p.set(x - length // 2, y - 0, EYE_L)


def particles(g, pts):
    for x, y, c in pts:
        x, y = round(x), round(y)
        if 0 <= x < W and 0 <= y < H:
            g[y][x] = c


def overlay(g, part):
    sg = compose([part])
    for y in range(H):
        for x in range(W):
            if sg[y][x]:
                g[y][x] = sg[y][x]


def star(x, y, big):
    s = Part()
    s.set(x, y, EYE_L)
    r = 3 if big else 2
    for k in range(1, r + 1):
        for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)):
            s.set(x + dx, y + dy, GOLD)
    for dx, dy in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
        s.set(x + dx, y + dy, GOLD)
    return s


# ─────────────────────────────────────────────────────────────
# Animações comuns
# ─────────────────────────────────────────────────────────────
def common_hit(boss, n):
    dx = [3, 3, 2, 1, 0, 0][n]
    parts, an = boss.draw(n, 6, {"dx": dx, "eyes": "squint" if n < 3 else "normal", "calm": True})
    g = compose(parts)
    if n == 0:
        for y in range(H):
            for x in range(W):
                if g[y][x] in BODY:
                    g[y][x] = EYE_L
    if 1 <= n <= 3:
        cx, cy = an["chest"]
        pts = []
        for k in range(8 - n * 2):
            a = -0.9 + k * 0.28
            r = 5 + n * 3 + k % 3
            x, y = cx + dx + r * math.cos(a), cy + r * math.sin(a)
            c = L if k % 2 else M
            pts += [(x, y, c), (x + 1, y, c), (x, y + 1, c), (x + 1, y + 1, OUT)]
        particles(g, pts)
    return g


def common_weak(boss, n):
    jit = 1 if n % 2 else -1
    parts, an = boss.draw(n, 8, {"dx": jit, "eyes": "tired", "calm": True, "weak": True})
    g = compose(parts)
    for y in range(an["waist"], H):
        for x in range(W):
            if g[y][x] and g[y][x] not in KEEP and g[y][x] != SHADOW and (x + y + n) % 2 == 0:
                g[y][x] = 0
    if n % 4 < 2:
        b = Part()
        b.glyph(BANG, an["mark"][0], an["mark"][1], EYE)
        overlay(g, b)
    return g


def common_defeat(boss, n):
    mx, my = an_mark = boss.draw(0, 12, {})[1]["mark"]
    if n <= 2:
        parts, _ = boss.draw(n, 12, {"dx": [0, 1, -1][n], "eyes": "squint", "calm": True})
        g = compose(parts)
        if n == 0:
            for y in range(H):
                for x in range(W):
                    if g[y][x] in BODY:
                        g[y][x] = EYE_L
        overlay(g, star(mx + 2, my + 3, False) if False else Part())
        return g
    cut = 64 - (n - 2) * 7
    if n <= 8:
        parts, _ = boss.draw(n, 12, {"eyes": "squint", "calm": True})
        g = compose(parts)
        for y in range(max(cut, 0), H):
            for x in range(W):
                if g[y][x] and g[y][x] != SHADOW:
                    g[y][x] = 0
    else:
        g = [[0] * W for _ in range(H)]
    pts = []
    for k in range(14):
        x = 14 + (k * 37) % 36
        rise = (n * 5 + k * 7) % 18
        y = min(cut, 58) - rise
        if 0 < y < 60 and (k + n) % 3 != 0:
            pts.append((x, y, [EYE_L, EYE, GOLD][k % 3]))
    if n >= 9:
        pts = [p for i, p in enumerate(pts) if i % (n - 7) == 0]
    particles(g, pts)
    if n >= 5:
        t = (n - 5) / 6
        overlay(g, star(round(mx + (32 - mx) * t), round(my + (10 - my) * t), n % 2 == 0))
    return g


# ─────────────────────────────────────────────────────────────
# Golem da Preguiça
# ─────────────────────────────────────────────────────────────
class Golem:
    id = "golem"
    PAL = palette("#1A1410", "#4A3B2E", "#6E5A45", "#A58B6F", "#C9B08F", "#FFB347", "#FFE2A8",
                  "#4F7A3E", "#7FAE5E", "#2B2119")

    def draw(self, n, frames, o):
        dx, dy = o.get("dx", 0), o.get("dy", 0)
        breath = o.get("breath", 0)
        yawn = o.get("yawn", 0.0)      # 0..1 boca aberta
        arms_up = o.get("arms_up", 0.0)
        nod = o.get("nod", 0)
        cx = 32 + dx
        parts = [shadow(cx, 17)]
        # pernas
        legs = Part()
        for lx in (cx - 8, cx + 8):
            legs.blob(lx, 54 + dy, 5.5, 4.5, texture=0.12)
        parts.append(legs)
        # braços (atrás do tronco quando erguidos)
        arms = Part()
        for side in (-1, 1):
            sx, sy = cx + side * 14, 33 + dy
            hang = (cx + side * 18, 47 + dy)
            up = (cx + side * 12, 12 + dy)
            hx = hang[0] + (up[0] - hang[0]) * arms_up
            hy = hang[1] + (up[1] - hang[1]) * arms_up
            arms.tube([(sx, sy), ((sx + hx) / 2 + side * 3, (sy + hy) / 2), (hx, hy)], 4.5, 5.0)
            arms.blob(hx, hy + 2 * (1 - arms_up), 5.5, 4.5, texture=0.15)
        if arms_up > 0.5:
            parts.append(arms)
        # tronco: pedregulho corcunda
        torso = Part()
        torso.blob(cx, 39 + dy - breath * 0.5, 16, 13 + breath * 0.5, texture=0.12)
        for x, y in ((cx - 6, 34), (cx + 5, 42), (cx - 2, 46), (cx + 9, 33)):  # rachaduras
            torso.set(x, y + dy, D)
            torso.set(x + 1, y + 1 + dy, D)
        parts.append(torso)
        if arms_up <= 0.5:
            parts.append(arms)
        # cabeça pequena, caída para a frente
        hx, hy = cx - 1, 24 + dy + nod - yawn * 2
        head = Part()
        head.blob(hx, hy, 9, 7.5, texture=0.1)
        # musgo no topo
        for x in range(int(hx - 7), int(hx + 8)):
            top = hy - 7.5 * math.sqrt(max(0.0, 1 - ((x - hx) / 9) ** 2))
            for k in range(2 + int(noise(x, 3) * 2)):
                head.set(x, top + k, A2 if k == 0 else A)
        parts.append(head)
        face = Part(outline=False)
        mode = o.get("eyes", "tired")
        eyes_pair(face, [(hx - 3.5, hy + 0.5), (hx + 3.5, hy + 0.5)], mode)
        if mode in ("tired", "closed"):  # pálpebra pesada
            for ex in (hx - 3.5, hx + 3.5):
                face.rect(ex - 1.5, hy - 1, ex + 1.5, hy - 1, D)
        if yawn > 0:
            face.disc(hx, hy + 4.5, 2 + 2.5 * yawn, 1 + 2.5 * yawn, OUT)
            face.disc(hx, hy + 4.5 + yawn * 1.2, 1 + 1.4 * yawn, 0.6 + 1 * yawn, A3)
        parts.append(face)
        return parts, {"head": (hx, hy), "mark": (hx + 10, 6), "chest": (cx + 12, 38), "waist": 44}

    def idle(self, n):
        breath = [0, 1, 1, 0, 0, 1, 1, 0][n]
        eyes = "closed" if 4 <= n <= 6 else "tired"
        parts, an = self.draw(n, 8, {"breath": breath, "eyes": eyes, "nod": 1 if n in (5, 6) else 0})
        g = compose(parts)
        z = Part()  # "Z" subindo
        for k in range(2):
            t = ((n + k * 4) % 8) / 8
            x = an["head"][0] + 9 + t * 6
            y = an["head"][1] - 6 - t * 14
            z.glyph(Z_SMALL if t < 0.5 else Z_BIG, x, y, EYE_L if t < 0.7 else LL)
        overlay(g, z)
        return g

    def taunt(self, n):
        yawn = [0, 0.2, 0.7, 1, 1, 0.6, 0.1, 0][n]
        arms_up = [0, 0.3, 0.8, 1, 1, 0.5, 0, 0][n]
        dy = [0, -1, -2, -2, -2, 0, 1, 0][n]
        parts, an = self.draw(n, 8, {"yawn": yawn, "arms_up": arms_up, "dy": dy,
                                     "eyes": "closed" if 2 <= n <= 5 else "tired"})
        g = compose(parts)
        if 2 <= n <= 6:
            z = Part()
            z.glyph(Z_BIG, an["head"][0] + 11, an["head"][1] - 12 - (n - 2), EYE_L)
            z.glyph(Z_SMALL, an["head"][0] + 17, an["head"][1] - 18 - (n - 2), LL)
            overlay(g, z)
        return g


# ─────────────────────────────────────────────────────────────
# Hidra da Distração
# ─────────────────────────────────────────────────────────────
class Hidra:
    id = "hidra"
    PAL = palette("#0A1F1A", "#0E5A45", "#16C79A", "#5FE0B8", "#A8F5DA", "#FF5D8F", "#FFFFFF",
                  "#E8D48A", "#9EE7FF", "#1B2430")

    def draw(self, n, frames, o):
        dx = o.get("dx", 0)
        cx = 32 + dx
        lean = o.get("lean", 0.0)  # 0..1 cabeças viram para a frente (esquerda)
        calm = o.get("calm", False)
        parts = [shadow(cx, 19)]
        tail = Part()
        wag = 0 if calm else math.sin(2 * math.pi * n / frames) * 1.5
        tail.tube([(cx + 12, 52), (cx + 21, 54), (cx + 26, 49 + wag), (cx + 24, 44 + wag)], 3.6, 1.0)
        parts.append(tail)
        base = Part()
        base.blob(cx - 1, 51, 15, 7.5)
        base.blob(cx, 44, 11, 7)
        for k in range(5):  # placas da barriga
            base.set(cx - 4 + k * 2, 50 - abs(k - 2), A)
        parts.append(base)
        heads = []
        specs = [(-1, 0.0, -11, 20), (0, 2.1, 0, 12), (1, 4.2, 11, 20)]
        for side, ph, ox, oy in specs:
            bob = 0 if calm else 2 * math.sin(2 * math.pi * n / frames + ph)
            sway = 0 if calm else 2 * math.sin(2 * math.pi * n / frames * 2 + ph)
            hx = cx + ox + sway - lean * (8 + ox * 0.4)
            hy = oy + bob - lean * 2
            root = (cx + ox * 0.45, 42)
            mid = ((root[0] + hx) / 2 + side * 4, (root[1] + hy) / 2 + 2)
            neck = Part()
            neck.tube([root, mid, (hx, hy + 3)], 3.4, 2.4)
            parts.append(neck)
            # cada cabeça olha para um lado (fora de sincronia)
            look = o.get("look") if o.get("look") is not None else (-1 if math.sin(2 * math.pi * n / frames + ph * 1.7) < 0 else 1)
            head = Part()
            head.blob(hx, hy, 6, 4.6)
            head.blob(hx + look * 5, hy + 1.5, 3.6, 2.6)  # focinho comprido
            for k in range(4):  # crista em espinhos
                head.set(hx - look * (1 + k * 1.5), hy - 5 - (k % 2), D)
                head.set(hx - look * (1 + k * 1.5), hy - 4, M)
            heads.append((head, hx, hy, look))
        for head, hx, hy, look in heads:
            parts.append(head)
            f = Part(outline=False)
            ex = round(hx + look * 1.5)
            mode = o.get("eyes", "normal")
            if mode == "squint":
                f.set(ex, hy - 1, EYE)
                f.set(ex + look, hy, EYE)
                f.set(ex, hy + 1, EYE)
            elif mode == "tired":
                f.rect(ex - 1, hy, ex, hy, EYE)
            else:  # olho em fenda, inclinado para a frente (cara de malvado)
                f.set(ex, hy - 1, EYE)
                f.set(ex + look, hy, EYE)
                f.set(ex - look, hy - 2, D)
                f.set(ex, hy - 2, D)
            f.rect(hx + look * 3, hy + 3, hx + look * 8, hy + 3, OUT)  # boca
            f.set(hx + look * 4, hy + 4, EYE_L)  # presas
            f.set(hx + look * 7, hy + 4, EYE_L)
            parts.append(f)
        self._heads = [(hx, hy, look) for _, hx, hy, look in heads]
        return parts, {"head": (cx, 12), "mark": (cx + 15, 4), "chest": (cx + 13, 45), "waist": 44}

    def idle(self, n):
        parts, _ = self.draw(n, 8, {})
        return compose(parts)

    def taunt(self, n):
        lean = [0, 0.3, 0.8, 1, 1, 1, 0.5, 0][n]
        parts, _ = self.draw(n, 8, {"lean": lean, "look": -1, "calm": 2 <= n <= 5})
        g = compose(parts)
        # "só mais um vídeo. e outro. e outro.": uma telinha sai de cada boca, uma por vez
        shown = [i for i in range(3) if 2 + i <= n <= 6]
        for i in shown:
            hx, hy, _ = self._heads[i]
            sx, sy = round(hx - 12 - (n - 2 - i)), round(hy - 2)
            s = Part()
            s.rect(sx, sy, sx + 6, sy + 4, A3)
            s.rect(sx + 1, sy + 1, sx + 5, sy + 3, A2)
            s.set(sx + 3, sy + 2, EYE_L)  # "play"
            s.set(sx + 3, sy + 1, EYE_L)
            s.set(sx + 4, sy + 2, EYE_L)
            s.set(sx + 3, sy + 3, EYE_L)
            overlay(g, s)
        return g


# ─────────────────────────────────────────────────────────────
# Lich da Procrastinação
# ─────────────────────────────────────────────────────────────
class Lich:
    id = "lich"
    PAL = palette("#120A1F", "#2B1650", "#4B2A8A", "#8B5CF6", "#B9A0FF", "#7CFFB2", "#E8FFF2",
                  "#E8E0CC", "#A89F8A", "#F5C26B")

    def hourglass(self, x, y, angle, sand):
        """Ampulheta 7x11 girada em passos de 0/45/90/180 graus; `sand` 0..1 = areia em cima."""
        p = Part()
        pts = []
        for yy in range(-5, 6):
            half = 3 - min(abs(yy), 5) * 0 if abs(yy) == 5 else max(1, abs(yy) * 0.6)
            for xx in range(-3, 4):
                if abs(yy) == 5:
                    pts.append((xx, yy, GOLD))
                elif abs(xx) <= half:
                    top = yy < 0
                    fill = (top and -yy <= 4 * sand + 0.2) or (not top and yy >= 5 - 4 * (1 - sand))
                    pts.append((xx, yy, A3 if fill else A2 if abs(xx) == round(half) else OUT))
        ca, sa = math.cos(angle), math.sin(angle)
        for xx, yy, c in pts:
            p.set(x + xx * ca - yy * sa, y + xx * sa + yy * ca, c)
        return p

    def draw(self, n, frames, o):
        dx = o.get("dx", 0)
        dy = o.get("dy", round(1.5 * math.sin(2 * math.pi * n / frames))) if not o.get("calm") else o.get("dy", 0)
        cx = 30 + dx
        parts = [shadow(cx + 2, 11)]
        robe = Part()
        for y in range(26, 56):
            t = (y - 26) / 30
            half = 7 + 9 * t
            for x in range(int(cx - half), int(cx + half) + 1):
                if y > 52 and noise(x, y, n) < 0.45:
                    continue
                rel = x - cx
                robe.set(x, y + dy, L if rel < -half * 0.45 else D if rel > half * 0.4 else M)
        for y in range(28, 54, 3):  # faixa bordada
            robe.set(cx, y + dy, GOLD)
        parts.append(robe)
        # gola alta em pontas atrás do crânio
        hx, hy = cx, 20 + dy
        collar = Part()
        for k, h in ((-9, 9), (-6, 12), (6, 12), (9, 9)):
            collar.line([(hx + k * 0.8, hy + 7), (hx + k, hy + 7 - h)], 2.2, D if k > 0 else M)
        parts.append(collar)
        head = Part()
        head.blob(hx, hy, 6.5, 6.5, ramp=(A2, A2, A, A))
        parts.append(head)
        crown = Part()
        for k, h in zip(range(-5, 6, 2), (3, 2, 4, 2, 3, 2)):
            crown.rect(hx + k, hy - 6 - h, hx + k, hy - 6, GOLD)
        crown.rect(hx - 6, hy - 6, hx + 6, hy - 6, GOLD)
        parts.append(crown)
        face = Part(outline=False)
        mode = o.get("eyes", "normal")
        for ex in (hx - 2.5, hx + 2.5):
            face.disc(ex, hy, 1.8, 1.8, OUT)
        if mode == "squint":
            eyes_pair(face, [(hx - 2.5, hy), (hx + 2.5, hy)], "squint")
        elif mode != "tired":
            for ex in (hx - 2.5, hx + 2.5):
                face.rect(ex - 0.5, hy - 0.5, ex + 0.5, hy + 0.5, EYE)
                if n % 4 < 2:
                    face.set(ex - 0.5, hy - 0.5, EYE_L)
        else:
            for ex in (hx - 2.5, hx + 2.5):
                face.set(ex, hy + 1, EYE)
        jaw = o.get("jaw", 0)
        face.rect(hx - 2, hy + 4 + jaw, hx + 2, hy + 4 + jaw, OUT)
        for k in (-2, 0, 2):
            face.set(hx + k, hy + 3 + jaw, A)
        parts.append(face)
        # mão esquerda (espalmada na provocação) e cajado-ampulheta à direita
        hand = Part()
        palm = o.get("palm", 0.0)
        hx0, hy0 = cx - 9, 34 + dy
        tip = (cx - 13 - 4 * palm, 40 + dy - 14 * palm)
        hand.line([(hx0, hy0), tip], 2.4, M)
        hand.disc(tip[0], tip[1], 2.2, 2.2, A)
        if palm > 0.5:
            for k in range(-2, 3):
                hand.line([(tip[0] + k * 0.9, tip[1]), (tip[0] + k * 1.1, tip[1] - 3.5)], 1, A)
        parts.append(hand)
        staff = Part()
        sx = cx + 15
        staff.line([(sx, 26 + dy), (sx, 58)], 1.6, A2)
        staff.line([(cx + 8, 36 + dy), (sx, 38 + dy)], 2.4, M)  # braço segurando
        parts.append(staff)
        parts.append(self.hourglass(sx, 19 + dy, o.get("angle", 0.0), o.get("sand", (1 - (n % frames) / frames))))
        return parts, {"head": (hx, hy), "mark": (sx + 4, 4), "chest": (cx + 10, 40), "waist": 44}

    def idle(self, n):
        parts, _ = self.draw(n, 8, {"sand": 1 - n / 8})
        return compose(parts)

    def taunt(self, n):
        angle = [0, 0, math.pi / 4, math.pi / 2, math.pi, math.pi, math.pi, math.pi][n]
        palm = [0, 0, 0, 0.5, 1, 1, 0.6, 0][n]
        sand = 0.1 if n < 4 else 0.9  # depois de virar, a areia volta para cima
        parts, _ = self.draw(n, 8, {"angle": angle, "palm": palm, "sand": sand,
                                    "jaw": 1 if 4 <= n <= 5 else 0, "calm": True})
        g = compose(parts)
        if n == 7:  # já de pé de novo para emendar na parada
            parts, _ = self.draw(0, 8, {"sand": 1.0})
            g = compose(parts)
        return g


# ─────────────────────────────────────────────────────────────
# Dragão do Cansaço
# ─────────────────────────────────────────────────────────────
class Dragao:
    id = "dragao"
    PAL = palette("#1F0A10", "#7A1E35", "#C23A57", "#F2617A", "#FF9DB0", "#FFD45A", "#FFF4C2",
                  "#F7C98B", "#9C2A45", "#B8B0B8")

    def draw(self, n, frames, o):
        dx = o.get("dx", 0)
        cx = 36 + dx
        breath = o.get("breath", 0)
        droop = o.get("droop", 0)     # cabeça caindo de sono
        reach = o.get("reach", 0.0)   # cabeça para a frente (sopro)
        back = o.get("back", 0.0)     # cabeça para trás (inspirar)
        parts = [shadow(cx - 2, 20)]
        tail = Part()
        tail.tube([(cx + 10, 52), (cx + 20, 55), (cx + 26, 50), (cx + 25, 45)], 3.2, 1.2)
        parts.append(tail)
        wing = Part()  # asa caída nas costas
        for k in range(14):
            for j in range(int(10 - k * 0.6)):
                wing.set(cx + 4 + k, 30 + k * 0.9 + j, A2 if j > 1 else M)
        for k in range(0, 14, 4):
            wing.line([(cx + 4, 30), (cx + 4 + k, 30 + k * 0.9 + 9 - k * 0.6)], 1, D)
        parts.append(wing)
        body = Part()
        body.blob(cx, 45 - breath * 0.5, 13, 10 + breath * 0.5)
        for y in range(40, 54, 2):  # barriga
            body.rect(cx - 9 + (y - 40) * 0.2, y, cx - 5 + (y - 40) * 0.1, y, A)
        parts.append(body)
        legs = Part()
        for lx in (cx - 7, cx + 6):
            legs.blob(lx, 55, 4, 3)
            for k in (-2, 0, 2):
                legs.set(lx + k - 1, 58, A)
        parts.append(legs)
        # pescoço e cabeça (virada para a esquerda)
        hx = cx - 17 - reach * 2 + back * 5
        hy = 26 + droop * 1.0 - back * 3 + reach * 2
        neck = Part()
        neck_pts = [(cx - 4, 42), (cx - 11, 35 + droop * 0.5), (hx + 3, hy + 2)]
        neck.tube(neck_pts, 5.2, 4.0)
        parts.append(neck)
        spikes = Part()  # espinhos nas costas e no pescoço
        for k, (sx, sy) in enumerate(((cx - 9, 32 + droop * 0.4), (cx - 5, 34), (cx + 1, 35), (cx + 7, 36), (cx + 12, 40))):
            spikes.line([(sx - 1.5, sy + 1), (sx + 0.5, sy - 3 - (k % 2)), (sx + 2, sy + 1)], 1.2, D)
        parts.insert(len(parts) - 1, spikes)
        head = Part()
        head.blob(hx, hy, 7, 5.5)
        head.blob(hx - 6, hy + 1.5, 5, 3.6)  # focinho
        head.line([(hx + 3, hy - 4), (hx + 9, hy - 6 + droop * 0.6)], 1.8, A)  # chifres caídos
        head.line([(hx + 1, hy - 5), (hx + 6, hy - 8 + droop * 0.6)], 1.4, A)
        parts.append(head)
        face = Part(outline=False)
        mode = o.get("eyes", "tired")
        ex, ey = round(hx), round(hy - 1)
        if mode == "squint":
            face.set(ex - 1, ey - 1, EYE)
            face.set(ex, ey, EYE)
            face.set(ex - 1, ey + 1, EYE)
        elif mode == "closed":
            face.rect(ex - 1, ey, ex + 1, ey, D)
        else:
            face.rect(ex - 1, ey, ex + 1, ey, EYE)
            face.rect(ex - 1, ey - 1, ex + 1, ey - 1, D)  # pálpebra pesada
        face.rect(ex - 2, ey - 2, ex + 2, ey - 2, D)  # sobrancelha
        face.set(hx - 10, hy + 1, OUT)  # narina
        if o.get("mouth", 0):
            face.rect(hx - 8, hy + 3, hx - 3, hy + 3 + o["mouth"], OUT)
        parts.append(face)
        self._nose = (hx - 11, hy + 1)
        return parts, {"head": (hx, hy), "mark": (hx + 12, 6), "chest": (cx + 10, 44), "waist": 44}

    def puff(self, x, y, r):
        p = Part()
        for ox, oy, k in ((-0.55, 0.15, 0.62), (0.5, 0.2, 0.58), (0, -0.3, 0.7)):  # nuvem em 3 bolos
            p.disc(x + ox * r, y + oy * r, r * k, r * k * 0.85, A3)
        p.disc(x - r * 0.25, y - r * 0.45, r * 0.3, r * 0.22, EYE_L)
        return p

    def idle(self, n):
        breath = [0, 1, 1, 0, 0, 1, 1, 0][n]
        droop = [0, 1, 2, 3, 4, 5, 0, 0][n]  # cochila e acorda de susto
        parts, _ = self.draw(n, 8, {"breath": breath, "droop": droop, "eyes": "closed" if 3 <= n <= 5 else "tired"})
        g = compose(parts)
        if n in (1, 2, 3):  # fumacinha do nariz
            nx, ny = self._nose
            overlay(g, self.puff(nx - (n - 1) * 2, ny - 3 - (n - 1) * 3, 1.6 + n * 0.6))
        return g

    def taunt(self, n):
        back = [0, 0.6, 1, 0, 0, 0, 0, 0][n]
        reach = [0, 0, 0, 1, 1, 1, 0.4, 0][n]
        breath = [0, 1, 2, 0, 0, 0, 0, 0][n]
        parts, _ = self.draw(n, 8, {"back": back, "reach": reach, "breath": breath,
                                    "mouth": 2 if 3 <= n <= 5 else 0,
                                    "eyes": "normal" if n in (1, 2, 3) else "tired",
                                    "droop": 3 if n == 6 else 0})
        g = compose(parts)
        nx, ny = self._nose
        if 3 <= n <= 6:  # em vez de fogo, uma nuvem de fumaça com uma faísca que se apaga
            r = [0, 0, 0, 3, 4.5, 6, 5][n]
            # a nuvem sai da boca e sobe devagar, como um suspiro
            px, py = max(r + 1, nx + 1 - (n - 3)), ny - 2 - (n - 3) * 4
            overlay(g, self.puff(px, py, r))
            if n in (3, 4):
                particles(g, [(nx + 2, ny + 3, GOLD), (nx + 1, ny + 2, EYE)])
        return g


# ─────────────────────────────────────────────────────────────
# Basilisco da Tela
# ─────────────────────────────────────────────────────────────
class Basilisco:
    id = "basilisco"
    PAL = palette("#1A1405", "#7A5A12", "#C9952A", "#F5B942", "#FFE08A", "#9EE7FF", "#FFFFFF",
                  "#1B1B26", "#3FA9F5", "#F2E3B3")

    def draw(self, n, frames, o):
        dx = o.get("dx", 0)
        cx = 32 + dx
        rise = o.get("rise", 0.0)
        calm = o.get("calm", False)
        sway = 0 if calm else 4 * math.sin(2 * math.pi * n / frames)
        parts = [shadow(cx, 18)]
        coils = Part()
        coils.blob(cx, 53, 18, 6)
        coils.blob(cx - 2, 47, 14, 5)
        coils.blob(cx + 1, 42, 10, 4.5)
        for x in range(int(cx - 14), int(cx + 15), 4):  # escamas em losango
            coils.set(x, 53, A3)
            coils.set(x + 2, 47, A3)
        parts.append(coils)
        hx = cx + sway - 2
        hy = 18 - rise * 6
        neck = Part()
        neck.tube([(cx + 2, 40), (cx - 3 + sway * 0.3, 32 - rise * 2), (cx + 3 + sway * 0.7, 26 - rise * 4),
                   (hx, hy + 5)], 4, 3.2)
        parts.append(neck)
        hood = Part()  # capuz de naja atrás da cabeça
        hood.blob(hx, hy + 2, 11 + rise * 2, 9, ramp=(D, D, M, L))
        for sx in (-7, 7):  # manchas em olho
            hood.disc(hx + sx * (1 + rise * 0.15), hy + 3, 1.6, 2, OUT)
            hood.set(hx + sx * (1 + rise * 0.15), hy + 3, EYE)
        parts.append(hood)
        head = Part()
        head.rect(hx - 5, hy - 4, hx + 5, hy + 5, A)  # moldura da tela
        parts.append(head)
        scr = Part(outline=False)
        scr.rect(hx - 4, hy - 3, hx + 4, hy + 4, A2)
        mode = o.get("eyes", "normal")
        if mode in ("squint", "tired"):
            eyes_pair(scr, [(hx - 2, hy), (hx + 2, hy)], "squint" if mode == "squint" else "tired", EYE_L, 2)
        else:
            # conteúdo rolando (linhas que sobem) e dois olhos hipnóticos
            for k in range(4):
                ly = hy - 3 + ((k * 2 + (0 if calm else n)) % 8)
                if hy - 3 <= ly <= hy + 4:
                    scr.rect(hx - 3, ly, hx + (1 if k % 2 else 3), ly, EYE)
            for ex in (hx - 2, hx + 2):
                scr.set(ex, hy, EYE_L)
                scr.set(ex, hy + 1, OUT)
        parts.append(scr)
        fangs = Part(outline=False)
        for fx in (hx - 3, hx + 3):
            fangs.set(fx, hy + 6, EYE_L)
            fangs.set(fx, hy + 7, EYE_L)
        parts.append(fangs)
        self._screen = (hx, hy)
        return parts, {"head": (hx, hy), "mark": (hx + 11, 2), "chest": (cx + 12, 47), "waist": 44}

    def idle(self, n):
        parts, _ = self.draw(n, 8, {})
        return compose(parts)

    def taunt(self, n):
        rise = [0, 0.5, 1, 1, 1, 1, 0.5, 0][n]
        parts, _ = self.draw(n, 8, {"rise": rise, "calm": True})
        g = compose(parts)
        hx, hy = self._screen
        if 2 <= n <= 6:  # anéis hipnóticos saindo da tela
            ring = Part(outline=False)
            for r in ((n - 1) * 5, (n - 1) * 5 - 7):
                if r <= 4:
                    continue
                for k in range(36):
                    a = 2 * math.pi * k / 36
                    if (k + n) % 3:
                        ring.set(hx + r * math.cos(a), hy + 0.7 * r * math.sin(a), EYE if r % 2 else EYE_L)
            overlay(g, ring)
        return g


BOSSES = {b.id: b for b in (Golem(), Hidra(), Lich(), Dragao(), Basilisco())}
ANIMS = {
    "idle": ("idle", 8, 8, True),
    "taunt": ("taunt", 8, 10, False),
    "hit": (common_hit, 6, 12, False),
    "weak": (common_weak, 8, 8, True),
    "defeat": (common_defeat, 12, 10, False),
}

if __name__ == "__main__":
    root = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(root, "..", "..", "apps", "mobile", "assets", "sprites", "bosses")
    prev = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "out")
    only = set(sys.argv[2:])
    for boss in BOSSES.values():
        if only and boss.id not in only:
            continue
        for name, (fn, count, fps, loop) in ANIMS.items():
            make = getattr(boss, fn) if isinstance(fn, str) else (lambda n, f=fn, b=boss: f(b, n))
            frames = [grid_to_rgba(make(n), boss.PAL) for n in range(count)]
            write_color_sheet(frames, out, f"{boss.id}_{name}", fps=fps, loop=loop)
            build_sheet(frames, prev, f"{boss.id}_{name}", fps=fps, loop=loop, preview_scale=5)
        print(boss.id, "ok")
