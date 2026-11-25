"""Herói em pixel art 48x48, em camadas: idle, celebrate e levelup.

Uso: python tools/sprites/gen_hero.py [pasta_de_preview]

Cada animação vira UM atlas PNG (assets/sprites/hero/hero_<anim>.png): uma linha por
camada (corpo da classe, cabelo, acessório, arma...) e uma coluna por frame. O JSON
diz em que linha está cada camada. O app empilha as camadas do herói num shader e
troca os índices da paleta pelas cores escolhidas (ver spritePalette.ts).
"""
import os
import sys
from types import SimpleNamespace

from sprite_tools import build_sheet, grid_to_rgba, hex_rgb, shade, tint, write_atlas

W = H = 48

# ── Índices da paleta (espelhados em apps/mobile/src/components/hero/spritePalette.ts) ──
OUT = 1
SKIN_D, SKIN = 2, 3
HAIR_D, HAIR, HAIR_L = 4, 5, 6
EYE = 7
WHITE = 8
CLOTH_D, CLOTH, CLOTH_L = 9, 10, 11
METAL_D, METAL, METAL_L = 12, 13, 14
LEATHER = 15
GOLD = 16
FX = 17
GROUND = 18
AURA, AURA_L = 19, 20
MAGIC = 21          # gema do cajado (cor da aura, ou violeta)
TRIM = 22           # detalhe da classe (ouro, verde do druida, verde-espectral do necromante)
DARK = 23           # capuz do necromante
RED = 24            # pluma, faixa, pena
GREEN = 25          # folhas
BIRD = 26           # pássaro do druida
BLUSH = 27          # bochecha, lábios (forma feminina)

CLASSES = ["guerreiro", "mago", "arqueiro", "monge", "paladino", "ladino", "bardo", "druida", "necromante"]
FORMS = ["masculino", "feminino"]
HAIRS = ["curto", "longo", "raspado", "moicano", "coque", "espetado", "tranca"]
ROBE = {"mago", "druida", "necromante"}
RACES = ["humano", "elfo", "anao", "orc", "halfling", "draconato"]

# Kit = visual de um estágio: corpo de uma das 9 classes + arma, cabeça e costas próprias.
# As 9 classes antigas são kits delas mesmas; os ramos novos reaproveitam um corpo.
KITS = {c: c for c in CLASSES}
KITS.update({
    "barbaro": "guerreiro",
    "feiticeiro": "mago",
    "clerigo": "paladino",
    "xama": "druida",
    "metamorfo": "druida",
    "cronista": "bardo",
    "skald": "bardo",
    "artesao": "arqueiro",
    "inventor": "arqueiro",
    "mercador": "bardo",
})


# ─────────────────────────────────────────────────────────────
# Primitivas
# ─────────────────────────────────────────────────────────────
class Part:
    """Uma peça do desenho. Peças com contorno ganham 1px de OUT em volta."""

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

    def line(self, x0, y0, x1, y1, i):
        x0, y0, x1, y1 = round(x0), round(y0), round(x1), round(y1)
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.set(x0, y0, i)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def thick(self, x0, y0, x1, y1, i, r=1):
        pts = Part(outline=False)
        pts.line(x0, y0, x1, y1, i)
        for (x, y) in pts.px:
            self.rect(x - r, y - r, x + r, y + r, i)

    def recolor(self, i):
        for k in self.px:
            self.px[k] = i


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


def sparkle(p, x, y, size):
    p.set(x, y, WHITE)
    for r in range(1, size):
        c = WHITE if r == 1 and size == 3 else FX
        for nx, ny in ((x + r, y), (x - r, y), (x, y + r), (x, y - r)):
            p.set(nx, ny, c)


# ─────────────────────────────────────────────────────────────
# Geometria da pose
# ─────────────────────────────────────────────────────────────
def geo(pose, form):
    lift, crouch, breath = pose.get("lift", 0), pose.get("crouch", 0), pose.get("breath", 0)
    feet = 45 - lift
    hip = feet - 5 + crouch
    tb = hip - 1
    tt = tb - 9 + breath
    hb = tt + 1
    ht = hb - 16
    fem = form == "feminino"
    return SimpleNamespace(lift=lift, crouch=crouch, feet=feet, hip=hip, tb=tb, tt=tt, hb=hb, ht=ht,
                           ey=ht + 10, tl=18 if fem else 17, tr=29 if fem else 30, fem=fem)


def hand_pos(pose, g):
    ax = g.tr + 1
    arm = pose.get("arm", "rest")
    if arm == "rest":
        return (ax + 1, g.tt + 9)
    if arm == "mid":
        return (ax + 5, g.tt + 1)
    return (ax + 4, g.tt - 6)


# ─────────────────────────────────────────────────────────────
# Camadas
# ─────────────────────────────────────────────────────────────
def layer_shadow(pose, form):
    g = geo(pose, form)
    p = Part(outline=False)
    p.ellipse(24, 46.5, max(5, 11 - g.lift), 1.2, GROUND)
    return [p]


SEEDS = [(12, 0), (35, 5), (13, 11), (34, 17), (10, 23), (37, 29), (11, 3), (36, 14)]


def layer_fxback(pose, form):
    """Coluna de aura e partículas do level-up (atrás do corpo)."""
    fx = pose.get("power")
    if not fx:
        return []
    g = geo(pose, form)
    t, column, burst, flash = fx["t"], fx.get("column", 0), fx.get("burst", 0), fx.get("flash", False)
    p = Part(outline=False)
    for side, x0 in ((-1, 9), (1, 38)):
        for k in range(column):
            x = x0 - (k % 2) * side
            y0 = g.feet - 2 - ((t * 3 + k * 7) % 30)
            p.line(x, y0, x, y0 + 3, FX)
            p.set(x, y0 + 3, GOLD)
    if flash:
        for x in (8, 39):
            p.line(x, g.feet - 30, x, g.feet, WHITE)
    for i, (x, phase) in enumerate(SEEDS[:burst]):
        y = g.feet - 1 - ((t * 4 + phase) % 34)
        p.set(x, y, WHITE if i % 3 == 0 else FX)
        p.set(x, y + 1, FX)
    return [p]


def silhouette(pose, form):
    """Máscara do corpo básico (para a aura contornar)."""
    grid = compose(layer_body(pose, form, "guerreiro") + layer_hair_base(pose, form, "curto"))
    return {(x, y) for y in range(H) for x in range(W) if grid[y][x] not in (0, GROUND)}


def layer_aura(pose, form, frame_no):
    mask = silhouette(pose, form)
    p = Part(outline=False)
    for (x, y) in mask:
        for dx in range(-2, 3):
            for dy in range(-2, 3):
                q = (x + dx, y + dy)
                if q in mask:
                    continue
                if abs(dx) + abs(dy) > 3:
                    continue  # cantos arredondados
                d = max(abs(dx), abs(dy))
                if d == 1 or q not in p.px:
                    p.set(*q, AURA_L if d == 1 else AURA)
    # labaredas no topo, que tremulam
    tops = {}
    for (x, y) in mask:
        tops[x] = min(tops.get(x, H), y)
    for x, y in tops.items():
        n = (x * 7 + frame_no * 3) % 4
        if x % 3 == 0 and n:
            p.line(x, y - 3, x, y - 2 - n, AURA)
            p.set(x, y - 3 - n, AURA_L)
    return [p]


def layer_cape(pose, form):
    g = geo(pose, form)
    p = Part()
    for y in range(g.tt + 1, g.feet):
        k = (y - g.tt) // 3
        x0, x1 = g.tl - 2 - k, g.tr + 2 + k
        p.rect(x0, y, x1, y, CLOTH_D)
        p.rect(x1 - 1, y, x1, y, DARK)   # sombra do lado direito
    return [p]


