"""
生成 PWA 图标（PNG 序列），统一项目宇宙科技风：
- 圆角矩形底：#070b14（深空蓝黑）
- 火箭：钢蓝 #4a7ab5 主体 + 浅蓝高光 + 白蓝尾焰（纯色分层，无渐变）
- 输出 192 / 512 / maskable(192,512) / apple-touch-icon(180)
用法：python scripts/gen-pwa-icons.py
"""
from PIL import Image, ImageDraw
from pathlib import Path

# ============ 配色（与项目 main.css 的钢蓝体系一致，无渐变） ============
BG_DEEP        = (7, 11, 20, 255)         # #070b14 深空底
BORDER_STEEL   = (74, 122, 181, 255)      # #4a7ab5 钢蓝描边
ROCKET_BODY    = (74, 122, 181, 255)      # 箭体
ROCKET_SHADE   = (58, 99, 150, 255)       # #3a6396 阴影面
ROCKET_WINDOW  = (147, 179, 214, 255)     # #93b3d6 窗口高光
FIN_DARK       = (49, 83, 126, 255)       # #31537e 尾翼
FLAME_OUTER    = (139, 153, 176, 160)     # #8b99b0 半透明外焰
FLAME_MID      = (194, 207, 224, 220)     # #c2cfe0 中焰
FLAME_INNER    = (234, 241, 249, 245)     # #eaf1f9 内焰核心

OUT_DIR = Path(__file__).resolve().parent.parent / "public"

def rounded_rect(draw, box, radius, fill, border=None, border_w=0):
    """画圆角矩形（fill + 可选描边），Pillow 没有原生 rounded rect，用 RoundedRectangle 插件或手工。
    Pillow 8.2+ 有 ImageDraw.rounded_rectangle。"""
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=border, width=border_w)

def draw_rocket(draw, cx, cy, scale=1.0, maskable=False):
    """在画布中心 (cx,cy) 绘制一个火箭，scale 控制大小。
    maskable=True 时，主体再内缩 20% 以适应 Android adaptive 图标的"安全区"。"""
    s = scale
    if maskable:
        s *= 0.6  # 安全区内缩
    # === 火焰（先画，在火箭底部之下） ===
    fx, fy = cx, cy + int(100 * s)
    # 三层椭圆，纯色叠加（不算渐变——每层是独立纯色形状）
    draw.ellipse([fx - int(46*s), fy - int(10*s), fx + int(46*s), fy + int(70*s)], fill=FLAME_OUTER)
    draw.ellipse([fx - int(30*s), fy - int(6*s),  fx + int(30*s), fy + int(54*s)], fill=FLAME_MID)
    draw.ellipse([fx - int(14*s), fy - int(2*s),  fx + int(14*s), fy + int(36*s)], fill=FLAME_INNER)

    # === 尾翼（左右各一） ===
    # 左尾翼：箭身左下的小三角
    body_top    = (cx,                cy - int(130 * s))  # 箭尖
    body_left   = (cx - int(28 * s),  cy - int(30 * s))
    body_right  = (cx + int(28 * s),  cy - int(30 * s))
    body_bottom = (cx,                cy + int(90 * s))   # 箭底
    # 左尾翼
    draw.polygon([
        (cx - int(28*s), cy - int(30*s)),
        (cx - int(60*s), cy + int(70*s)),
        (cx - int(28*s), cy + int(70*s)),
    ], fill=FIN_DARK)
    # 右尾翼
    draw.polygon([
        (cx + int(28*s), cy - int(30*s)),
        (cx + int(60*s), cy + int(70*s)),
        (cx + int(28*s), cy + int(70*s)),
    ], fill=FIN_DARK)

    # === 箭体（子弹型：尖头 + 矩形身） ===
    # 用一个 polygon 画出整体轮廓：尖 -> 右上 -> 右下 -> 尖底 -> 左下 -> 左上
    draw.polygon([
        body_top,
        (cx + int(28*s), cy - int(30*s)),
        (cx + int(28*s), cy + int(90*s)),
        body_bottom,
        (cx - int(28*s), cy + int(90*s)),
        (cx - int(28*s), cy - int(30*s)),
    ], fill=ROCKET_BODY)

    # 右阴影面（窄一点的暗色面，增强立体感，纯色）
    draw.polygon([
        (cx, cy - int(130*s)),
        (cx + int(28*s), cy - int(30*s)),
        (cx + int(28*s), cy + int(90*s)),
        cx, cy + int(90*s),
    ], fill=ROCKET_SHADE)

    # === 窗口（圆形） ===
    draw.ellipse([
        cx - int(16*s), cy - int(8*s),
        cx + int(16*s), cy + int(24*s),
    ], fill=ROCKET_WINDOW)
    # 窗口高光
    draw.ellipse([
        cx - int(12*s), cy - int(4*s),
        cx - int(2*s),  cy + int(8*s),
    ], fill=FLAME_INNER)

    # === 箭身分节线（细线，纯色） ===
    draw.line([
        (cx - int(28*s), cy + int(30*s)),
        (cx + int(28*s), cy + int(30*s)),
    ], fill=FIN_DARK, width=max(1, int(2*s)))

def make_icon(size: int, maskable: bool, out_name: str):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 圆角矩形底
    r = int(size * 0.22)  # 圆角约 22%
    rounded_rect(d, (0, 0, size-1, size-1), radius=r, fill=BG_DEEP,
                 border=BORDER_STEEL, border_w=max(1, size // 256))
    # 火箭：缩小并垂直居中，给火焰留底部空间
    draw_rocket(d, cx=size/2, cy=size*0.44, scale=size/360, maskable=maskable)
    out = OUT_DIR / out_name
    img.save(out, "PNG", optimize=True)
    print(f"  {out_name}  ({size}x{size}, maskable={maskable})")

if __name__ == "__main__":
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("生成 PWA 图标到 public/:")
    make_icon(192, maskable=False, out_name="pwa-192x192.png")
    make_icon(512, maskable=False, out_name="pwa-512x512.png")
    make_icon(192, maskable=True,  out_name="pwa-maskable-192x192.png")
    make_icon(512, maskable=True,  out_name="pwa-maskable-512x512.png")
    make_icon(180, maskable=False, out_name="apple-touch-icon.png")
    print("完成。")
