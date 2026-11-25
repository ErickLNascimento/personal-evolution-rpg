"""Minichefes das emboscadas em pixel art (criaturas pequenas, ~30 px, no quadro 64x64 dos chefes,
para reaproveitar o golpe, a derrota e o componente do app).

Uso: python tools/sprites/gen_minis.py [pasta_de_preview] [mini ...]
Grava apps/mobile/assets/sprites/bosses/<mini>_<estado>.png|json.

Animações: idle (6, 8 fps, loop) com o jeito de cada um; hit (6, 12 fps) e weak (8, 8 fps) comuns;
defeat (12, 10 fps) = knockdown.py (cai e fica caído). Sem provocação própria: taunt = idle.
  goblin     Goblin do Atraso        → orelhas que mexem, ampulheta na mão
  slime      Slime da Bagunça        → quica (squash and stretch), bolhas e um papel grudado
  morcego    Morcego da Madrugada    → bate as asas, flutua sobre a sombra
  diabrete   Diabrete do Celular     → olha o celular que brilha, cauda balança
  esqueleto  Esqueleto do "Depois"   → boceja e bate o pé, "zz" sobe
"""
import math
import os
import sys

from gen_bosses import (
    A, A2, A3, D, EYE, EYE_L, GOLD, L, LL, M, OUT, SHADOW, Part, common_hit, common_knockdown,
    common_weak, compose, eyes_pair, palette, shadow,
)
from sprite_tools import build_sheet, grid_to_rgba, write_color_sheet

GROUND = 58


class Goblin:
    id = "goblin"
    PAL = palette("#10180C", "#2F5A22", "#4F8A33", "#7DB84A", "#B7E07A", "#FFD23F", "#FFF6C2",
                  "#6B4A2B", "#C9B26B", "#B23A2E")

    def draw(self, n, frames, o):
        dx = o.get("dx", 0)
        calm = o.get("calm", False)
        bob = 0 if calm else round(math.sin(2 * math.pi * n / frames))
        ear = 0 if calm else (1 if n % 3 == 0 else 0)
        cx = 32 + dx
        parts = [shadow(cx, 9, GROUND + 1.5)]
        legs = Part()
        for lx in (cx - 4, cx + 4):
            legs.blob(lx, GROUND - 2, 2.6, 3)
        parts.append(legs)
        body = Part()
        body.blob(cx, 47 + bob, 7.5, 7, ramp=(OUT, A, A, A3) if False else (D, M, L, LL))
        body.rect(cx - 6, 48 + bob, cx + 6, 51 + bob, A)  # tanga de couro
        body.rect(cx - 6, 48 + bob, cx + 6, 48 + bob, A3)
        parts.append(body)
        hand = Part()  # ampulheta (o atraso): areia escorrendo
        hx, hy = cx + 10, 45 + bob
        hand.rect(hx - 2, hy - 4, hx + 2, hy - 4, A)
        hand.rect(hx - 2, hy + 4, hx + 2, hy + 4, A)
        for k in range(3):
            hand.rect(hx - 1 + 0, hy - 3 + k, hx + 1 - (1 if k == 2 else 0), hy - 3 + k, A2)
            hand.rect(hx - 1 + (1 if k == 0 else 0), hy + 1 + k, hx + 1, hy + 1 + k, A2)
        hand.set(hx, hy, GOLD)
        hand.blob(hx - 3, hy + 1, 1.8, 1.8)
        parts.append(hand)
        head = Part()
        hy0 = 36 + bob
        for side in (-1, 1):
            head.tube([(cx + side * 5, hy0 - 1), (cx + side * 10, hy0 - 4 - ear), (cx + side * 13, hy0 - 6 - ear)], 2.2, 0.8)
        head.blob(cx, hy0, 7, 6)
        head.set(cx, hy0 + 2, D)
        parts.append(head)
        face = Part(outline=False)
        eyes_pair(face, [(cx - 3, hy0), (cx + 3, hy0)], o.get("eyes", "normal"), EYE, 2)
        for k in range(-2, 3):  # sorriso torto
            face.set(cx + k, hy0 + 3 + (1 if k == 2 else 0), OUT)
        parts.append(face)
        return parts, {"head": (cx, hy0), "mark": (cx + 6, 22), "chest": (cx, 46), "waist": 48}

    def idle(self, n):
        return compose(self.draw(n, 6, {})[0])


