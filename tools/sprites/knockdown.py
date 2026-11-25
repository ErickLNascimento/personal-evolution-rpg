"""Derrota dos chefes: o chefe é derrubado e fica caído (em vez de se dissolver).

Plano dos 12 frames (10 fps, sem loop; o app para no último):
  0 clarão branco (o golpe final) · 1–2 recuo e tremor, olhos espremidos · 3 anticipation: inclina
  para trás · 4–6 cai de lado girando em torno dos pés (smear rápido) · 7 impacto a 90° com poeira ·
  8 quique de 1 px · 9 assenta, corpo escurece, olhos fechados · 10–11 hold: deitado, olhos
  fechados e três estrelinhas de nocaute sobre a cabeça.

Cada gerador entrega a pose do frame (grade de índices de cor já composta) e os índices da sua
paleta; aqui só se gira, assenta, escurece e decora.
"""
import math

W = H = 64
GROUND = 59
ANGLE = [0, 0, 0, -6, 20, 45, 75, 90, 84, 90, 90, 90]
LIFT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]
# "slump" (chefes largos, que deitados viram um bloco): desaba no lugar, achatado contra o chão.
SQUASH_Y = [1, 1, 1, 1.06, 0.92, 0.8, 0.7, 0.6, 0.68, 0.64, 0.64, 0.64]
SQUASH_X = [1, 1, 1, 0.97, 1.03, 1.07, 1.1, 1.16, 1.12, 1.13, 1.13, 1.13]
TILT = [0, 0, 0, 0, 4, 8, 10, 12, 10, 11, 11, 11]
FRAMES = len(ANGLE)


def _bbox(g, skip):
    xs, ys = [], []
    for y in range(H):
        for x in range(W):
            if g[y][x] and g[y][x] not in skip:
                xs.append(x)
                ys.append(y)
    return (min(xs), min(ys), max(xs), max(ys)) if xs else (32, 32, 32, 32)


BIG = 192  # tela de trabalho maior: nada se perde ao girar antes de recortar
OFF = (BIG - W) // 2


def _rotate(g, angle, pivot, skip):
    """Gira a grade (vizinho mais próximo) em torno do pivô numa tela BIG×BIG; y para baixo,
    ângulo horário. Devolve a tela grande (coordenadas deslocadas de OFF)."""
    a = math.radians(angle)
    c, s = math.cos(a), math.sin(a)
    if abs(angle - 90) < 1e-9:
        c, s = 0.0, 1.0
    px, py = pivot
    out = [[0] * BIG for _ in range(BIG)]
    for Y in range(BIG):
        for X in range(BIG):
            x, y = X - OFF, Y - OFF
            dx, dy = x - px, y - py
            sx = round(px + c * dx + s * dy)
            sy = round(py - s * dx + c * dy)
            if 0 <= sx < W and 0 <= sy < H:
                v = g[sy][sx]
                if v and v not in skip:
                    out[Y][X] = v
    return out


def _scale_tilt(g, sx, sy, angle, anchor, skip):
    """Achata em torno do ponto de apoio (meio da base) e inclina um pouco, numa tela BIG×BIG."""
    a = math.radians(angle)
    c, s = math.cos(a), math.sin(a)
    ax, ay = anchor
    out = [[0] * BIG for _ in range(BIG)]
    for Y in range(BIG):
        for X in range(BIG):
            x, y = X - OFF - ax, Y - OFF - ay
            rx, ry = c * x + s * y, -s * x + c * y  # desfaz a inclinação
            srcx, srcy = round(ax + rx / sx), round(ay + ry / sy)
            if 0 <= srcx < W and 0 <= srcy < H:
                v = g[srcy][srcx]
                if v and v not in skip:
                    out[Y][X] = v
    return out


