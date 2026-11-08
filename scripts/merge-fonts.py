"""
Scala pliki WOFF/TTF latin + latin-ext w jeden TTF z pełną obsługą polskich znaków.
Używa fontTools do parsowania i scalania tabel glyf/cmap.
"""

import sys
import os
from fontTools.ttLib import TTFont
from fontTools.merge import Merger

ROOT = os.path.join(os.path.dirname(__file__), '..')
FONTSOURCE = os.path.join(ROOT, 'node_modules/@fontsource/roboto/files')
OUT = os.path.join(ROOT, 'public/fonts')

os.makedirs(OUT, exist_ok=True)

variants = [
    {
        'name': 'roboto-regular',
        'woff_base': 'roboto-latin-400-normal.woff',
        'woff_ext':  'roboto-latin-ext-400-normal.woff',
    },
    {
        'name': 'roboto-bold',
        'woff_base': 'roboto-latin-700-normal.woff',
        'woff_ext':  'roboto-latin-ext-700-normal.woff',
    },
    {
        'name': 'roboto-italic',
        'woff_base': 'roboto-latin-400-italic.woff',
        'woff_ext':  'roboto-latin-ext-400-italic.woff',
    },
]

for v in variants:
    base_path = os.path.join(FONTSOURCE, v['woff_base'])
    ext_path  = os.path.join(FONTSOURCE, v['woff_ext'])
    out_path  = os.path.join(OUT, v['name'] + '.ttf')

    if not os.path.exists(base_path):
        print('MISSING: ' + v['woff_base'])
        continue
    if not os.path.exists(ext_path):
        print('MISSING: ' + v['woff_ext'])
        continue

    try:
        merger = Merger()
        merged = merger.merge([base_path, ext_path])
        merged.save(out_path)

        # Weryfikacja — sprawdź czy polskie znaki są w cmap
        f = TTFont(out_path)
        cmap = f.getBestCmap()
        polish = [0x0105, 0x0107, 0x0119, 0x0142, 0x0144, 0x015B, 0x017A, 0x017C]  # ą ć ę ł ń ś ź ż
        missing = [hex(cp) for cp in polish if cp not in cmap]
        ok = '✓' if not missing else f'⚠ brak: {missing}'
        has_pl = "TAK" if not missing else "BRAK " + str(missing)
        print(f'OK {v["name"]}.ttf ({os.path.getsize(out_path)} bytes, polskie: {has_pl})')
        f.close()

    except Exception as e:
        print(f'ERR {v["name"]}: {e}')

print('Done.')
