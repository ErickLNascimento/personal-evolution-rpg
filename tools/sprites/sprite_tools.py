"""Ferramentas de spritesheet pixel art.

Os sprites do herói são desenhados com ÍNDICES de paleta (não cores). O app troca
os índices pelas cores escolhidas pelo usuário (pele, olhos, cabelo, roupa) num
shader do Skia, então um único PNG serve para todas as combinações.

- `write_index_sheet`: grava o PNG do app (canal R = índice * INDEX_STEP, alfa 255)
  e o JSON com os metadados.
- `build_sheet`: gera os previews coloridos (GIF + contact sheet) para revisão.
"""
import json
import os

from PIL import Image, ImageDraw

INDEX_STEP = 9  # R = índice * 9 (até 28 índices cabem em 0..255)


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def shade(h, f):
    return tuple(max(0, min(255, round(v * f))) for v in hex_rgb(h))


def tint(h, a):
    return tuple(round(v + (255 - v) * a) for v in hex_rgb(h))


def new_frame(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def grid_to_rgba(grid, palette):
    """grid[y][x] = índice; palette[i] = (r, g, b, a)."""
    h, w = len(grid), len(grid[0])
    img = new_frame(w, h)
    px = img.load()
    for y in range(h):
        for x in range(w):
            i = grid[y][x]
            if i:
                px[x, y] = palette[i]
    return img


def grid_to_index(grid):
    h, w = len(grid), len(grid[0])
    img = new_frame(w, h)
    px = img.load()
    for y in range(h):
        for x in range(w):
            i = grid[y][x]
            if i:
                px[x, y] = (i * INDEX_STEP, 0, 0, 255)
    return img


MAX_ROWS_PER_COLUMN = 60  # 60 × 48 px = 2880 px: cabe no limite de 4096 px de textura


def write_atlas(rows, names, out_dir, name, fps, loop):
    """Atlas de camadas em colunas: cada camada ocupa uma faixa de frames (frameCount × 48 px)
    numa coluna; a coluna seguinte começa quando a anterior enche (limite de textura dos celulares)."""
    os.makedirs(out_dir, exist_ok=True)
    h, w = len(rows[0][0]), len(rows[0][0][0])
    count = len(rows[0])
    cols = (len(rows) + MAX_ROWS_PER_COLUMN - 1) // MAX_ROWS_PER_COLUMN
    per_col = min(len(rows), MAX_ROWS_PER_COLUMN)
    sheet = Image.new("RGBA", (w * count * cols, h * per_col), (0, 0, 0, 0))
    layers = {}
    for r, grids in enumerate(rows):
        col, row = divmod(r, MAX_ROWS_PER_COLUMN)
        layers[names[r]] = [col, row]
        for i, g in enumerate(grids):
            sheet.paste(grid_to_index(g), ((col * count + i) * w, row * h))
    sheet.save(os.path.join(out_dir, f"{name}.png"), optimize=True)
    meta = {"image": f"{name}.png", "frameWidth": w, "frameHeight": h, "frameCount": count,
            "fps": fps, "loop": loop, "indexStep": INDEX_STEP, "layers": layers}
    with open(os.path.join(out_dir, f"{name}.json"), "w", newline="\n") as fh:
        json.dump(meta, fh, indent=2)
        fh.write("\n")


def write_index_sheet(grids, out_dir, name, fps, loop):
    os.makedirs(out_dir, exist_ok=True)
    frames = [grid_to_index(g) for g in grids]
    w, h = frames[0].size
    sheet = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * w, 0))
    sheet.save(os.path.join(out_dir, f"{name}.png"), optimize=True)
    meta = {"image": f"{name}.png", "frameWidth": w, "frameHeight": h,
            "frameCount": len(frames), "fps": fps, "loop": loop, "indexStep": INDEX_STEP}
    with open(os.path.join(out_dir, f"{name}.json"), "w", newline="\n") as fh:
        json.dump(meta, fh, indent=2)
        fh.write("\n")


def build_sheet(frames, out_dir, name, fps=12, loop=True, preview_scale=8, bg=(40, 40, 52, 255)):
    """Previews: GIF animado e contact sheet com o número de cada frame."""
    w, h = frames[0].size
    assert all(f.size == (w, h) for f in frames), "todos os frames precisam ter o mesmo tamanho"
    prev = os.path.join(out_dir, "_preview")
    os.makedirs(prev, exist_ok=True)
    s = preview_scale
    big = []
    for f in frames:
        b = Image.new("RGBA", (w, h), bg)
        b.alpha_composite(f)
        big.append(b.resize((w * s, h * s), Image.NEAREST))
    big[0].save(os.path.join(prev, f"{name}.gif"), save_all=True, append_images=big[1:],
                duration=int(1000 / fps), loop=0, disposal=2)
    cols = min(len(frames), 6)
    rows = (len(frames) + cols - 1) // cols
    pad = 4
    cs = Image.new("RGBA", (cols * (w * s + pad) + pad, rows * (h * s + pad + 14) + pad), (20, 20, 26, 255))
    d = ImageDraw.Draw(cs)
    for i, b in enumerate(big):
        x = pad + (i % cols) * (w * s + pad)
        y = pad + (i // cols) * (h * s + pad + 14)
        d.text((x, y), str(i), fill=(220, 220, 220, 255))
        cs.paste(b, (x, y + 14))
    cs_path = os.path.join(prev, f"{name}_contact.png")
    cs.save(cs_path)
    return cs_path
