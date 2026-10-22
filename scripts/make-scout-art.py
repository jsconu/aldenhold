"""Usage: python scripts/make-scout-art.py <repo root> [preview.png]

Derive the scout's battle atlas from the painted archer figures: a slate-grey scouting cloak, and the realm's four
skin tones for both figures. Writes a 4x2 atlas (columns: fair, olive, brown, deep; rows: male, female)."""
import colorsys
import sys

from PIL import Image, ImageFilter

root, preview = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None
# The painted figures' own (fair) skin mid-tone. Other tones scale each skin pixel by target / FAIR per channel,
# which keeps all of the painted light and shade.
FAIR = (205, 150, 105)
SKINS = {
    "fair": None,
    "olive": (172, 122, 82),
    "brown": (128, 82, 54),
    "deep": (84, 52, 36),
}
# Face, neck and hand boxes in each 418 px archer cell (x0, y0, x1, y1).
BOXES = {
    "m": [],
    "f": [(185, 40, 255, 135), (190, 185, 232, 225), (250, 200, 290, 240)],
}


def is_skin(r, g, b, who):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    # The male figure's face is painted darker and warmer than the female's.
    if who == "m":
        return h <= 0.1 and 0.3 <= s <= 0.72 and v >= 0.42 and r > g > b
    return h <= 0.1 and 0.15 <= s <= 0.6 and v >= 0.5 and r > g > b


# The male archer has bare arms and a shaded face; skin there is found by growing a region from seed points on
# the skin, following the painted edges, instead of by boxes.
SEEDS = {"m": [(228, 118), (222, 128), (143, 142), (150, 150), (280, 152), (347, 158), (220, 147), (290, 155), (300, 158), (340, 150)], "f": []}


def grow(cell, seeds, tolerance=60, reach=40):
    px = cell.load()
    W, H = cell.size
    found = set()
    for sx, sy in seeds:
        base = px[sx, sy][:3]
        queue = [(sx, sy)]
        seen = {(sx, sy)}
        while queue:
            x, y = queue.pop()
            r, g, b, a = px[x, y]
            if a < 128 or sum((c - d) ** 2 for c, d in zip((r, g, b), base)) ** 0.5 > tolerance:
                continue
            found.add((x, y))
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and abs(nx - sx) <= reach and abs(ny - sy) <= reach:
                    seen.add((nx, ny))
                    queue.append((nx, ny))
    return found


def cloak(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if 0.12 <= h <= 0.45 and s > 0.18:
        # Green cloth becomes a weathered slate-grey cloak.
        nr, ng, nb = colorsys.hsv_to_rgb(0.58, min(0.22, s * 0.4), v * 0.95)
        return int(nr * 255), int(ng * 255), int(nb * 255)
    return r, g, b


def variant(cell, who, skin):
    out = cell.copy()
    px = out.load()
    W, H = out.size
    grown = grow(cell, SEEDS[who])
    # Close the grown region's pinholes and feather its edge, so the new skin blends instead of speckling.
    mask = Image.new("L", cell.size, 0)
    mp = mask.load()
    for (x, y) in grown:
        mp[x, y] = 255
    mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
    alpha_in = cell.split()[3]
    mp = mask.load()
    ap = alpha_in.load()
    grown = {(x, y) for x in range(cell.size[0]) for y in range(cell.size[1]) if mp[x, y] > 20 and ap[x, y] > 100}
    # Shading is kept relative to the skin's own average brightness, so light and shadow survive the recolour.
    lum = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    skin_px = [px[x, y] for (x, y) in grown] or [(200, 160, 130, 255)]
    mean = sum(lum(c) for c in skin_px) / len(skin_px)
    inside = lambda x, y: (x, y) in grown or any(x0 <= x < x1 and y0 <= y < y1 for x0, y0, x1, y1 in BOXES[who])
    target = SKINS[skin]
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a < 10:
                continue
            if target and ((x, y) in grown or (inside(x, y) and is_skin(r, g, b, who))):
                k = mp[x, y] / 255 if (x, y) in grown else 1
                nr, ng, nb = (max(0, min(255, int(o * t / f))) for o, t, f in zip((r, g, b), target, FAIR))
                r, g, b = (int(o + (n - o) * k) for o, n in ((r, nr), (g, ng), (b, nb)))
            else:
                r, g, b = cloak(r, g, b)
            px[x, y] = (r, g, b, a)
    return out


cells = {}
for who, f in [("m", "humans-v1"), ("f", "humans-female-v1")]:
    im = Image.open(f"{root}/public/assets/battle/{f}.png").convert("RGBA")
    w = im.size[0] // 3
    cells[who] = im.crop((2 * w, 0, 3 * w, w))
w = cells["m"].size[0]
atlas = Image.new("RGBA", (4 * w, 2 * w), (0, 0, 0, 0))
for row, who in enumerate(["m", "f"]):
    for col, skin in enumerate(SKINS):
        atlas.paste(variant(cells[who], who, skin), (col * w, row * w))
atlas.save(f"{root}/public/assets/battle/scouts-v1.png", optimize=True)
if preview:
    bg = Image.new("RGBA", atlas.size, (60, 70, 55, 255))
    bg.alpha_composite(atlas)
    bg.resize((atlas.size[0] // 2, atlas.size[1] // 2)).save(preview)
print("ok", atlas.size)