def hair_cap(g, p, spikes=True):
    ht = g.ht
    p.ellipse(24, ht + 3, 10, 5.5, HAIR)
    p.rect(15, ht + 3, 32, ht + 5, HAIR)
    if spikes:
        for x in (15, 16, 17, 19, 20, 23, 24, 27, 28, 30, 31, 32):
            p.set(x, ht + 6, HAIR)
        for x in (15, 16, 19, 24, 31, 32):
            p.set(x, ht + 7, HAIR)
    else:  # franja lisa, repartida de lado
        p.rect(15, ht + 6, 32, ht + 6, HAIR)
        for x in (15, 16, 17, 18, 19, 31, 32):
            p.set(x, ht + 7, HAIR)
    for x in (15, 32):
        p.rect(x, ht + 8, x, ht + 9, HAIR)
    p.rect(18, ht - 1, 22, ht - 1, HAIR_L)
    p.rect(17, ht, 20, ht, HAIR_L)
    p.rect(32, ht + 2, 32, ht + 9, HAIR_D)
    p.rect(27, ht + 5, 31, ht + 5, HAIR_D)
    p.set(31, ht + 6, HAIR_D)


def layer_hairback(pose, form, style):
    g = geo(pose, form)
    if style != "longo":
        return []
    p = Part()
    p.ellipse(24, g.ht + 6, 11, 8, HAIR_D)
    bottom = g.tb if g.fem else g.tt + 6     # feminino: até a cintura
    p.rect(13, g.ht + 6, 34, bottom, HAIR_D)
    for x in range(13, 35, 3):
        p.set(x, bottom + 1, HAIR_D)
    return [p]


def hair_bow(g, x0=28):
    """Laço vermelho no alto da cabeça (forma feminina)."""
    y = g.ht - 1
    b = Part()
    for q in ((x0, y), (x0, y + 1), (x0, y + 2), (x0 + 1, y + 1), (x0 + 3, y + 1),
              (x0 + 4, y), (x0 + 4, y + 1), (x0 + 4, y + 2)):
        b.set(*q, RED)
    b.set(x0 + 2, y + 1, BLUSH)
    return b


def side_locks(g, bottom, parts):
    """Mechas dos dois lados do rosto, até a linha `bottom`."""
    for x0 in (14, 31):
        side = Part()
        side.rect(x0, g.ht + 5, x0 + 2, bottom, HAIR)
        inner = x0 + 2 if x0 == 31 else x0
        side.rect(inner, g.ht + 7, inner, bottom, HAIR_D)
        side.set(x0 + 1, bottom + 1, HAIR)  # ponta arredondada
        parts.append(side)


def layer_hair(pose, form, style):
    parts = layer_hair_base(pose, form, style)
    g = geo(pose, form)
    if g.fem and style not in ("coque", "tranca"):
        parts.append(hair_bow(g))
    return parts


