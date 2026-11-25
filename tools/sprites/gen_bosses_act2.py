"""Chefes do Ato II em pixel art 64x64 (mesmo traço e animações comuns de gen_bosses.py).

Uso: python tools/sprites/gen_bosses_act2.py [pasta_de_preview] [--preview-only]
Grava apps/mobile/assets/sprites/bosses/<chefe>_<estado>.png|json.

  kraken    Kraken do Perfeccionismo  "Só começa quando estiver perfeito."  → tentáculos ondulam; lupa
  quimera   Quimera da Comparação     "A vida dele está bem melhor, né?"    → duas cabeças se comparam
  banshee   Banshee da Culpa          "Você devia ter feito ontem."          → flutua; grito em ondas
  vampiro   Vampiro da Insônia        "A noite é uma criança."               → capa ondula; abre a capa
  mimico    Mímico das Desculpas      "Hoje não dá, amanhã eu prometo."      → baú respira; abre e mostra a língua
  medusa    Medusa do Gasto           "Leva, está em promoção!"              → serpentes balançam; moedas caem
"""
import math
import os
import sys

from gen_bosses import (
    A, A2, A3, D, EYE, EYE_L, GOLD, L, LL, M, OUT, Part, common_hit, common_knockdown, common_weak,
    compose, eyes_pair, overlay, palette, particles, shadow,
)
from sprite_tools import build_sheet, grid_to_rgba, write_color_sheet


def wave(n, frames, k=1.0):
    return math.sin(2 * math.pi * n / frames * k)


class Kraken:
    id = "kraken"
    KO_STYLE = "slump"
    PAL = palette("#06141A", "#11505E", "#1D7F8F", "#2FB5C2", "#8BE6EC", "#FFE066", "#FFFFFF",
                  "#C9B26B", "#9EE7FF", "#F2617A")

    def draw(self, n, frames, o):
        dx = o.get("dx", 0)
        calm = o.get("calm", False)
        lens = o.get("lens", 0.0)
        cx = 32 + dx
        parts = [shadow(cx, 20)]
        arms = Part()
        for k, base in enumerate((-14, -8, -2, 4, 10, 16)):
            ph = 0 if calm else wave(n + k, frames)
            x0 = cx + base * 0.6
            arms.tube([(x0, 44), (cx + base * 0.9 + 3 * ph, 51), (cx + base * 1.2 - 2 * ph, 57),
                       (cx + base * 1.35 + 3 * ph, 59)], 3.2, 1.2)
        for k in range(6):  # ventosas
            arms.set(cx - 12 + k * 5, 53 + (k % 2), LL)
        parts.append(arms)
        head = Part()
        head.blob(cx, 30, 15, 15, texture=0.06)
        head.blob(cx, 43, 12, 5)
        for sx in (-9, 9):  # manchas
            head.disc(cx + sx, 22, 2, 1.6, LL)
        parts.append(head)
        face = Part(outline=False)
        mode = o.get("eyes", "normal")
        eyes_pair(face, [(cx - 6, 34), (cx + 6, 34)], mode, EYE, 3)
        for k in range(-3, 4):  # boca reta e exigente
            face.set(cx + k, 39, OUT)
        parts.append(face)
        tool = Part()  # lupa: o defeito que só ele vê
        lx, ly = cx + 18, 30 - lens * 6
        tool.line([(cx + 12, 42), (lx, ly + 5)], 2, A)
        for k in range(24):
            a = 2 * math.pi * k / 24
            tool.set(lx + (4 + lens * 2) * math.cos(a), ly + (4 + lens * 2) * math.sin(a), A)
        parts.append(tool)
        glass = Part(outline=False)
        glass.disc(lx, ly, 3 + lens * 2, 3 + lens * 2, A2)
        glass.set(lx - 1, ly - 1, EYE_L)
        parts.append(glass)
        return parts, {"head": (cx, 30), "mark": (cx + 14, 8), "chest": (cx, 40), "waist": 46}

    def idle(self, n):
        return compose(self.draw(n, 8, {})[0])

    def taunt(self, n):
        lens = [0, 0.4, 1, 1, 1, 1, 0.5, 0][n]
        parts, _ = self.draw(n, 8, {"lens": lens, "eyes": "squint" if 2 <= n <= 5 else "normal", "calm": True})
        g = compose(parts)
        if 2 <= n <= 5:  # "X" vermelho: o defeito encontrado
            x0, y0 = 52, 14
            for k in range(4):
                particles(g, [(x0 + k, y0 + k, A3), (x0 + 3 - k, y0 + k, A3)])
        return g