def _crop(big, dx, dy):
    """Recorta a tela grande para W×H, deslocando (dx, dy) em relação à posição original."""
    out = [[0] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            X, Y = x + OFF - dx, y + OFF - dy
            if 0 <= X < BIG and 0 <= Y < BIG:
                out[y][x] = big[Y][X]
    return out


def _bbox_big(big):
    xs, ys = [], []
    for Y, row in enumerate(big):
        for X, v in enumerate(row):
            if v:
                xs.append(X - OFF)
                ys.append(Y - OFF)
    return (min(xs), min(ys), max(xs), max(ys)) if xs else (32, 32, 32, 32)


def _shift(g, dx, dy):
    out = [[0] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if g[y][x]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H:
                    out[ny][nx] = g[y][x]
    return out


def _clean(g, outline):
    """Fecha furos de 1 px da rotação e refaz o contorno de 1 px por fora."""
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if not g[y][x]:
                n = [g[y - 1][x], g[y + 1][x], g[y][x - 1], g[y][x + 1]]
                if all(n):
                    fill = [v for v in n if v != outline]
                    g[y][x] = fill[0] if fill else outline
    add = []
    for y in range(H):
        for x in range(W):
            if g[y][x] and g[y][x] != outline:
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < W and 0 <= ny < H and not g[ny][nx]:
                        add.append((nx, ny))
    for x, y in add:
        g[y][x] = outline
    return g


def _cross(g, x, y, core, arm):
    for (dx, dy, c) in ((0, 0, core), (1, 0, arm), (-1, 0, arm), (0, 1, arm), (0, -1, arm)):
        if 0 <= x + dx < W and 0 <= y + dy < H:
            g[y + dy][x + dx] = c


def knockdown(n, pose, pal, style="fall", head=None):
    """Frame `n` da derrota.

    pose(n, eyes) → grade composta da pose (com sombra); eyes em 'squint' | 'closed' | 'normal'.
    pal: dict com outline, shadow, eye_l, gold, dust (lista de 2 cores), body (conjunto dos
    índices do corpo, para o clarão) e dim (mapa índice → índice mais escuro).
    style: "fall" (cai de lado e fica deitado) ou "slump" (desaba no lugar, achatado).
    head: onde fica a cabeça no fim, para as estrelinhas: "left", "center" ou "right"
    (padrão: "right" ao cair de lado, "center" ao desabar).
    """
    eyes = "closed" if n >= 9 else ("squint" if n >= 1 else "normal")
    g = pose(n, eyes)
    skip = {pal["shadow"]}
    x0, y0, x1, y1 = _bbox(g, skip)
    height = y1 - y0
    if n == 0:
        for y in range(H):
            for x in range(W):
                if g[y][x] in pal["body"]:
                    g[y][x] = pal["eye_l"]
    pivot = ((x0 + x1) / 2, y1)
    jitter = {1: 1, 2: -1}.get(n, 0)
    if style == "slump":
        big = _scale_tilt(g, SQUASH_X[n], SQUASH_Y[n], TILT[n], pivot, skip)
        bx0, by0, bx1, by1 = _bbox_big(big)
        body = _crop(big, round(32 - (bx0 + bx1) / 2) + jitter, GROUND - by1)
    else:
        angle = ANGLE[n]
        big = _rotate(g, angle, pivot, skip)
        # Ao deitar, o corpo se estende para a direita do pivô: recentra aos poucos conforme cai.
        t = max(0.0, min(1.0, angle / 90))
        final_shift = 32 - ((x0 + x1) / 2 + height / 2)
        bx0, by0, bx1, by1 = _bbox_big(big)
        body = _crop(big, round(final_shift * t) + jitter, (GROUND - LIFT[n]) - by1)
    body = _clean(body, pal["outline"])
    if n >= 9:
        body = [[pal["dim"].get(v, v) for v in row] for row in body]

    bx0, by0, bx1, by1 = _bbox(body, set())
    # sombra larga sob o corpo (desenhada antes, fica por baixo)
    out = [[0] * W for _ in range(H)]
    cx, rw = (bx0 + bx1) / 2, (bx1 - bx0) / 2 + 2
    for x in range(W):
        for y in (GROUND + 1, GROUND + 2):
            if ((x - cx) / rw) ** 2 + ((y - (GROUND + 1.5)) / 1.4) ** 2 <= 1 and y < H:
                out[y][x] = pal["shadow"]
    for y in range(H):
        for x in range(W):
            if body[y][x]:
                out[y][x] = body[y][x]

    if 7 <= n <= 9:  # poeira do impacto, abrindo para os lados
        spread = (n - 6) * 3
        for k, side in enumerate((-1, 1, -1, 1)):
            x = round((bx0 if side < 0 else bx1) + side * (spread + k))
            y = GROUND - (k % 2) - (n - 7)
            if 0 <= x < W and 0 <= y < H and not out[y][x]:
                out[y][x] = pal["dust"][k % 2]
    if n >= 10:  # estrelinhas de nocaute sobre a cabeça
        side = head or ("right" if style == "fall" else "center")
        hx = {"left": bx0 + 8, "right": bx1 - 6, "center": round((bx0 + bx1) / 2)}[side]
        # topo do corpo naquela coluna (a cabeça pode estar mais baixa que o resto)
        col = [y for y in range(H) if any(body[y][x] for x in range(max(0, hx - 3), min(W, hx + 4)))]
        hy = (min(col) if col else by0) - 5
        for k, (dx, dy) in enumerate(((-5, 1), (0, -2), (5, 1))):
            _cross(out, hx + dx, hy + dy, pal["eye_l"], pal["gold"])
    return out