class Slime:
    id = "slime"
    KO_STYLE = "slump"
    PAL = palette("#12081A", "#4A1E6B", "#7A36A8", "#A95FD9", "#D9A8F5", "#FFFFFF", "#FFFFFF",
                  "#F2E3B3", "#6B5B95", "#E9D3FF")

    def draw(self, n, frames, o):
        dx = o.get("dx", 0)
        calm = o.get("calm", False)
        t = 0 if calm else math.sin(2 * math.pi * n / frames)
        sx, sy = 11 + 1.6 * t, 9 - 1.4 * t
        cx = 32 + dx
        cy = GROUND - sy
        parts = [shadow(cx, sx, GROUND + 1.5)]
        body = Part()
        body.blob(cx, cy, sx, sy)
        body.blob(cx - 3, cy - sy + 2, 3.5, 3)  # gota no topo
        for bx, by in ((cx - 5, cy + 3), (cx + 6, cy + 1), (cx + 2, cy + 5)):
            body.set(bx, by, A3)  # bolhas dentro
        parts.append(body)
        paper = Part()  # papel grudado (a bagunça)
        px, py = cx + 6, cy - 3
        paper.rect(px, py, px + 4, py + 5, A)
        paper.rect(px + 1, py + 1, px + 3, py + 1, A2)
        paper.rect(px + 1, py + 3, px + 3, py + 3, A2)
        parts.append(paper)
        face = Part(outline=False)
        eyes_pair(face, [(cx - 4, cy - 1), (cx + 1, cy - 1)], o.get("eyes", "wide"), OUT, 2)
        face.set(cx - 2, cy + 2, OUT)
        face.set(cx - 1, cy + 2, OUT)
        parts.append(face)
        return parts, {"head": (cx, cy - 2), "mark": (cx + 8, 30), "chest": (cx, cy), "waist": round(cy)}

    def idle(self, n):
        return compose(self.draw(n, 6, {})[0])


class Morcego:
    id = "morcego"
    KO_STYLE = "slump"  # asas abertas: largo demais para deitar de lado
    PAL = palette("#0C0A14", "#2A2340", "#463A66", "#6B5A94", "#9C8CC8", "#FF4D4D", "#FFD1D1",
                  "#1C1830", "#F2F2F2", "#3A2F55")

    def draw(self, n, frames, o):
        dx = o.get("dx", 0)
        calm = o.get("calm", False)
        flap = 0 if calm else math.sin(2 * math.pi * n / frames)
        cx = 32 + dx
        cy = 38 + (0 if calm else round(-1.5 * flap))
        parts = [shadow(cx, 7, GROUND + 1.5)]
        wings = Part()
        for side in (-1, 1):
            tip = (cx + side * 17, cy - 6 - 5 * flap)
            mid = (cx + side * 11, cy - 4 - 3 * flap)
            wings.tube([(cx + side * 3, cy - 1), mid, tip], 2.2, 1.0, ramp=(OUT, D, D, M))
            for k, (ex, ey) in enumerate(((cx + side * 9, cy + 4), (cx + side * 14, cy + 1))):
                wings.tube([mid if k == 0 else tip, (ex, ey), (cx + side * 4, cy + 3)], 1.6, 1.2, ramp=(OUT, D, D, M))
            for yy in range(round(cy - 4 - 3 * flap), round(cy + 4)):
                for xx in range(4, 15):
                    x = cx + side * xx
                    top = cy - 1 + (-5 - 4 * flap) * (xx - 3) / 12
                    if top <= yy <= cy + 3 - (xx - 4) * 0.25:
                        wings.set(x, yy, D)
        parts.append(wings)
        body = Part()
        body.blob(cx, cy + 1, 5, 6)
        for side in (-1, 1):  # orelhas
            body.line([(cx + side * 2, cy - 4), (cx + side * 4, cy - 9)], 2, M)
        parts.append(body)
        face = Part(outline=False)
        eyes_pair(face, [(cx - 2, cy - 1), (cx + 2, cy - 1)], o.get("eyes", "wide"), EYE, 2)
        face.set(cx - 1, cy + 3, A2)
        face.set(cx + 1, cy + 3, A2)
        parts.append(face)
        return parts, {"head": (cx, cy - 1), "mark": (cx + 6, 22), "chest": (cx, cy + 1), "waist": cy + 2}

    def idle(self, n):
        return compose(self.draw(n, 6, {})[0])


