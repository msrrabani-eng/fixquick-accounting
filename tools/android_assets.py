"""Write launcher icons and splash images into the generated Capacitor Android project.
Usage: python3 tools/android_assets.py [android/app/src/main/res]"""
import os, sys, glob
from PIL import Image, ImageDraw

RES = sys.argv[1] if len(sys.argv) > 1 else 'android/app/src/main/res'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
icon = Image.open(os.path.join(ROOT, 'resources/icon.png')).convert('RGBA')
splash_src = Image.open(os.path.join(ROOT, 'resources/splash.png')).convert('RGB')
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
if not os.path.isdir(RES):
    sys.exit('res folder not found: ' + RES)

def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True); img.save(path, optimize=True)

for d, k in DENS.items():
    n = round(48 * k)
    sq = icon.resize((n, n), Image.LANCZOS)
    save(sq, f'{RES}/mipmap-{d}/ic_launcher.png')
    mask = Image.new('L', (n, n), 0); ImageDraw.Draw(mask).ellipse((0, 0, n - 1, n - 1), fill=255)
    rnd = Image.new('RGBA', (n, n), (0, 0, 0, 0)); rnd.paste(sq, (0, 0), mask)
    save(rnd, f'{RES}/mipmap-{d}/ic_launcher_round.png')
    # adaptive foreground: 108dp canvas, artwork inside the 66dp safe zone
    f = round(108 * k); inner = round(66 * k)
    fg = Image.new('RGBA', (f, f), (0, 0, 0, 0)); art = icon.resize((inner, inner), Image.LANCZOS)
    fg.paste(art, ((f - inner) // 2, (f - inner) // 2), art)
    save(fg, f'{RES}/mipmap-{d}/ic_launcher_foreground.png')

os.makedirs(f'{RES}/values', exist_ok=True)
with open(f'{RES}/values/ic_launcher_background.xml', 'w', encoding='utf-8') as fh:
    fh.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>\n')

count = 0
for p in glob.glob(f'{RES}/drawable*/splash.png'):
    w, h = Image.open(p).size
    canvas = Image.new('RGB', (w, h), 'white')
    side = min(w, h); s = splash_src.resize((side, side), Image.LANCZOS)
    canvas.paste(s, ((w - side) // 2, (h - side) // 2)); canvas.save(p, optimize=True); count += 1
print(f'icons written for {len(DENS)} densities; {count} splash images replaced')