class Quimera:
    id = "quimera"
    KO_STYLE = "slump"  # larga: desaba no lugar
    PAL = palette("#1A0E05", "#7A4A12", "#B8741F", "#E0A040", "#F5D08A", "#7CFF6B", "#EFFFE6",
                  "#8A8F98", "#D7DCE3", "#3E8C3A")

    def draw(self, n, frames, o):
        dx = o.get("dx", 0)
        calm = o.get("calm", False)
        look = o.get("look", 0 if calm else (1 if (n // 2) % 2 else -1))
        cx = 32 + dx
        parts = [shadow(cx, 18)]
        tail = Part()  # cauda de serpente
        tail.tube([(cx + 12, 48), (cx + 20, 44), (cx + 22, 36), (cx + 18, 30)], 2.4, 1.6, ramp=(OUT, A3, A3, A3))
        parts.append(tail)
        body = Part()
        for lx in (cx - 10, cx - 4, cx + 4, cx + 10):
            body.blob(lx, 56, 3, 3.5)
        body.blob(cx, 46, 15, 9, texture=0.05)
        parts.append(body)
        goat = Part()  # cabeça de bode (cinza), à direita
        gx, gy = cx + 9 + look, 30
        for side in (-1, 1):  # chifres finos curvados para trás
            goat.line([(gx + side * 2, gy - 5), (gx + side * 3, gy - 9), (gx + side * 6, gy - 10)], 1.4, A2)
            goat.set(gx + side * 6, gy - 9, A2)
        goat.blob(gx, gy, 6, 6.5, ramp=(OUT, A, A, A2))
        for side in (-1, 1):  # orelhas
            goat.rect(gx + side * 6, gy - 2, gx + side * 8, gy - 1, A)
        goat.rect(gx - 1, gy + 5, gx + 1, gy + 8, A)  # barbicha
        parts.append(goat)
        lion = Part()  # cabeça de leão com juba, à esquerda
        lx, ly = cx - 8 + look, 32
        lion.blob(lx, ly, 10, 9.5, ramp=(D, D, M, L), texture=0.2)
        lion.blob(lx, ly + 1, 6.5, 6)
        parts.append(lion)
        face = Part(outline=False)
        mode = o.get("eyes", "normal")
        eyes_pair(face, [(lx - 3 + look, ly), (lx + 3 + look, ly)], mode, EYE, 2)
        eyes_pair(face, [(gx - 2 + look, gy), (gx + 2 + look, gy)], mode, EYE, 2)
        face.set(lx + look, ly + 3, OUT)
        parts.append(face)
        return parts, {"head": (lx, ly), "mark": (cx + 4, 6), "chest": (cx, 46), "waist": 48}

    def idle(self, n):
        return compose(self.draw(n, 8, {})[0])

    def taunt(self, n):
        look = [0, -1, -2, -2, 2, 2, 1, 0][n]
        parts, _ = self.draw(n, 8, {"look": look, "calm": True})
        g = compose(parts)
        if 2 <= n <= 5:  # sinais de "maior que" voando entre as cabeças
            sym = Part(outline=False)
            x, y = 30, 14
            for k in range(3):
                sym.set(x + k, y + k, EYE)
                sym.set(x + k, y + 4 - k, EYE)
            overlay(g, sym)
        return g


class Banshee:
    id = "banshee"
    PAL = palette("#070C18", "#2D4673", "#4F72A8", "#8AAEE0", "#D6E6FF", "#FFFFFF", "#FFFFFF",
                  "#E9F1FF", "#1B2440", "#A3C7FF")

    def draw(self, n, frames, o):
        dx = o.get("dx", 0)
        calm = o.get("calm", False)
        bob = 0 if calm else round(1.5 * wave(n, frames))
        scream = o.get("scream", 0.0)
        cx = 32 + dx
        cy = 30 + bob
        parts = [shadow(cx, 12)]
        dress = Part()
        for k in range(5):  # vestido em fiapos
            x = cx - 12 + k * 6
            sway = 0 if calm else wave(n + k, frames) * 2
            dress.tube([(x * 0.5 + cx * 0.5, cy + 10), (x + sway, cy + 20), (x - sway, cy + 26)], 3.5, 1.2)
        dress.blob(cx, cy + 12, 10, 9)
        parts.append(dress)
        hair = Part()
        hair.blob(cx, cy, 11, 10, ramp=(OUT, A2, A2, A3))
        for side in (-1, 1):
            hair.tube([(cx + side * 9, cy), (cx + side * 12, cy + 10), (cx + side * 10 + (0 if calm else wave(n, frames) * 2), cy + 18)], 2.6, 1.2, ramp=(OUT, A2, A2, A3))
        parts.append(hair)
        face = Part()
        face.blob(cx, cy + 2, 6.5, 7, ramp=(L, LL, LL, LL))
        parts.append(face)
        f = Part(outline=False)
        eyes_pair(f, [(cx - 3, cy + 1), (cx + 3, cy + 1)], o.get("eyes", "tired"), OUT, 2)
        f.disc(cx, cy + 6, 1.5 + scream * 1.5, 1.2 + scream * 2, OUT)  # boca do lamento
        parts.append(f)
        return parts, {"head": (cx, cy), "mark": (cx + 10, 6), "chest": (cx, cy + 12), "waist": cy + 16}

    def idle(self, n):
        return compose(self.draw(n, 8, {})[0])

    def taunt(self, n):
        scream = [0, 0.5, 1, 1, 1, 1, 0.5, 0][n]
        parts, an = self.draw(n, 8, {"scream": scream, "calm": True, "eyes": "squint" if scream else "tired"})
        g = compose(parts)
        if 2 <= n <= 6:  # ondas do grito
            ring = Part(outline=False)
            hx, hy = an["head"]
            for r in ((n - 1) * 5, (n - 1) * 5 - 6):
                if r <= 6:
                    continue
                for k in range(40):
                    a = math.pi * (0.15 + 0.7 * k / 40)
                    if (k + n) % 3:
                        ring.set(hx + r * math.cos(a), hy + 6 + r * math.sin(a) * 0.6, A3 if r % 2 else EYE_L)
            overlay(g, ring)
        return g


class Vampiro:
    id = "vampiro"
    PAL = palette("#0E0610", "#3A1240", "#5E1F6B", "#8A3A9C", "#C78AD6", "#FF3B3B", "#FFD1D1",
                  "#E8E2D6", "#B00020", "#F5E642")

    def draw(self, n, frames, o):
        dx = o.get("dx", 0)
        calm = o.get("calm", False)
        spread = o.get("spread", 0.0)
        cx = 32 + dx
        parts = [shadow(cx, 16 + spread * 6)]
        cape = Part()
        sway = 0 if calm else wave(n, frames) * 1.5
        for side in (-1, 1):
            w = 13 + spread * 9
            pts = [(cx + side * 4, 26), (cx + side * w, 34 - spread * 6), (cx + side * (w - 2) + sway, 58)]
            cape.tube(pts, 5, 6.5)
        parts.append(cape)
        lining = Part(outline=False)
        if spread > 0.3:
            for side in (-1, 1):
                for y in range(34, 56):
                    for x in range(4, round(8 + spread * 7)):
                        lining.set(cx + side * x, y, A2)
        parts.append(lining)
        body = Part()
        body.rect(cx - 5, 30, cx + 5, 57, D)
        body.rect(cx - 1, 30, cx + 1, 40, A)  # camisa
        body.set(cx, 33, A2)
        parts.append(body)
        head = Part()
        head.blob(cx, 22, 6, 6.5, ramp=(L, A, A, A))
        head.rect(cx - 6, 14, cx + 6, 17, OUT)  # cabelo
        head.set(cx, 18, OUT)
        parts.append(head)
        face = Part(outline=False)
        eyes_pair(face, [(cx - 2, 22), (cx + 2, 22)], o.get("eyes", "normal"), EYE, 2)
        face.set(cx - 1, 26, EYE_L)
        face.set(cx + 1, 26, EYE_L)
        parts.append(face)
        if not calm or "spread" in o:  # lua de madrugada (parado e provocação; some no golpe e na derrota)
            moon = Part(outline=False)
            mx, my = cx + 18, 10
            moon.disc(mx, my, 4, 4, A3)
            moon.disc(mx + 2, my - 1, 3.4, 3.4, 0)
            parts.append(moon)
        return parts, {"head": (cx, 22), "mark": (cx - 16, 6), "chest": (cx, 36), "waist": 44}

    def idle(self, n):
        return compose(self.draw(n, 8, {})[0])

    def taunt(self, n):
        spread = [0, 0.4, 1, 1, 1, 1, 0.5, 0][n]
        parts, _ = self.draw(n, 8, {"spread": spread, "calm": True})
        return compose(parts)


class Mimico:
    id = "mimico"
    KO_STYLE = "slump"
    PAL = palette("#140A04", "#5A3317", "#8A5228", "#B8743A", "#E0A86A", "#FFE066", "#FFFFFF",
                  "#C9952A", "#F25C7A", "#F5D76E")

    def draw(self, n, frames, o):
        dx = o.get("dx", 0)
        calm = o.get("calm", False)
        gape = o.get("gape", 0.0 if calm else 0.15 + 0.15 * wave(n, frames))
        cx = 32 + dx
        parts = [shadow(cx, 18)]
        box = Part()
        box.rect(cx - 15, 40, cx + 15, 58, M)
        for y in (44, 50, 56):
            box.rect(cx - 15, y, cx + 15, y, D)
        box.rect(cx - 15, 40, cx - 13, 58, A)  # cantoneiras douradas
        box.rect(cx + 13, 40, cx + 15, 58, A)
        parts.append(box)
        inside = Part(outline=False)
        lid_y = 40 - round(gape * 18)
        if gape > 0.05:
            inside.rect(cx - 13, lid_y + 4, cx + 13, 40, OUT)
            for k in range(-12, 13, 3):  # dentes
                inside.set(cx + k, lid_y + 4, EYE_L)
                inside.set(cx + k, 39, EYE_L)
                inside.set(cx + k + 1, 38, EYE_L)
            if gape > 0.5:  # língua
                inside.rect(cx - 3, 36, cx + 3, 40, A2)
                inside.rect(cx - 2, 41, cx + 2, 46, A2)
        parts.append(inside)
        lid = Part()
        lid.rect(cx - 15, lid_y - 4, cx + 15, lid_y + 3, L)
        lid.rect(cx - 15, lid_y - 4, cx + 15, lid_y - 3, LL)
        lid.rect(cx - 2, lid_y + 1, cx + 2, lid_y + 5, A)  # fechadura
        lid.set(cx, lid_y + 3, OUT)
        parts.append(lid)
        face = Part(outline=False)
        eyes_pair(face, [(cx - 7, lid_y - 1), (cx + 7, lid_y - 1)], o.get("eyes", "normal"), EYE, 2)
        parts.append(face)
        self._lid = lid_y
        return parts, {"head": (cx, lid_y), "mark": (cx + 12, 10), "chest": (cx, 48), "waist": 46}

    def idle(self, n):
        return compose(self.draw(n, 8, {})[0])

    def taunt(self, n):
        gape = [0.1, 0.4, 1, 1, 1, 1, 0.5, 0.1][n]
        parts, _ = self.draw(n, 8, {"gape": gape, "calm": True})
        g = compose(parts)
        if 2 <= n <= 5:  # moedas falsas (as desculpas) pulando para fora
            pts = []
            for k in range(4):
                t = (n - 2 + k * 0.5) / 3
                x, y = 32 - 10 + k * 7, 30 - 16 * t + 10 * t * t
                pts += [(x, y, A3), (x + 1, y, A3), (x, y + 1, A), (x + 1, y + 1, A)]
            particles(g, pts)
        return g


class Medusa:
    id = "medusa"
    PAL = palette("#071408", "#1F5A2A", "#2F8A3E", "#55B85E", "#A9E5A0", "#FFD23F", "#FFF6C2",
                  "#C9952A", "#F5D76E", "#7A1F2B")

    def draw(self, n, frames, o):
        dx = o.get("dx", 0)
        calm = o.get("calm", False)
        cx = 32 + dx
        parts = [shadow(cx, 16)]
        body = Part()  # corpo de serpente enrolado
        body.blob(cx, 54, 16, 5)
        body.blob(cx - 2, 49, 12, 4.5)
        body.tube([(cx - 4, 46), (cx - 1, 40), (cx, 34)], 5, 4)
        parts.append(body)
        snakes = Part()
        for k, ang in enumerate((-2.4, -1.9, -1.4, -0.9, -0.4)):
            ph = 0 if calm else wave(n + k, 8) * 0.25
            a = ang + ph
            x0, y0 = cx + 6 * math.cos(ang), 22 + 5 * math.sin(ang)
            x1, y1 = cx + 13 * math.cos(a), 22 + 12 * math.sin(a)
            x2, y2 = cx + 17 * math.cos(a + 0.3), 22 + 15 * math.sin(a + 0.3)
            snakes.tube([(x0, y0), (x1, y1), (x2, y2)], 2.2, 1.6)
            snakes.set(x2, y2, EYE)
        parts.append(snakes)
        head = Part()
        head.blob(cx, 24, 7, 7.5, ramp=(D, M, L, LL))
        parts.append(head)
        face = Part(outline=False)
        eyes_pair(face, [(cx - 3, 24), (cx + 3, 24)], o.get("eyes", "normal"), EYE, 2)
        for k in range(-2, 3):  # sorriso de vendedora
            face.set(cx + k, 28 + (1 if abs(k) < 2 else 0), OUT)
        parts.append(face)
        bag = Part()  # sacola de compras
        bx, by = cx + 14, 44
        bag.rect(bx - 4, by, bx + 4, by + 8, A3)
        bag.line([(bx - 2, by), (bx - 2, by - 3), (bx + 2, by - 3), (bx + 2, by)], 1, A)
        bag.rect(bx - 2, by + 3, bx + 2, by + 4, A2)
        parts.append(bag)
        return parts, {"head": (cx, 24), "mark": (cx + 14, 4), "chest": (cx, 40), "waist": 46}

    def idle(self, n):
        return compose(self.draw(n, 8, {})[0])

    def taunt(self, n):
        parts, _ = self.draw(n, 8, {"calm": True, "eyes": "wide" if 2 <= n <= 5 else "normal"})
        g = compose(parts)
        if 2 <= n <= 6:  # moedas caindo da sacola
            pts = []
            for k in range(3):
                y = 52 + ((n - 2) * 3 + k * 4) % 8
                x = 44 + k * 3
                pts += [(x, y, A), (x + 1, y, A2)]
            particles(g, pts)
        return g


BOSSES = {b.id: b for b in (Kraken(), Quimera(), Banshee(), Vampiro(), Mimico(), Medusa())}
ANIMS = {
    "idle": ("idle", 8, 8, True),
    "taunt": ("taunt", 8, 10, False),
    "hit": (common_hit, 6, 12, False),
    "weak": (common_weak, 8, 8, True),
    "defeat": (common_knockdown, 12, 10, False),
}

if __name__ == "__main__":
    root = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(root, "..", "..", "apps", "mobile", "assets", "sprites", "bosses")
    prev = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "out")
    if "--preview-only" in sys.argv:
        out = os.path.join(prev, "sheets")
    for boss in BOSSES.values():
        for name, (fn, count, fps, loop) in ANIMS.items():
            make = getattr(boss, fn) if isinstance(fn, str) else (lambda n, f=fn, b=boss: f(b, n))
            frames = [grid_to_rgba(make(n), boss.PAL) for n in range(count)]
            write_color_sheet(frames, out, f"{boss.id}_{name}", fps=fps, loop=loop)
            build_sheet(frames, prev, f"{boss.id}_{name}", fps=fps, loop=loop, preview_scale=5)
        print(boss.id, "ok")