class Diabrete:
    id = "diabrete"
    PAL = palette("#180808", "#6E1616", "#A82626", "#D94545", "#F28C8C", "#FFD23F", "#FFF6C2",
                  "#1B1B26", "#3FA9F5", "#9EE7FF")

    def draw(self, n, frames, o):
        dx = o.get("dx", 0)
        calm = o.get("calm", False)
        swing = 0 if calm else math.sin(2 * math.pi * n / frames)
        cx = 32 + dx
        parts = [shadow(cx, 9, GROUND + 1.5)]
        tail = Part()
        tx, ty = cx - 13, 44 - 3 * swing
        tail.tube([(cx - 4, 52), (cx - 10, 52), (tx, ty)], 1.4, 1.0)
        tail.rect(tx - 2, ty - 2, tx + 1, ty - 1, D)
        tail.set(tx - 1, ty - 3, D)
        parts.append(tail)
        legs = Part()
        for lx in (cx - 3, cx + 3):
            legs.blob(lx, GROUND - 2, 2.2, 3)
        parts.append(legs)
        body = Part()
        body.blob(cx, 47, 6.5, 7)
        parts.append(body)
        head = Part()
        hy0 = 36
        for side in (-1, 1):  # chifres
            head.line([(cx + side * 3, hy0 - 4), (cx + side * 5, hy0 - 8), (cx + side * 4, hy0 - 10)], 2, A2 if False else LL)
        head.blob(cx, hy0, 6.5, 5.5)
        parts.append(head)
        phone = Part()  # o celular, que ilumina o rosto
        px, py = cx + 5, 43
        phone.rect(px, py, px + 4, py + 7, A)
        parts.append(phone)
        glow = Part(outline=False)
        glow.rect(px + 1, py + 1, px + 3, py + 5, A2 if (calm or n % 2) else A3)
        parts.append(glow)
        face = Part(outline=False)
        mode = o.get("eyes", "normal")
        eyes_pair(face, [(cx - 2, hy0), (cx + 2, hy0)], mode, EYE, 2)
        if mode == "normal":  # olhar no celular: pupilas para baixo à direita
            face.set(cx - 1, hy0 + 1, OUT)
            face.set(cx + 3, hy0 + 1, OUT)
        for k in range(-1, 2):
            face.set(cx + k, hy0 + 3, OUT)
        parts.append(face)
        return parts, {"head": (cx, hy0), "mark": (cx + 6, 22), "chest": (cx, 46), "waist": 48}

    def idle(self, n):
        return compose(self.draw(n, 6, {})[0])


