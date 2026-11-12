"""Generate custom Frostbound Outpost launcher icons (master + adaptive layers)."""

from __future__ import annotations

import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
SS = 2  # Supersampling factor for crisp anti-aliased edges
CANVAS = SIZE * SS


def lerp_color(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return (
        int(c1[0] + (c2[0] - c1[0]) * t),
        int(c1[1] + (c2[1] - c1[1]) * t),
        int(c1[2] + (c2[2] - c1[2]) * t),
    )


def create_background() -> Image.Image:
    img = Image.new("RGBA", (CANVAS, CANVAS), (10, 25, 47, 255))
    draw = ImageDraw.Draw(img)

    top = (10, 22, 46)
    mid = (16, 62, 108)
    bot = (34, 138, 198)

    for y in range(CANVAS):
        ratio = y / (CANVAS - 1)
        if ratio < 0.55:
            col = lerp_color(top, mid, ratio / 0.55)
        else:
            col = lerp_color(mid, bot, (ratio - 0.55) / 0.45)
        draw.line([(0, y), (CANVAS, y)], fill=(*col, 255))

    # Subtle radial aurora glow in the center
    glow = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    cx, cy = CANVAS // 2, int(CANVAS * 0.48)
    for r in range(int(CANVAS * 0.48), 20, -24):
        alpha = int(18 * (1 - r / (CANVAS * 0.5)))
        gdraw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(56, 189, 248, max(0, alpha)))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=45))
    img = Image.alpha_composite(img, glow)
    draw = ImageDraw.Draw(img)

    # Distant arctic mountain ridges
    draw.polygon(
        [
            (0, int(CANVAS * 0.78)),
            (int(CANVAS * 0.22), int(CANVAS * 0.54)),
            (int(CANVAS * 0.45), int(CANVAS * 0.72)),
            (int(CANVAS * 0.72), int(CANVAS * 0.50)),
            (CANVAS, int(CANVAS * 0.74)),
            (CANVAS, CANVAS),
            (0, CANVAS),
        ],
        fill=(15, 44, 78, 255),
    )

    # Snow ground band at bottom
    draw.polygon(
        [
            (0, int(CANVAS * 0.80)),
            (int(CANVAS * 0.30), int(CANVAS * 0.76)),
            (int(CANVAS * 0.65), int(CANVAS * 0.81)),
            (CANVAS, int(CANVAS * 0.75)),
            (CANVAS, CANVAS),
            (0, CANVAS),
        ],
        fill=(226, 242, 255, 255),
    )

    # Subtle falling snow dots
    rng = random.Random(42)
    for _ in range(55):
        sx = rng.randint(40, CANVAS - 40)
        sy = rng.randint(40, int(CANVAS * 0.82))
        sr = rng.randint(4, 11)
        alpha = rng.randint(90, 210)
        draw.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=(248, 250, 252, alpha))

    return img


def draw_pine(draw: ImageDraw.ImageDraw, cx: float, base_y: float, w: float, h: float) -> None:
    # Trunk
    tw = w * 0.16
    draw.rectangle([cx - tw, base_y - h * 0.15, cx + tw, base_y + h * 0.04], fill=(120, 63, 24, 255))
    # 3 foliage tiers + snow caps
    tiers = [
        (0.10, 0.48, 0.50),
        (0.32, 0.72, 0.40),
        (0.56, 1.00, 0.30),
    ]
    for y0_f, y1_f, half_w_f in tiers:
        y_bot = base_y - h * y0_f
        y_top = base_y - h * y1_f
        hw = w * half_w_f
        draw.polygon([(cx, y_top), (cx - hw, y_bot), (cx + hw, y_bot)], fill=(17, 94, 118, 255))
        # Snow highlight on top half
        cap_y = y_top + (y_bot - y_top) * 0.50
        cap_hw = hw * 0.48
        draw.polygon([(cx, y_top), (cx - cap_hw, cap_y), (cx + cap_hw, cap_y)], fill=(240, 249, 255, 255))


def draw_axe(img: Image.Image, center: tuple[float, float], angle_deg: float, scale: float) -> Image.Image:
    layer = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = center
    s = scale

    # Wooden handle vertical before rotation
    hw = 22 * s
    hh_top = -300 * s
    hh_bot = 290 * s
    d.rounded_rectangle([cx - hw, cy + hh_top, cx + hw, cy + hh_bot], radius=14 * s, fill=(180, 83, 9, 255))
    d.rounded_rectangle([cx - hw, cy + hh_top, cx - 2 * s, cy + hh_bot], radius=10 * s, fill=(217, 119, 6, 255))

    # Pommel grip
    d.rounded_rectangle([cx - hw * 1.2, cy + hh_bot - 65 * s, cx + hw * 1.2, cy + hh_bot + 10 * s], radius=12 * s, fill=(120, 53, 15, 255))

    # Axe head (right side + collar)
    collar = [cx - 32 * s, cy - 235 * s, cx + 36 * s, cy - 135 * s]
    d.rounded_rectangle(collar, radius=10 * s, fill=(71, 85, 105, 255))

    blade = [
        (cx + 24 * s, cy - 220 * s),
        (cx + 165 * s, cy - 285 * s),
        (cx + 215 * s, cy - 185 * s),
        (cx + 175 * s, cy - 85 * s),
        (cx + 24 * s, cy - 145 * s),
    ]
    d.polygon(blade, fill=(203, 213, 225, 255))

    # Frost steel edge highlight
    edge = [
        (cx + 145 * s, cy - 275 * s),
        (cx + 175 * s, cy - 288 * s),
        (cx + 224 * s, cy - 185 * s),
        (cx + 182 * s, cy - 82 * s),
        (cx + 148 * s, cy - 98 * s),
        (cx + 184 * s, cy - 185 * s),
    ]
    d.polygon(edge, fill=(248, 250, 252, 255))

    rotated = layer.rotate(angle_deg, resample=Image.Resampling.BICUBIC, center=(cx, cy))
    return Image.alpha_composite(img, rotated)


