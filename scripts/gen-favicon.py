"""
生成应用品牌图标 public/favicon.ico（仅此一处）。
概念：深空圆角块底 + 钢蓝「翻开的书」(教书育人) + 右上「上飞的星星」(评分之星上升/步步高升)。
严格遵循项目视觉规范：深空底 #070b14 + 钢蓝 #4a7ab5、纯色无渐变、不发光。

配色与 app/assets/css/main.css 的钢蓝体系、scripts/gen-pwa-icons.py 完全一致。
容器风格沿用现有 favicon：深空圆角矩形 + 钢蓝描边，保证「只换主体、不改整体观感」。

用法：python scripts/gen-favicon.py
产物：public/favicon.ico（多分辨率 16/24/32/48/64/128/256，逐尺寸重绘避免缩放模糊）
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

# ============ 配色（钢蓝体系，无渐变，全部纯色） ============
BG_DEEP      = (7, 11, 20, 255)     # #070b14 深空底
BORDER_STEEL = (74, 122, 181, 255)  # #4a7ab5 钢蓝描边
BOOK         = (74, 122, 181, 255)  # 右页（亮面）
BOOK_SHADE   = (58, 99, 150, 255)   # #3a6396 左页（暗面）/ 书脊
PAGE_LINE    = (147, 179, 214, 255) # #93b3d6 书页横线
STAR         = (194, 207, 224, 255) # #c2cfe0 浅钢蓝星星（深底上更跳）
STAR_TRAIL   = (194, 207, 224, 150) # 同色半透明拖尾，表达「飞出」

OUT_DIR = Path(__file__).resolve().parent.parent / "public"
SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def star_points(cx, cy, R, r, n=5, rot_deg=35):
    """5 角星多边形顶点。rot_deg=35 → 顶刺朝右上（上飞姿态）。"""
    pts = []
    for i in range(n * 2):
        ang = math.radians(-90 + rot_deg) + i * math.pi / n
        rad = R if i % 2 == 0 else r
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    return pts


def draw_favicon(size):
    scale = size / 256.0
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # ---- 容器：深空圆角块 + 钢蓝描边（与现有 favicon 一致） ----
    radius = int(size * 0.22)
    d.rounded_rectangle(
        (0, 0, size - 1, size - 1),
        radius=radius,
        fill=BG_DEEP,
        outline=BORDER_STEEL,
        width=max(1, size // 256),
    )

    cx = size / 2
    cy = size * 0.58  # 书略下沉，给上方星星留白
    W = 78 * scale            # 书半宽
    th = 26 * scale           # 书脊顶端到外缘顶端的抬高量（外缘更高）
    bh = 22 * scale           # 书脊底到外缘底的抬高
    rise = 13 * scale

    spine_top_y = cy - th
    spine_bot_y = cy + bh
    outer_top_y = cy - th - rise
    outer_bot_y = cy + bh - rise

    # ---- 翻开的书：左(暗)右(亮)两页 + 书脊 ----
    left_page = [
        (cx, spine_top_y),
        (cx - W, outer_top_y),
        (cx - W, outer_bot_y),
        (cx, spine_bot_y),
    ]
    right_page = [
        (cx, spine_top_y),
        (cx + W, outer_top_y),
        (cx + W, outer_bot_y),
        (cx, spine_bot_y),
    ]
    d.polygon(left_page, fill=BOOK_SHADE)
    d.polygon(right_page, fill=BOOK)
    # 书脊竖线
    d.line([(cx, spine_top_y), (cx, spine_bot_y)], fill=BOOK_SHADE, width=max(1, int(2 * scale)))

    # 每页 3 条书页横线（随页面斜面倾斜，纯色）
    lw = max(1, int(1.5 * scale))
    for f in (0.35, 0.55, 0.75):
        y_spine = spine_top_y + (spine_bot_y - spine_top_y) * f
        y_outer = outer_top_y + (outer_bot_y - outer_top_y) * f
        d.line([(cx, y_spine), (cx + W, y_outer)], fill=PAGE_LINE, width=lw)   # 右页
        d.line([(cx, y_spine), (cx - W, y_outer)], fill=PAGE_LINE, width=lw)   # 左页

    # ---- 上飞的星星（右上角） ----
    star_cx = cx + 44 * scale
    star_cy = cy - th - rise - 16 * scale
    R = max(30 * scale, size * 0.11)   # 小尺寸时相对放大，保证 16px 可辨
    r_in = R * 0.40

    # 拖尾：从星心朝左下（飞行反向），纯色半透明，不发光
    tw = max(1, int(2.4 * scale))
    d.line(
        [(star_cx - R * 0.95, star_cy + R * 0.95), (star_cx - R * 0.15, star_cy + R * 0.15)],
        fill=STAR_TRAIL,
        width=tw,
    )
    # 星体
    d.polygon(star_points(star_cx, star_cy, R, r_in, rot_deg=35), fill=STAR)

    return img


def save_ico(images, out_path):
    """把逐尺寸重绘的图集合并为多分辨率 ICO（用 append 保证各尺寸独立绘制、非缩放）。"""
    first, rest = images[0], images[1:]
    first.save(out_path, format="ICO", sizes=[(im.width, im.height) for im in images])
    for extra in rest:
        extra.save(out_path, format="ICO", append=True)


if __name__ == "__main__":
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    images = [draw_favicon(s) for s, _ in SIZES]
    ico_path = OUT_DIR / "favicon.ico"
    save_ico(images, str(ico_path))

    print(f"  生成 {ico_path}（{len(images)} 个尺寸：{', '.join(str(s) for s, _ in SIZES)}）")
    print("完成。")