class Esqueleto:
    id = "esqueleto"
    PAL = palette("#14120E", "#7A7362", "#B8B09A", "#E2DBC6", "#FFFFFF", "#6FE3FF", "#E6FBFF",
                  "#3A3428", "#8C6A3F", "#5A5446")

    def draw(self, n, frames, o):
        dx = o.get("dx", 0)
        calm = o.get("calm", False)
        tap = 0 if calm else (1 if n % 2 else 0)
        yawn = 0 if calm else (1 if n in (2, 3) else 0)
        cx = 32 + dx
        parts = [shadow(cx, 9, GROUND + 1.5)]
        bones = Part()
        bones.line([(cx - 3, 50), (cx - 4, GROUND - 1)], 2, L)  # pernas
        bones.line([(cx + 3, 50), (cx + 4 + tap, GROUND - 1 - tap)], 2, L)
        bones.rect(cx - 6, GROUND - 1, cx - 3, GROUND, LL)
        bones.rect(cx + 3 + tap, GROUND - 1 - tap, cx + 6 + tap, GROUND - tap, LL)
        bones.rect(cx - 4, 48, cx + 4, 50, M)  # bacia
        bones.line([(cx, 40), (cx, 48)], 2, M)  # coluna
        for ry in (41, 43, 45):  # costelas
            bones.line([(cx - 5, ry), (cx + 5, ry)], 1, L)
        bones.line([(cx - 6, 41), (cx - 8, 48)], 1.6, L)  # braços
        bones.line([(cx + 6, 41), (cx + 9, 46)], 1.6, L)
        parts.append(bones)
        cal = Part()  # calendário na mão: o "depois"
        kx, ky = cx + 9, 44
        cal.rect(kx, ky, kx + 5, ky + 5, LL)
        cal.rect(kx, ky, kx + 5, ky + 1, A3 if False else D)
        cal.set(kx + 2, ky + 3, A2)
        parts.append(cal)
        skull = Part()
        hy0 = 33
        skull.blob(cx, hy0, 6.5, 6, ramp=(M, L, LL, LL))
        skull.rect(cx - 3, hy0 + 5, cx + 3, hy0 + 6 + yawn, L)  # mandíbula
        parts.append(skull)
        face = Part(outline=False)
        mode = o.get("eyes", "normal")
        for ex in (cx - 3, cx + 2):  # órbitas
            face.rect(ex, hy0 - 1, ex + 1, hy0 + 1, OUT)
        if mode == "normal":
            face.set(cx - 3, hy0, EYE)
            face.set(cx + 2, hy0, EYE)
        elif mode == "squint":
            face.set(cx - 2, hy0, EYE_L)
            face.set(cx + 2, hy0, EYE_L)
        face.set(cx, hy0 + 2, OUT)
        for k in (-2, 0, 2):
            face.set(cx + k, hy0 + 5 + yawn, OUT)
        parts.append(face)
        return parts, {"head": (cx, hy0), "mark": (cx + 7, 20), "chest": (cx, 43), "waist": 47}

    def idle(self, n):
        return compose(self.draw(n, 6, {})[0])


MINIS = {m.id: m for m in (Goblin(), Slime(), Morcego(), Diabrete(), Esqueleto())}
ANIMS = {
    "idle": ("idle", 6, 8, True),
    "taunt": ("idle", 6, 8, False),
    "hit": (common_hit, 6, 12, False),
    "weak": (common_weak, 8, 8, True),
    "defeat": (common_knockdown, 12, 10, False),
}

if __name__ == "__main__":
    root = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(root, "..", "..", "apps", "mobile", "assets", "sprites", "bosses")
    prev = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "out")
    if len(sys.argv) > 2 and sys.argv[2] == "--preview-only":
        out = os.path.join(prev, "sheets")
    for mini in MINIS.values():
        for name, (fn, count, fps, loop) in ANIMS.items():
            make = getattr(mini, fn) if isinstance(fn, str) else (lambda n, f=fn, b=mini: f(b, n))
            frames = [grid_to_rgba(make(n), mini.PAL) for n in range(count)]
            write_color_sheet(frames, out, f"{mini.id}_{name}", fps=fps, loop=loop)
            build_sheet(frames, prev, f"{mini.id}_{name}", fps=fps, loop=loop, preview_scale=5)
        print(mini.id, "ok")