def create_foreground() -> Image.Image:
    img = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = CANVAS / 2, CANVAS / 2

    # Safe zone radius ~ 30% of canvas (total 60% diameter)
    # Outpost shield/crest
    outer_pts = [
        (cx, cy - 580),
        (cx + 470, cy - 410),
        (cx + 430, cy + 160),
        (cx, cy + 560),
        (cx - 430, cy + 160),
        (cx - 470, cy - 410),
    ]
    # Drop shadow behind crest
    shadow_layer = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow_layer)
    sdraw.polygon([(x, y + 26) for (x, y) in outer_pts], fill=(2, 6, 23, 150))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=28))
    img = Image.alpha_composite(img, shadow_layer)
    draw = ImageDraw.Draw(img)

    # Shield ice rim + inner fill
    draw.polygon(outer_pts, fill=(125, 211, 252, 255))
    inner_pts = [(cx + (x - cx) * 0.90, cy + (y - cy) * 0.90) for (x, y) in outer_pts]
    draw.polygon(inner_pts, fill=(15, 38, 66, 255))

    # Flanking snowy pines inside crest
    draw_pine(draw, cx - 205, cy + 175, 210, 390)
    draw_pine(draw, cx + 205, cy + 175, 210, 390)

    # Central prominent crossed frost axe
    img = draw_axe(img, (cx - 10, cy - 10), angle_deg=-38, scale=1.18)
    draw = ImageDraw.Draw(img)

    # Warm campfire hearth at lower center of shield
    # Crossed campfire logs
    log_y = cy + 255
    draw.rounded_rectangle([cx - 155, log_y - 22, cx + 155, log_y + 22], radius=16, fill=(120, 53, 15, 255))
    draw.rounded_rectangle([cx - 135, log_y + 10, cx + 135, log_y + 52], radius=16, fill=(92, 40, 12, 255))

    # Warm glow behind flame
    fglow = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    fgdraw = ImageDraw.Draw(fglow)
    fy = cy + 150
    for r in range(210, 20, -20):
        a = int(38 * (1 - r / 220))
        fgdraw.ellipse([cx - r, fy - r, cx + r, fy + r], fill=(249, 115, 22, max(0, a)))
    fglow = fglow.filter(ImageFilter.GaussianBlur(radius=24))
    img = Image.alpha_composite(img, fglow)
    draw = ImageDraw.Draw(img)

    # Outer orange flame
    draw.polygon(
        [
            (cx, cy - 15),
            (cx + 115, cy + 135),
            (cx + 85, cy + 245),
            (cx, cy + 275),
            (cx - 85, cy + 245),
            (cx - 115, cy + 135),
        ],
        fill=(234, 88, 12, 255),
    )
    # Mid amber flame
    draw.polygon(
        [
            (cx, cy + 45),
            (cx + 78, cy + 155),
            (cx + 55, cy + 240),
            (cx, cy + 260),
            (cx - 55, cy + 240),
            (cx - 78, cy + 155),
        ],
        fill=(245, 158, 11, 255),
    )
    # Inner bright yellow core
    draw.polygon(
        [
            (cx, cy + 115),
            (cx + 42, cy + 185),
            (cx + 26, cy + 240),
            (cx, cy + 250),
            (cx - 26, cy + 240),
            (cx - 42, cy + 185),
        ],
        fill=(254, 240, 138, 255),
    )

    return img


def main() -> None:
    out_dir = os.path.join("assets", "icon")
    os.makedirs(out_dir, exist_ok=True)

    bg = create_background()
    fg = create_foreground()
    master = Image.alpha_composite(bg, fg)

    bg_out = bg.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    fg_out = fg.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    master_out = master.resize((SIZE, SIZE), Image.Resampling.LANCZOS).convert("RGB")

    bg_out.save(os.path.join(out_dir, "app_icon_background.png"), "PNG")
    fg_out.save(os.path.join(out_dir, "app_icon_foreground.png"), "PNG")
    master_out.save(os.path.join(out_dir, "app_icon.png"), "PNG")
    print("Generated icons in", out_dir)


if __name__ == "__main__":
    main()