def layer_hair_base(pose, form, style):
    g = geo(pose, form)
    ht = g.ht
    parts = []
    if style == "raspado":
        p = Part(outline=False)  # fica dentro da cabeça, sem contorno extra
        for y in range(ht, ht + 4):
            r = y - ht
            inset = 2 if r == 0 else 1 if r == 1 else 0
            for x in range(15 + inset, 33 - inset):
                p.set(x, y, HAIR if (x + y) % 3 else HAIR_D)
        p.rect(15, ht + 4, 16, ht + 6, HAIR_D)
        p.rect(31, ht + 4, 32, ht + 6, HAIR_D)
        if g.fem:  # costeletas compridas
            p.rect(15, ht + 7, 15, g.ey + 2, HAIR_D)
            p.rect(32, ht + 7, 32, g.ey + 2, HAIR_D)
        return [p]
    if style == "moicano":
        sides = Part(outline=False)
        for y in range(ht, ht + 4):
            r = y - ht
            inset = 2 if r == 0 else 1 if r == 1 else 0
            for x in range(15 + inset, 33 - inset):
                sides.set(x, y, HAIR_D)
        crest = Part()
        crest.rect(22, ht - 3, 25, ht + 3, HAIR)
        for x, top in ((22, ht - 4), (23, ht - 6), (24, ht - 5), (25, ht - 3)):
            crest.rect(x, top, x, ht - 3, HAIR)
        crest.rect(22, ht - 3, 22, ht + 3, HAIR_L)
        crest.rect(25, ht - 2, 25, ht + 3, HAIR_D)
        parts = [sides, crest]
        if g.fem:
            side_locks(g, g.ey + 3, parts)
        return parts
    if style == "coque":
        bun = Part()
        bun.ellipse(24, ht - 2, 4, 3, HAIR)
        bun.rect(22, ht - 4, 23, ht - 4, HAIR_L)
        bun.rect(26, ht - 2, 27, ht - 1, HAIR_D)
        parts.append(bun)
        cap = Part()
        hair_cap(g, cap, spikes=False)
        parts.append(cap)
        if g.fem:  # fita vermelha na base do coque e mechas soltas
            ribbon = Part(outline=False)
            ribbon.rect(21, ht, 27, ht, RED)
            ribbon.set(27, ht + 1, RED)
            parts.append(ribbon)
            side_locks(g, g.ey + 2, parts)
        return parts
    if style == "espetado":
        spikes = Part()
        for x0, hgt in ((15, 3), (19, 5), (23, 6), (27, 5), (31, 3)):
            for k in range(hgt):
                spikes.rect(x0 + k // 2, ht + 1 - k, x0 + 3 - (k + 1) // 2, ht + 1 - k, HAIR)
        parts.append(spikes)
        cap = Part()
        hair_cap(g, cap, spikes=True)
        for x in (17, 23, 28):
            cap.set(x, ht + 8, HAIR)
        parts.append(cap)
        if g.fem:
            side_locks(g, g.ey + 3, parts)
        return parts
    cap = Part()
    hair_cap(g, cap, spikes=style in ("curto", "longo"))
    parts.append(cap)
    if style == "longo":
        side_locks(g, g.tt + 6 if g.fem else g.hb + 2, parts)
    if style == "curto" and g.fem:  # chanel até o queixo
        side_locks(g, g.ey + 5, parts)
    if style == "tranca":
        braid = Part()
        for k in range(6):
            x, y = 15 - (k > 2), g.ht + 9 + k * 3
            braid.rect(x - 1, y, x + 1, y + 1, HAIR if k % 2 == 0 else HAIR_D)
            braid.set(x, y + 2, HAIR_D)
        braid.rect(13, g.ht + 27, 15, g.ht + 27, GOLD)
        if g.fem:  # laço na ponta da trança
            for q in ((12, g.ht + 26), (12, g.ht + 28), (16, g.ht + 26), (16, g.ht + 28)):
                braid.set(*q, RED)
            braid.rect(13, g.ht + 27, 15, g.ht + 27, RED)
            braid.set(14, g.ht + 27, BLUSH)
        parts.append(braid)
    return parts


def layer_race(pose, form, race):
    """Traços da raça sobre a cabeça (orelhas, barba, presas, chifres). Humano não tem camada."""
    g = geo(pose, form)
    ht, ey, hb = g.ht, g.ey, g.hb
    parts = []
    if race == "elfo":  # orelhas pontudas
        for side, x in ((-1, 14), (1, 33)):
            ear = Part()
            ear.rect(x, ey, x, ey + 2, SKIN)
            ear.set(x + side, ey, SKIN)
            ear.set(x + side, ey - 1, SKIN)
            ear.set(x + 2 * side, ey - 2, SKIN)
            ear.set(x, ey + 1, SKIN_D)
            parts.append(ear)
    elif race == "anao":
        if not g.fem:  # barba cheia com bigode
            beard = Part()
            for y in range(ey + 3, hb + 4):
                inset = max(0, y - hb) * 2
                beard.rect(17 + inset, y, 30 - inset, y, HAIR)
            beard.rect(29 - 1, ey + 4, 30, hb + 1, HAIR_D)
            beard.rect(20, ey + 3, 27, ey + 3, HAIR_D)
            beard.set(23, ey + 5, HAIR_D)
            beard.set(24, ey + 5, HAIR_D)
            parts.append(beard)
        else:  # tranças laterais com contas
            for x0 in (13, 33):
                braid = Part()
                for k in range(5):
                    y = ey + k * 2
                    braid.rect(x0, y, x0 + 1, y + 1, HAIR if k % 2 == 0 else HAIR_D)
                braid.rect(x0, ey + 10, x0 + 1, ey + 10, GOLD)
                parts.append(braid)
    elif race == "orc":
        for side, x in ((-1, 14), (1, 33)):  # orelhas pequenas e pontudas
            ear = Part()
            ear.rect(x, ey, x, ey + 1, SKIN)
            ear.set(x + side, ey - 1, SKIN)
            parts.append(ear)
        face = Part(outline=False)
        face.rect(17, ey - 1, 30, ey - 1, SKIN_D)  # sobrancelha marcada
        for x in (21, 26):  # presas
            face.set(x, ey + 3, WHITE)
            face.set(x, ey + 4, WHITE)
        parts.append(face)
    elif race == "halfling":
        for x in (14, 33):  # orelhinhas redondas
            ear = Part()
            ear.rect(x, ey + 1, x, ey + 2, SKIN)
            parts.append(ear)
        face = Part(outline=False)
        for q in ((18, ey + 4), (20, ey + 4), (19, ey + 5), (27, ey + 4), (29, ey + 4), (28, ey + 5)):
            face.set(*q, SKIN_D)  # sardas
        parts.append(face)
    elif race == "draconato":
        for mirror in (False, True):  # chifres curvos para trás
            horn = Part()
            pts = [(18, ht), (18, ht - 1), (17, ht - 2), (16, ht - 3), (16, ht - 4), (15, ht - 5)]
            for i, (x, y) in enumerate(pts):
                x = 47 - x if mirror else x
                horn.set(x, y, WHITE if i == len(pts) - 1 else METAL_L)
                if i < 3:
                    horn.set(x + (-1 if mirror else 1), y, METAL)
            parts.append(horn)
        face = Part(outline=False)
        for q in ((17, ey + 3), (18, ey + 4), (29, ey + 3), (30, ey + 4), (19, hb - 1), (28, hb - 1), (16, ey + 5), (31, ey + 5)):
            face.set(*q, SKIN_D)  # escamas
        face.set(22, ey + 3, OUT)  # narinas
        face.set(25, ey + 3, OUT)
        parts.append(face)
    return parts


def layer_classback(pose, form, cls):
    g = geo(pose, form)
    p = Part()
    if cls == "arqueiro":  # aljava nas costas, flechas acima do ombro
        p.thick(g.tl - 2, g.tt - 2, g.tl + 2, g.tt + 8, LEATHER)
        for x in (g.tl - 3, g.tl - 1):
            p.rect(x, g.tt - 5, x, g.tt - 3, WHITE)
        return [p]
    if cls == "bardo":  # alaúde nas costas
        p.ellipse(g.tr + 1, g.tt + 7, 3.5, 3, GOLD)
        p.set(g.tr + 1, g.tt + 7, LEATHER)
        p.line(g.tr, g.tt + 4, g.tr - 4, g.tt - 4, LEATHER)
        return [p]
    if cls in ("ladino", "necromante"):  # volume do capuz atrás da cabeça
        p.ellipse(24, g.ht + 7, 12, 9.5, DARK if cls == "necromante" else CLOTH_D)
        parts = [p]
        if cls == "necromante":
            parts += spirits(pose.get("n", 0), g)
        return parts
    return []


def spirits(n, g):
    """Dois espíritos flutuando ao lado do necromante (sobem e descem em 12 frames)."""
    bob = [0, 0, -1, -1, -2, -2, -2, -1, -1, 0, 0, 0]
    out = []
    for x0, y0, phase in ((8, g.tt - 9, 0), (35, g.tt + 3, 6)):
        y = y0 + bob[(n + phase) % 12]
        sp = Part()
        sp.rect(x0 + 1, y, x0 + 3, y, TRIM)          # cabeça arredondada
        sp.rect(x0, y + 1, x0 + 4, y + 4, TRIM)
        sp.set(x0 + 1, y + 1, WHITE)                 # brilho
        sp.set(x0 + 1, y + 2, OUT)                   # olhos
        sp.set(x0 + 3, y + 2, OUT)
        wave = n % 2                                 # cauda ondulada
        sp.set(x0 + wave, y + 5, TRIM)
        sp.set(x0 + 2 + wave, y + 5, TRIM)
        sp.set(x0 + 4 - wave, y + 6, TRIM)
        out.append(sp)
    return out


def layer_body(pose, form, cls):
    g = geo(pose, form)
    eyes, mouth = pose.get("eyes", "open"), pose.get("mouth", "neutral")
    parts = []
    robe = cls in ROBE
    tl, tr, tt, tb = g.tl, g.tr, g.tt, g.tb

    if not robe:
        legs = Part()
        lw = 2 if g.fem else 3   # pernas mais finas na forma feminina
        for x0 in ((19, 26) if g.fem else (18, 26)):
            legs.rect(x0, g.hip, x0 + lw, g.feet, CLOTH_D)
            legs.rect(x0, g.feet - 2, x0 + lw, g.feet, LEATHER)
            legs.set(x0 - 1 if x0 < 24 else x0 + lw + 1, g.feet, LEATHER)
        parts.append(legs)

    aw = 2 if g.fem else 3       # braços mais finos na forma feminina
    arm_l = Part()
    arm_l.rect(tl - aw, tt + 3, tl - 1, tt + 7, CLOTH)
    arm_l.rect(tl - aw, tt + 3, tl - aw, tt + 7, CLOTH_L)
    arm_l.rect(tl - aw, tt + 8, tl - 1, tt + 9, SKIN)
    if cls == "monge":
        arm_l.rect(tl - aw, tt + 7, tl - 1, tt + 7, GOLD)
    if cls == "arqueiro":
        arm_l.rect(tl - aw, tt + 6, tl - 1, tt + 7, LEATHER)
    parts.append(arm_l)

    torso = Part()
    if robe:
        for y in range(tt, g.feet + 1):
            if g.fem:  # cintura marcada e manto mais rodado
                e = -1 if tt + 4 <= y < g.hip else 0 if y < g.hip else min(4, (y - g.hip) // 2 + 1)
            else:
                e = 0 if y < g.hip else min(3, (y - g.hip) // 2 + 1)
            torso.rect(tl - e, y, tr + e, y, CLOTH)
            torso.set(tl - e, y, CLOTH_L)
            torso.rect(tr + e - 1, y, tr + e, y, CLOTH_D)
        torso.rect(tl - (4 if g.fem else 3), g.feet, tr + (4 if g.fem else 3), g.feet, TRIM)
        torso.rect(23, g.hip + 1, 24, g.feet - 1, CLOTH_D)   # dobra central do manto
        if cls == "mago":  # estrela dourada no peito
            sx, sy = tl + 4, tt + 4
            for q in ((sx, sy), (sx - 1, sy), (sx + 1, sy), (sx, sy - 1), (sx, sy + 1)):
                torso.set(*q, TRIM)
            torso.rect(tl, tb - 1, tr, tb - 1, TRIM)
        elif cls == "druida":
            torso.rect(tl, tb - 1, tr, tb, LEATHER)
            torso.line(tl, tt + 1, tr - 2, tb - 2, TRIM)
        else:  # necromante
            torso.rect(tl, tb - 1, tr, tb - 1, DARK)
            torso.rect(23, tt + 2, 24, tb - 2, TRIM)
    else:
        if g.fem:
            # corpete com cintura marcada + saia evasê que cobre o alto das pernas
            for y in range(tt, tb + 1):
                w = 1 if y >= tt + 4 else 0
                torso.rect(tl + w, y, tr - w, y, CLOTH)
                torso.set(tl + w, y, CLOTH_L)
                torso.rect(tr - w - 1, y, tr - w, y, CLOTH_D)
            last = min(g.hip + 2, g.feet - 2)
            for y in range(g.hip, last + 1):
                e = min(2, y - g.hip + 1)
                torso.rect(tl - e, y, tr + e, y, CLOTH)
                torso.set(tl - e, y, CLOTH_L)
                torso.rect(tr + e - 1, y, tr + e, y, CLOTH_D)
            for x in range(tl - 1, tr + 2, 3):          # pregas da saia
                torso.set(x, last, CLOTH_D)
            belt_l, belt_r = tl + 1, tr - 1
        else:
            torso.rect(tl, tt, tr, tb, CLOTH)
            torso.rect(tl, tt, tl, tb, CLOTH_L)
            torso.rect(tr - 1, tt, tr, tb, CLOTH_D)
            torso.rect(tl, g.hip, tr, g.hip + 1, CLOTH)
            torso.rect(tr - 1, g.hip, tr, g.hip + 1, CLOTH_D)
            torso.set(23, g.hip + 1, CLOTH_D)
            torso.set(24, g.hip + 1, CLOTH_D)
            belt_l, belt_r = tl, tr
        belt = GOLD if cls == "monge" else LEATHER
        torso.rect(belt_l, tb - 1, belt_r, tb, belt)
        if cls == "monge":
            torso.rect(tr - 3, g.hip, tr - 2, g.hip + 3, GOLD)   # ponta da faixa
            for x in range(tl + 3, tr - 2, 2):                   # contas no pescoço
                torso.set(x, tt + 2 + (1 if tl + 5 <= x <= tr - 5 else 0), LEATHER)
        else:
            torso.rect(23, tb - 2, 24, tb, GOLD)
        torso.rect(22, tt, 25, tt + 1, CLOTH_D)
        if cls == "paladino":  # peitoral com sol
            torso.rect(tl + 2, tt + 2, tr - 2, tb - 3, METAL)
            torso.rect(tl + 2, tt + 2, tl + 2, tb - 3, METAL_L)
            torso.rect(tr - 2, tt + 2, tr - 2, tb - 3, METAL_D)
            for q in ((23, tt + 4), (24, tt + 4), (23, tt + 5), (24, tt + 5),
                      (23, tt + 3), (24, tt + 6), (22, tt + 4), (25, tt + 5)):
                torso.set(*q, GOLD)
        if cls == "arqueiro":  # alça da aljava
            torso.line(tl, tt + 1, tr - 1, tb - 2, LEATHER)
        if cls == "bardo":  # gola dourada em ondas
            for x in range(tl + 1, tr):
                torso.set(x, tt + 2 + (x % 2), TRIM)
        if cls == "ladino":
            torso.rect(tl + 1, tb - 3, tl + 2, tb + 2, LEATHER)  # bainha
    parts.append(torso)

    if cls in ("guerreiro", "paladino"):
        pw = 4 if g.fem else 5   # ombreiras menores na forma feminina
        for x0 in ((tl - 3, tr - 1) if g.fem else (tl - 4, tr - 1)):
            pad = Part()
            pad.rect(x0 + 1, tt, x0 + pw - 1, tt, METAL_L)
            pad.rect(x0, tt + 1, x0 + pw, tt + 1, METAL)
            pad.rect(x0, tt + 2, x0 + pw, tt + 2, METAL_D)
            parts.append(pad)

    head = Part()
    for y in range(g.ht, g.hb + 1):
        m = min(y - g.ht, g.hb - y)
        inset = 2 if m == 0 else 1 if m == 1 else 0
        head.rect(15 + inset, y, 32 - inset, y, SKIN)
    head.rect(31, g.ht + 6, 32, g.hb - 2, SKIN_D)
    head.rect(17, g.hb, 30, g.hb, SKIN_D)
    ey = g.ey
    face = []
    for x0 in (18, 28):
        outer = x0 - 1 if x0 == 18 else x0 + 2      # canto de fora do olho
        flick = x0 - 2 if x0 == 18 else x0 + 3
        if g.fem:
            # olho maior (3 linhas de íris), cílio longo com puxadinho e brilho embaixo
            if eyes in ("open", "focus"):
                face += [(outer, ey, OUT), (x0, ey, OUT), (x0 + 1, ey, OUT), (flick, ey - 1, OUT),
                         (x0, ey + 1, WHITE), (x0 + 1, ey + 1, EYE), (x0, ey + 2, EYE), (x0 + 1, ey + 2, EYE),
                         (x0, ey + 3, EYE), (x0 + 1, ey + 3, EYE), (x0 + 1 if x0 == 18 else x0, ey + 3, WHITE)]
                if eyes == "focus":
                    bx = (x0 - 1, x0, x0 + 1) if x0 == 18 else (x0 + 2, x0 + 1, x0)
                    face += [(bx[0], ey - 2, OUT), (bx[1], ey - 2, OUT), (bx[2], ey - 2, OUT)]
            elif eyes == "closed":
                face += [(x0, ey + 2, OUT), (x0 + 1, ey + 2, OUT), (outer, ey + 2, OUT), (flick, ey + 1, OUT)]
            elif eyes == "happy":
                face += [(x0 - 1, ey + 2, OUT), (x0, ey + 1, OUT), (x0 + 1, ey + 1, OUT), (x0 + 2, ey + 2, OUT),
                         (flick, ey + 1, OUT)]
            continue
        if eyes in ("open", "focus"):
            face += [(x0, ey, OUT), (x0 + 1, ey, OUT), (x0, ey + 1, WHITE), (x0 + 1, ey + 1, EYE),
                     (x0, ey + 2, EYE), (x0 + 1, ey + 2, EYE)]
            if eyes == "focus":
                bx = (x0 - 1, x0, x0 + 1) if x0 == 18 else (x0 + 2, x0 + 1, x0)
                face += [(bx[0], ey - 2, OUT), (bx[1], ey - 2, OUT), (bx[2], ey - 1, OUT)]
        elif eyes == "closed":
            face += [(x0, ey + 2, OUT), (x0 + 1, ey + 2, OUT)]
        elif eyes == "happy":
            face += [(x0 - 1, ey + 2, OUT), (x0, ey + 1, OUT), (x0 + 1, ey + 1, OUT), (x0 + 2, ey + 2, OUT)]
    if g.fem:  # bochechas rosadas e brincos
        face += [(16, ey + 4, BLUSH), (17, ey + 4, BLUSH), (30, ey + 4, BLUSH), (31, ey + 4, BLUSH),
                 (15, ey + 5, GOLD), (32, ey + 5, GOLD)]
    if mouth == "smile":
        face += [(22, ey + 4, OUT), (23, ey + 5, OUT), (24, ey + 5, OUT), (25, ey + 4, OUT)]
    elif mouth == "shout":
        lip = BLUSH if g.fem else OUT
        face += [(23, ey + 4, OUT), (24, ey + 4, OUT), (23, ey + 5, lip), (24, ey + 5, lip)]
    else:
        lip = BLUSH if g.fem else SKIN_D
        face += [(23, ey + 5, lip), (24, ey + 5, lip)]
    for x, y, i in face:
        head.set(x, y, i)
    parts.append(head)

    if cls == "druida":  # pássaro no ombro esquerdo, que bate as asas
        n = pose.get("n", 0)
        bx, by = tl - 6, tt - 1
        bird = Part()
        bird.rect(bx, by, bx + 3, by + 2, BIRD)
        bird.rect(bx + 1, by - 1, bx + 2, by - 1, BIRD)
        bird.set(bx - 1, by + 1, GOLD)                       # bico
        bird.set(bx + 1, by, OUT)                            # olho
        bird.set(bx + 4, by + 2, BIRD)                       # cauda
        if n % 4 < 2:
            bird.rect(bx + 2, by + 1, bx + 3, by + 1, WHITE)  # asa fechada
        else:
            bird.rect(bx + 2, by - 2, bx + 3, by - 1, WHITE)  # asa aberta
        parts.append(bird)
    return parts


def layer_headgear(pose, form, cls):
    """Peças da classe (ou do kit) na cabeça, por cima do cabelo."""
    g = geo(pose, form)
    ht = g.ht
    if cls == "cronista":
        return layer_headgear(pose, form, "bardo")
    if cls == "feiticeiro":  # chapéu pontudo de mago
        hat = Part()
        hat.rect(13, ht + 2, 34, ht + 3, CLOTH_D)
        for k in range(10):
            y = ht + 1 - k
            half = max(0, 7 - (k * 7) // 9)
            cx = 24 + (k * k) // 30
            hat.rect(cx - half, y, cx + half, y, CLOTH)
        hat.rect(16, ht + 1, 31, ht + 1, TRIM)
        hat.set(21, ht - 2, GOLD)
        hat.set(26, ht - 5, GOLD)
        return [hat]
    if cls == "xama":  # cocar de penas
        band = Part()
        band.rect(15, ht + 1, 32, ht + 2, LEATHER)
        band.rect(23, ht + 1, 24, ht + 2, GOLD)
        feathers = Part()
        for i, x in enumerate((17, 20, 23, 26, 29)):
            top = ht - (3 if i in (0, 4) else 5 if i == 2 else 4)
            feathers.rect(x, top, x, ht, RED if i % 2 == 0 else WHITE)
            feathers.set(x, top, WHITE if i % 2 == 0 else RED)
        return [feathers, band]
    if cls == "metamorfo":  # orelhas de lobo
        parts = []
        for mirror in (False, True):
            ear = Part()
            for x, y, c in ((16, ht + 1, LEATHER), (17, ht + 1, LEATHER), (18, ht + 1, LEATHER),
                            (16, ht, LEATHER), (17, ht, SKIN_D), (18, ht, LEATHER),
                            (16, ht - 1, LEATHER), (17, ht - 1, LEATHER), (16, ht - 2, LEATHER)):
                ear.set(47 - x if mirror else x, y, c)
            parts.append(ear)
        return parts
    if cls == "skald":  # elmo com chifres
        helm = Part()
        helm.ellipse(24, ht + 3, 10, 5, METAL)
        helm.rect(17, ht - 1, 21, ht - 1, METAL_L)
        helm.rect(31, ht + 1, 33, ht + 5, METAL_D)
        horns = Part()
        for mirror in (False, True):
            for x, y in ((14, ht + 2), (13, ht + 1), (12, ht), (12, ht - 1), (12, ht - 2)):
                horns.set(47 - x if mirror else x, y, WHITE)
        return [horns, helm]
    if cls == "inventor":  # óculos de proteção na testa
        band = Part(outline=False)
        band.rect(15, ht + 5, 32, ht + 5, LEATHER)
        lenses = Part()
        for x0 in (18, 26):
            lenses.rect(x0, ht + 3, x0 + 3, ht + 6, METAL)
            lenses.rect(x0 + 1, ht + 4, x0 + 2, ht + 5, MAGIC)
            lenses.set(x0 + 1, ht + 4, WHITE)
        return [band, lenses]
    if cls == "mercador":  # boné com faixa dourada
        cap = Part()
        cap.ellipse(24, ht + 1, 10, 3.5, CLOTH_D)
        cap.rect(14, ht + 3, 36, ht + 3, CLOTH_D)
        cap.rect(15, ht + 2, 32, ht + 2, GOLD)
        cap.rect(18, ht - 1, 22, ht - 1, CLOTH)
        return [cap]
    if cls in ("ladino", "necromante"):
        col = DARK if cls == "necromante" else CLOTH_D
        hood = Part()
        hood.ellipse(24, ht + 3, 11, 6.5, col)
        hood.rect(13, ht + 3, 16, g.hb, col)
        hood.rect(31, ht + 3, 34, g.hb, col)
        for (x, y) in list(hood.px):  # abre o rosto
            if 17 <= x <= 30 and y >= ht + 7:
                del hood.px[(x, y)]
        hood.rect(17, ht - 1, 21, ht - 1, CLOTH if cls == "ladino" else METAL_D)
        if cls == "necromante":
            for y in range(ht + 6, g.hb + 1):
                hood.set(16, y, TRIM)
                hood.set(31, y, TRIM)
        parts = [hood]
        if cls == "ladino":  # máscara cobrindo boca e nariz
            mask = Part()
            mask.rect(16, g.ey + 3, 31, g.hb, CLOTH_D)
            mask.rect(16, g.ey + 3, 31, g.ey + 3, CLOTH)
            parts.append(mask)
        return parts
    if cls == "druida":  # galhada com folhas
        p = Part()
        for side in (-1, 1):
            bx = 17 if side < 0 else 30
            p.line(bx, ht + 1, bx + 4 * side, ht - 4, LEATHER)
            p.line(bx + 2 * side, ht - 2, bx + 2 * side, ht - 5, LEATHER)
        leaves = Part(outline=False)
        for q in ((13, ht - 5), (14, ht - 5), (12, ht - 4), (15, ht - 6), (34, ht - 5), (33, ht - 5), (35, ht - 4),
                  (32, ht - 6), (19, ht - 6), (28, ht - 6)):
            leaves.set(*q, GREEN)
        return [p, leaves]
    if cls == "bardo":  # chapéu com pena
        hat = Part()
        hat.ellipse(24, ht + 1, 9, 3.5, CLOTH_D)
        hat.rect(14, ht + 3, 33, ht + 3, CLOTH_D)
        hat.rect(18, ht - 1, 23, ht - 1, CLOTH)
        feather = Part()
        feather.line(28, ht, 34, ht - 6, RED)
        feather.line(29, ht, 35, ht - 5, RED)
        feather.set(35, ht - 7, RED)
        return [feather, hat]
    return []


def layer_accessory(pose, form, acc):
    g = geo(pose, form)
    ht = g.ht
    if acc == "faixa":
        p = Part()
        p.rect(15, ht + 5, 32, ht + 6, RED)
        p.rect(22, ht + 5, 25, ht + 6, METAL)
        p.rect(23, ht + 5, 23, ht + 5, METAL_L)
        tails = Part()
        tails.line(33, ht + 6, 36, ht + 9, RED)
        tails.line(33, ht + 7, 35, ht + 11, RED)
        return [tails, p]
    if acc == "elmo":
        plume = Part()
        plume.thick(24, ht - 3, 30, ht - 5, RED, r=1)
        plume.line(31, ht - 5, 34, ht - 2, RED)
        helm = Part()
        helm.ellipse(24, ht + 3, 10.5, 6, METAL)
        helm.rect(14, ht + 3, 33, ht + 6, METAL)
        helm.rect(14, ht + 6, 16, ht + 11, METAL)
        helm.rect(31, ht + 6, 33, ht + 11, METAL)
        helm.rect(17, ht - 2, 21, ht - 2, METAL_L)
        helm.rect(14, ht + 3, 14, ht + 11, METAL_L)
        helm.rect(31, ht + 1, 33, ht + 11, METAL_D)
        helm.rect(17, ht + 6, 30, ht + 6, METAL_D)
        helm.rect(23, ht + 6, 24, ht + 9, METAL)   # protetor de nariz
        return [plume, helm]
    if acc == "coroa":
        p = Part()
        p.rect(18, ht - 1, 29, ht, GOLD)
        for x, top in ((18, ht - 4), (21, ht - 3), (23, ht - 5), (24, ht - 5), (26, ht - 3), (29, ht - 4)):
            p.rect(x, top, x, ht - 2, GOLD)
        p.set(23, ht - 1, RED)
        p.set(24, ht - 1, RED)
        p.rect(18, ht, 29, ht, TRIM)
        return [p]
    return []


def weapon_shape(cls, hand, pose, g):
    """Devolve (peça da arma, ponta para o brilho)."""
    hx, hy = hand
    arm = pose.get("arm", "rest")
    p = Part()
    if cls in ("guerreiro", "ladino"):
        short = cls == "ladino"
        if arm == "rest":
            tip = (hx + (3 if short else 7), hy + (5 if short else g.feet + g.crouch - hy))
        elif arm == "mid":
            tip = (hx + (4 if short else 8), hy - (5 if short else 10))
        else:
            tip = (hx + (1 if short else 3), max(1, hy - (7 if short else 15)))
        tx, ty = tip
        L = max(1.0, ((tx - hx) ** 2 + (ty - hy) ** 2) ** 0.5)
        dx, dy = (tx - hx) / L, (ty - hy) / L
        px_, py_ = -dy, dx
        b = 3 if short else 4
        bx, by = hx + dx * b, hy + dy * b
        if not short:
            p.line(bx + px_, by + py_, tx + px_ * 0.5, ty + py_ * 0.5, METAL)
        p.line(bx, by, tx, ty, METAL_L)
        if not short:
            for k in (0.35, 0.7):
                p.set(bx + (tx - bx) * k, by + (ty - by) * k, WHITE)
        gx, gy = hx + dx * (2 if short else 2.5), hy + dy * (2 if short else 2.5)
        w = 1 if short else 2
        p.line(gx - px_ * w, gy - py_ * w, gx + px_ * w, gy + py_ * w, GOLD)
        p.line(hx - dx, hy - dy, hx + dx * 1.5, hy + dy * 1.5, LEATHER)
        p.set(hx - dx * 2, hy - dy * 2, GOLD)
        return p, tip
    if cls == "paladino":  # martelo
        if arm == "rest":
            top, butt = (hx, hy - 9), (hx, hy + 3)
        elif arm == "mid":
            top, butt = (hx + 6, hy - 8), (hx - 1, hy + 2)
        else:
            top, butt = (hx + 2, hy - 11), (hx - 1, hy + 3)
        p.line(*butt, *top, LEATHER)
        tx, ty = top
        p.rect(tx - 2, ty - 2, tx + 2, ty, METAL)
        p.rect(tx - 2, ty - 2, tx + 2, ty - 2, METAL_L)
        p.rect(tx + 2, ty - 1, tx + 2, ty, METAL_D)
        p.set(tx, ty - 1, GOLD)
        return p, (tx, ty - 3)
    if cls in ("mago", "druida", "necromante"):  # cajados
        if arm == "rest":
            top, butt = (hx, g.ht + 1), (hx, g.feet + g.crouch)
        elif arm == "mid":
            top, butt = (hx + 5, hy - 13), (hx - 2, hy + 6)
        else:
            top, butt = (hx + 2, max(4, hy - 13)), (hx - 1, hy + 5)
        p.line(*butt, *top, LEATHER)
        tx, ty = top
        if cls == "mago":
            for q, c in (((tx, ty - 3), MAGIC), ((tx - 1, ty - 2), MAGIC), ((tx + 1, ty - 2), MAGIC),
                         ((tx, ty - 2), WHITE), ((tx, ty - 1), MAGIC), ((tx - 1, ty), GOLD), ((tx + 1, ty), GOLD),
                         ((tx, ty), GOLD)):
                p.set(*q, c)
            return p, (tx, ty - 4)
        if cls == "druida":
            p.line(tx, ty, tx - 2, ty - 3, LEATHER)
            p.line(tx, ty, tx + 2, ty - 2, LEATHER)
            leaves = [(tx - 3, ty - 3), (tx - 2, ty - 4), (tx + 2, ty - 3), (tx + 3, ty - 2), (tx, ty - 2),
                      (tx - 1, ty - 1), (tx + 1, ty - 1)]
            for q in leaves:
                p.set(*q, GREEN)
            return p, (tx, ty - 5)
        # necromante: crânio e chama
        p.rect(tx - 1, ty - 3, tx + 1, ty - 1, METAL_L)
        p.set(tx - 1, ty - 2, OUT)
        p.set(tx + 1, ty - 2, OUT)
        p.set(tx, ty, METAL_L)
        flame = [(tx, ty - 4), (tx - 1, ty - 5), (tx + 1, ty - 5), (tx, ty - 6), (tx, ty - 5)]
        for q in flame:
            p.set(*q, TRIM)
        return p, (tx, ty - 7)
    if cls == "arqueiro":  # arco
        for t in range(-8, 9):
            bulge = round(3 * (1 - (t / 8) ** 2))
            p.set(hx + 1 + bulge, hy + t, LEATHER)
        string = Part(outline=False)
        string.line(hx + 1, hy - 8, hx + 1, hy + 8, METAL_L)
        return p, (hx + 1, hy - 9), string
    if cls in ("barbaro", "clerigo", "artesao"):  # machado, maça, martelo de ofício
        short = cls == "artesao"
        if arm == "rest":
            top, butt = (hx, hy - (6 if short else 10)), (hx, hy + 2)
        elif arm == "mid":
            top, butt = (hx + (4 if short else 6), hy - (5 if short else 9)), (hx - 1, hy + 2)
        else:
            top, butt = (hx + 2, hy - (8 if short else 12)), (hx - 1, hy + 3)
        p.line(*butt, *top, LEATHER)
        tx, ty = top
        if cls == "barbaro":  # lâmina em meia-lua para a direita e ponta atrás
            p.rect(tx + 1, ty - 2, tx + 3, ty + 2, METAL)
            p.rect(tx + 4, ty - 1, tx + 4, ty + 1, METAL)
            p.rect(tx + 3, ty - 2, tx + 4, ty + 2, METAL_L)
            p.set(tx + 4, ty - 2, METAL_L)
            p.set(tx - 1, ty, METAL_D)
            p.set(tx, ty - 1, METAL_D)
            return p, (tx + 4, ty - 3)
        if cls == "clerigo":  # cabeça redonda com cravos
            p.rect(tx - 1, ty - 2, tx + 1, ty, METAL)
            p.set(tx - 1, ty - 2, METAL_L)
            for q in ((tx, ty - 3), (tx - 2, ty - 1), (tx + 2, ty - 1)):
                p.set(*q, METAL_L)
            p.set(tx, ty - 1, GOLD)
            return p, (tx, ty - 4)
        p.rect(tx - 1, ty - 1, tx + 2, ty, METAL)  # martelo de ofício
        p.rect(tx - 1, ty - 1, tx + 2, ty - 1, METAL_L)
        return p, (tx, ty - 2)
    if cls == "inventor":  # chave inglesa
        if arm == "rest":
            top = (hx + 1, hy - 7)
        elif arm == "mid":
            top = (hx + 5, hy - 6)
        else:
            top = (hx + 2, hy - 9)
        p.line(hx, hy, *top, METAL)
        tx, ty = top
        p.rect(tx - 1, ty - 2, tx - 1, ty, METAL_L)
        p.rect(tx + 1, ty - 2, tx + 1, ty, METAL_L)
        p.set(tx, ty, METAL_L)
        return p, (tx, ty - 3)
    if cls == "xama":  # cajado com penas penduradas
        if arm == "rest":
            top, butt = (hx, g.ht + 1), (hx, g.feet + g.crouch)
        elif arm == "mid":
            top, butt = (hx + 5, hy - 13), (hx - 2, hy + 6)
        else:
            top, butt = (hx + 2, max(4, hy - 13)), (hx - 1, hy + 5)
        p.line(*butt, *top, LEATHER)
        tx, ty = top
        p.rect(tx - 1, ty - 2, tx + 1, ty, WHITE)  # crânio pequeno
        p.set(tx, ty - 1, OUT)
        for k, c in ((1, RED), (2, WHITE), (3, RED)):
            p.set(tx + 2, ty + k, c)
            p.set(tx - 2, ty + k + 1, c)
        return p, (tx, ty - 3)
    if cls == "feiticeiro":  # orbe flutuando sobre a mão
        orb = (hx + 1, hy - 5)
        ox, oy = orb
        p.ellipse(ox + 0.5, oy + 0.5, 2.2, 2.2, MAGIC)
        p.set(ox - 1, oy - 1, WHITE)
        p.set(ox, oy - 1, AURA_L)
        return p, (ox, oy - 3)
    if cls == "cronista":  # livro aberto
        p.rect(hx - 2, hy - 4, hx + 2, hy - 2, WHITE)
        p.rect(hx - 2, hy - 1, hx + 2, hy - 1, LEATHER)
        p.set(hx, hy - 4, LEATHER)
        p.set(hx, hy - 3, LEATHER)
        p.set(hx - 1, hy - 3, METAL)
        p.set(hx + 1, hy - 3, METAL)
        return p, (hx, hy - 6)
    if cls == "skald":  # trompa de guerra
        for x, y, c in ((hx, hy - 1, WHITE), (hx + 1, hy - 2, WHITE), (hx + 2, hy - 3, WHITE),
                        (hx + 3, hy - 4, GOLD), (hx + 4, hy - 4, GOLD), (hx + 4, hy - 5, GOLD),
                        (hx + 5, hy - 5, GOLD), (hx + 5, hy - 3, GOLD)):
            p.set(x, y, c)
        return p, (hx + 5, hy - 7)
    if cls == "mercador":  # bolsa de moedas
        p.ellipse(hx + 0.5, hy + 3.5, 2.3, 2, LEATHER)
        p.rect(hx - 1, hy + 1, hx + 1, hy + 1, GOLD)
        p.set(hx + 1, hy + 3, GOLD)
        return p, (hx + 3, hy - 3)
    return None, (hand[0], hand[1] - 2)   # monge, bardo e metamorfo: mão livre


def layer_weapon(pose, form, cls):
    g = geo(pose, form)
    arm = pose.get("arm", "rest")
    ax = g.tr + 1
    parts = []
    if cls in ("paladino", "clerigo"):  # escudo com sol no braço esquerdo
        sh = Part()
        x0, y0 = g.tl - 6, g.tt + 3
        sh.rect(x0, y0, x0 + 5, y0 + 6, METAL)
        sh.rect(x0 + 1, y0 + 7, x0 + 4, y0 + 7, METAL)
        sh.rect(x0 + 2, y0 + 8, x0 + 3, y0 + 8, METAL)
        sh.rect(x0, y0, x0, y0 + 6, METAL_L)
        sh.rect(x0 + 5, y0, x0 + 5, y0 + 6, METAL_D)
        for q in ((x0 + 2, y0 + 2), (x0 + 3, y0 + 2), (x0 + 2, y0 + 3), (x0 + 3, y0 + 3),
                  (x0 + 2, y0 + 1), (x0 + 3, y0 + 4), (x0 + 1, y0 + 2), (x0 + 4, y0 + 3)):
            sh.set(*q, GOLD)
        parts.append(sh)
    arm_r = Part()
    if arm == "rest":
        arm_r.rect(ax, g.tt + 3, ax + (1 if g.fem else 2), g.tt + 7, CLOTH_D)
    elif arm == "mid":
        arm_r.thick(ax + 1, g.tt + 4, ax + 3, g.tt + 2, CLOTH_D)
    else:
        arm_r.thick(ax + 1, g.tt + 3, ax + 4, g.tt - 3, CLOTH_D)
    hand = hand_pos(pose, g)
    hx, hy = hand
    if cls == "monge":
        arm_r.rect(hx - 1, hy + 1, hx, hy + 1, GOLD)
    res = weapon_shape(cls, hand, pose, g)
    weapon, tip = res[0], res[1]
    string = res[2] if len(res) > 2 else None
    if weapon and pose.get("flash"):
        weapon.recolor(WHITE)
    fist = Part(outline=weapon is None)
    fist.rect(hx - 1, hy - 1, hx, hy, SKIN)
    fist.set(hx - 1, hy, SKIN_D)
    if cls == "metamorfo":  # garras
        for k in (-1, 0, 1):
            fist.set(hx + 1, hy + k, WHITE)
        fist.set(hx + 2, hy - 2, WHITE)
    parts.append(arm_r)
    if string:
        parts.append(string)
    if weapon:
        parts.append(weapon)
    parts.append(fist)
    size = pose.get("tip", 0)
    if size:
        sp = Part(outline=False)
        if cls in ("bardo", "cronista", "skald"):  # nota musical no lugar da faísca
            tx, ty = tip[0] + 1, tip[1] - 2
            sp.rect(tx, ty - 4, tx, ty, FX)
            sp.rect(tx - 2, ty, tx - 1, ty + 1, FX)
            sp.rect(tx + 1, ty - 4, tx + 2, ty - 3, FX)
            if size >= 3:
                sparkle(sp, tx + 4, ty - 5, 2)
        else:
            sparkle(sp, tip[0], tip[1], size)
        parts.append(sp)
    return parts


# ─────────────────────────────────────────────────────────────
# Animações (poses compartilhadas por todas as classes)
# ─────────────────────────────────────────────────────────────
def idle():
    breath = [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1]
    return [dict(breath=b, eyes="closed" if i == 10 else "open") for i, b in enumerate(breath)]


def celebrate():
    return [
        dict(crouch=1),
        dict(crouch=2, breath=1, eyes="focus"),
        dict(lift=3, breath=-1, arm="mid", eyes="happy", mouth="smile"),
        dict(lift=5, arm="up", eyes="happy", mouth="shout", tip=2),
        dict(lift=5, arm="up", eyes="happy", mouth="shout", tip=3),
        dict(lift=4, arm="up", eyes="happy", mouth="smile", tip=2),
        dict(crouch=2, breath=1, arm="up", eyes="happy", mouth="smile", tip=1),
        dict(arm="mid", mouth="smile"),
    ]


def levelup():
    return [
        dict(power=dict(t=0, burst=2)),
        dict(crouch=1, eyes="focus", power=dict(t=1, column=2, burst=4)),
        dict(crouch=2, breath=1, eyes="focus", power=dict(t=2, column=4, burst=6)),
        dict(breath=-1, arm="mid", eyes="focus", mouth="shout", power=dict(t=3, column=6, burst=8)),
        dict(lift=1, breath=-1, arm="up", eyes="focus", mouth="shout", tip=2, power=dict(t=4, column=8, burst=8)),
        dict(lift=1, breath=-1, arm="up", eyes="happy", mouth="shout", flash=True, tip=3,
             power=dict(t=5, column=8, burst=8, flash=True)),
        dict(lift=1, arm="up", eyes="happy", mouth="smile", tip=3, power=dict(t=6, column=6, burst=8)),
        dict(arm="up", eyes="happy", mouth="smile", tip=2, power=dict(t=7, column=4, burst=6)),
        dict(arm="mid", mouth="smile", tip=1, power=dict(t=8, column=2, burst=3)),
        dict(mouth="smile"),
    ]


ANIMS = {"idle": (idle, 8, True), "celebrate": (celebrate, 12, False), "levelup": (levelup, 12, False)}


def layers():
    """(nome da camada, função(pose, frame_no) -> peças). Formas independentes usam 'masculino'."""
    L = [("shadow", lambda p, n: layer_shadow(p, "masculino")),

         ("fxback", lambda p, n: layer_fxback(p, "masculino")),
         ("cape", lambda p, n: layer_cape(p, "masculino"))]
    for f in FORMS:
        L.insert(1, (f"aura/{f}", lambda p, n, f=f: layer_aura(p, f, n)))
    for s in HAIRS:
        for f in FORMS:
            L.append((f"hairback/{s}/{f}", lambda p, n, s=s, f=f: layer_hairback(p, f, s)))
    for k in KITS:
        L.append((f"classback/{k}", lambda p, n, k=k: layer_classback(p, "masculino", k)))
    for c in CLASSES:
        for f in FORMS:
            L.append((f"body/{c}/{f}", lambda p, n, c=c, f=f: layer_body(p, f, c)))
    for s in HAIRS:
        for f in FORMS:
            L.append((f"hair/{s}/{f}", lambda p, n, s=s, f=f: layer_hair(p, f, s)))
    for r in RACES:
        for f in FORMS:
            L.append((f"race/{r}/{f}", lambda p, n, r=r, f=f: layer_race(p, f, r)))
    for k in KITS:
        L.append((f"headgear/{k}", lambda p, n, k=k: layer_headgear(p, "masculino", k)))
    for a in ("faixa", "elmo", "coroa"):
        L.append((f"accessory/{a}", lambda p, n, a=a: layer_accessory(p, "masculino", a)))
    for k in KITS:
        for f in FORMS:
            L.append((f"weapon/{k}/{f}", lambda p, n, k=k, f=f: layer_weapon(p, f, k)))
    return L


def stack(look, rows):
    """Empilha as camadas de um visual (para os previews)."""
    kit, form, hair, acc, aura, race = look
    names = ["shadow"] + ([f"aura/{form}"] if aura else []) + ["fxback"] + (["cape"] if acc == "capa" else []) + [
        f"hairback/{hair}/{form}", f"classback/{kit}", f"body/{KITS[kit]}/{form}", f"hair/{hair}/{form}",
        f"race/{race}/{form}", f"headgear/{kit}"] + (
        [f"accessory/{acc}"] if acc in ("faixa", "elmo", "coroa") else []) + [f"weapon/{kit}/{form}"]
    out = [[0] * W for _ in range(H)]
    for nm in names:
        g = rows.get(nm)
        if not g:
            continue
        for y in range(H):
            for x in range(W):
                if g[y][x]:
                    out[y][x] = g[y][x]
    return out


def luminance(h):
    r, g, b = (v / 255 for v in hex_rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def cloth_tones(outfit):
    """Sombra, base e luz da roupa. Roupas muito escuras (obsidiana) clareiam um pouco,
    senão somem no fundo escuro do app e se confundem com o contorno."""
    if luminance(outfit) < 0.2:
        return tint(outfit, 0.1), tint(outfit, 0.22), tint(outfit, 0.4)
    return shade(outfit, 0.62), hex_rgb(outfit), tint(outfit, 0.25)


def preview_palette(skin="#E8B896", hair="#5A3A22", eyes="#7A4A2A", outfit="#B7343F", aura="#FF8A3D",
                    trim="#E8BE58"):
    p = [(0, 0, 0, 0)] * 28
    f = lambda c: (*c, 255)
    p[OUT] = f(hex_rgb("#191626"))
    p[SKIN_D], p[SKIN] = f(shade(skin, 0.82)), f(hex_rgb(skin))
    p[HAIR_D], p[HAIR], p[HAIR_L] = f(shade(hair, 0.7)), f(hex_rgb(hair)), f(tint(hair, 0.3))
    p[EYE], p[WHITE] = f(hex_rgb(eyes)), (255, 255, 255, 255)
    p[CLOTH_D], p[CLOTH], p[CLOTH_L] = [f(c) for c in cloth_tones(outfit)]
    p[METAL_D], p[METAL], p[METAL_L] = f(hex_rgb("#7D8696")), f(hex_rgb("#B8C0CC")), f(hex_rgb("#E6EBF2"))
    p[LEATHER], p[GOLD], p[FX] = f(hex_rgb("#5B3B24")), f(hex_rgb("#E8BE58")), f(hex_rgb("#FFE58A"))
    p[GROUND] = (0, 0, 0, 80)
    p[AURA], p[AURA_L] = f(hex_rgb(aura)), f(tint(aura, 0.5))
    p[MAGIC], p[TRIM], p[DARK] = f(hex_rgb(aura)), f(hex_rgb(trim)), f(hex_rgb("#2A2733"))
    p[RED], p[GREEN] = f(hex_rgb("#C8303C")), f(hex_rgb("#66BB6A"))
    p[BIRD] = f(hex_rgb("#4FA3E0"))
    p[BLUSH] = f(hex_rgb("#F28CA0"))
    return p


def save_grid(rows, path, bg, s=4):
    from PIL import Image
    pad = 2
    cols = len(rows[0])
    img = Image.new("RGBA", (cols * (W * s + pad) + pad, len(rows) * (H * s + pad) + pad), (20, 20, 26, 255))
    for r, frames in enumerate(rows):
        for c, f in enumerate(frames):
            b = Image.new("RGBA", (W, H), bg)
            b.alpha_composite(f)
            img.paste(b.resize((W * s, H * s), Image.NEAREST), (pad + c * (W * s + pad), pad + r * (H * s + pad)))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)


TRIMS = {"druida": "#7BC47F", "necromante": "#5CF2A0"}

if __name__ == "__main__":
    root = os.path.dirname(os.path.abspath(__file__))
    assets = os.path.join(root, "..", "..", "apps", "mobile", "assets", "sprites", "hero")
    prev_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "out")
    only = sys.argv[2] if len(sys.argv) > 2 else None
    looks = [  # (kit, forma, cabelo, acessório, aura, raça)
        ("barbaro", "masculino", "moicano", "nenhum", None, "orc"),
        ("feiticeiro", "feminino", "longo", "nenhum", "#3DC8FF", "elfo"),
        ("clerigo", "masculino", "curto", "nenhum", None, "anao"),
        ("xama", "feminino", "tranca", "nenhum", None, "halfling"),
        ("metamorfo", "masculino", "espetado", "nenhum", "#F5E642", "draconato"),
        ("cronista", "feminino", "coque", "nenhum", None, "anao"),
        ("skald", "masculino", "curto", "capa", None, "humano"),
        ("inventor", "feminino", "curto", "nenhum", None, "elfo"),
        ("mercador", "masculino", "curto", "nenhum", None, "halfling"),
    ]
    for anim, (fn, fps, loop) in ANIMS.items():
        if only and anim != only:
            continue
        poses = fn()
        rows_by_frame = []
        names = []
        for name, f in layers():
            grids = [compose(f(dict(pose, n=n), n)) for n, pose in enumerate(poses)]
            if any(any(v for v in row) for g in grids for row in g):
                names.append(name)
                rows_by_frame.append(grids)
        write_atlas(rows_by_frame, names, assets, f"hero_{anim}", fps, loop)
        # grade de revisão: uma linha por visual de exemplo, uma coluna por frame
        grid_rows = []
        for li, look in enumerate(looks):
            pal = preview_palette(aura=look[4] or "#8B5CF6", trim=TRIMS.get(KITS[look[0]], "#E8BE58"),
                                  outfit=["#B7343F", "#3550A8", "#2F7A4F", "#6E3FB8", "#C9962B", "#23232B",
                                          "#16A99A", "#2F7A4F", "#6E3FB8"][li],
                                  skin=["#5E8C3A", "#F6D7C3", "#C98E66", "#A26B47", "#C2453A", "#E8B896",
                                        "#4E2F1E", "#F6D7C3", "#C98E66"][li],
                                  hair=["#5A3A22", "#9B5CF6", "#B5482A", "#1F1A17", "#E2B857", "#D7DCE3",
                                        "#3D7BFF", "#5A3A22", "#1F1A17"][li])
            frames = []
            for n in range(len(poses)):
                rows = {nm: rows_by_frame[k][n] for k, nm in enumerate(names)}
                frames.append(grid_to_rgba(stack(look, rows), pal))
            build_sheet(frames, prev_dir, f"{anim}_{li}_{look[0]}", fps, loop)
            grid_rows.append(frames)
        save_grid(grid_rows, os.path.join(prev_dir, f"grid_{anim}.png"),
                  bg=(236, 236, 240, 255) if os.environ.get("LIGHT") else (40, 40, 52, 255))
        print(anim, len(names), "camadas")
