#!/usr/bin/env python3
"""Membuat CSS override tema (terang & krem) dari CSS Tailwind terkompilasi (dist/app.css).
Tema utama (gelap) tidak diubah. Jalankan ulang setiap kali ada warna baru di kode."""
import re, colorsys, sys

THEMES = {
    'terang': dict(neut_hue=214, neut_sat=0.8, min_sat=0.22, acc_hue=203, acc_sat=0.78, acc_dl=-0.17, grad_shift=18),
    'krem':   dict(neut_hue=38,  neut_sat=1.25, min_sat=0.32, acc_hue=172, acc_sat=0.70, acc_dl=-0.2, grad_shift=-18),
}

def strip_comments(s): return re.sub(r'/\*.*?\*/', '', s, flags=re.S)

def parse_blocks(s):
    i, out = 0, []
    while i < len(s):
        j = s.find('{', i)
        if j < 0: break
        header = s[i:j].strip()
        depth, k = 1, j + 1
        while depth and k < len(s):
            c = s[k]
            depth += (c == '{') - (c == '}')
            k += 1
        body = s[j + 1:k - 1]
        if header.startswith('@'):
            if header.startswith(('@media', '@supports')):
                out.append(('at', header, parse_blocks(body)))
        else:
            out.append(('rule', header, body))
        i = k
    return out

RGB_SP = re.compile(r'rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:/\s*([^)]+?))?\s*\)')
RGB_CM = re.compile(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)')
HEX6 = re.compile(r'#([0-9a-fA-F]{6})\b')
HEX3 = re.compile(r'#([0-9a-fA-F]{3})\b(?![0-9a-fA-F])')

def alpha_num(a):
    if a is None: return 1.0
    a = a.strip()
    try: return float(a)
    except ValueError: return 1.0  # var(--tw-*-opacity) => opak

def hls(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    return h * 360, l, s

def to_rgb(h, l, s):
    l = max(0, min(1, l)); s = max(0, min(1, s))
    r, g, b = colorsys.hls_to_rgb((h % 360) / 360, l, s)
    return round(r * 255), round(g * 255), round(b * 255)

def clamp(v, lo, hi): return max(lo, min(hi, v))

def map_color(kind, r, g, b, alpha, gradient, prop, T):
    """kind: bg | border | text. Kembalikan (r,g,b) baru atau None bila tidak berubah."""
    if r == g == b == 0: return None  # lapisan hitam transparan tetap
    a = alpha_num(alpha)
    h, l, s = hls(r, g, b)
    neutral = s < 0.12 or (185 <= h <= 262 and s < 0.5)
    rose = (h >= 325 or h <= 18) and s >= 0.25
    amber = 18 < h <= 55 and s >= 0.25
    white = r == g == b == 255
    solid = a >= 0.9

    if white:
        if kind in ('bg', 'border') and a < 0.6: return (15, 23, 42)  # putih transparan -> tinta transparan
        if kind == 'text': return (15, 23, 42)
        return None
    if kind == 'shadow':
        return to_rgb(T['acc_hue'], 0.40, min(s, 0.8) * T['acc_sat']) if rose else None
    if kind == 'bg':
        if l >= 0.62: return None
        if neutral:
            if l <= 0.19: nl = clamp(0.945 + (l - 0.04) * 0.35, 0.94, 0.995)
            elif l <= 0.5: nl = 0.88 - (l - 0.2) * 0.5
            else: nl = 0.74 - (l - 0.5) * 0.3
            return to_rgb(T['neut_hue'], nl, max(min(s, 0.35) * T['neut_sat'], T['min_sat']))
        if l < 0.30:  # tint gelap -> tint terang
            return to_rgb(h, 0.93, min(s, 0.8) * 0.55)
        if amber and not gradient: return None  # amber solid = semantik (peringatan/DP), tetap
        if (rose or amber) and (gradient or solid):
            nh = T['acc_hue'] + (T['grad_shift'] if (amber or (gradient and prop.endswith('to'))) else 0)
            return to_rgb(nh, clamp(l + T['acc_dl'], 0.3, 0.55), s * T['acc_sat'])
        return to_rgb(h, l, s * 0.85)
    if kind == 'border':
        if neutral and l <= 0.5:
            return to_rgb(T['neut_hue'], clamp(0.92 - (l - 0.1) * 0.35, 0.78, 0.9), max(min(s, 0.3) * T['neut_sat'], T['min_sat'] * 0.8))
        if l < 0.30:
            return to_rgb(h, 0.82, min(s, 0.7) * 0.6)
        if rose and solid:
            return to_rgb(T['acc_hue'], clamp(l + T['acc_dl'], 0.35, 0.6), s * T['acc_sat'])
        return None
    if kind == 'text':
        if neutral and l >= 0.4:
            nl = clamp(0.08 + (1 - l) * 0.85, 0.08, 0.5) if l >= 0.55 else l - 0.08
            return to_rgb(T['neut_hue'], nl, min(s, 0.35))
        if (not neutral) and l >= 0.38 and s >= 0.3:
            nl = ((0.38 if rose else 0.30) - (l - 0.5) * 0.2) if l >= 0.5 else l - 0.17
            return to_rgb(h, clamp(nl, 0.22, 0.38 if rose else 0.32), s * (0.8 if rose else 0.9))
        return None
    return None

PROP_KIND = [
    (re.compile(r'^(background-color|background|--tw-gradient-from|--tw-gradient-to|--tw-gradient-via|--tw-gradient-stops|--tw-ring-offset-color)$'), 'bg'),
    (re.compile(r'^(border(-[a-z]+)*-color|outline-color|--tw-ring-color)$'), 'border'),
    (re.compile(r'^(color|caret-color|fill|stroke|text-decoration-color|accent-color)$'), 'text'),
    (re.compile(r'^--tw-shadow-color$'), 'shadow'),
]

def kind_of(prop):
    for rx, k in PROP_KIND:
        if rx.match(prop): return k
    return None

def map_value(value, kind, prop, T):
    gradient = prop.startswith('--tw-gradient')
    changed = [False]
    def rep(r, g, b, a, style):
        n = map_color(kind, int(r), int(g), int(b), a, gradient, prop, T)
        if n is None: return None
        changed[0] = True
        if kind == 'text' and a is not None:
            try:
                if float(a) < 0.85: a = '0.85'  # teks beralpha tipis sulit dibaca di latar terang
            except ValueError:
                pass
        if style == 'sp':
            return f'rgb({n[0]} {n[1]} {n[2]}' + (f' / {a.strip()}' if a is not None else '') + ')'
        if style == 'cm':
            return f'rgba({n[0]},{n[1]},{n[2]},{a})' if a is not None else f'rgb({n[0]},{n[1]},{n[2]})'
        return '#%02x%02x%02x' % n
    def f_sp(m): return rep(m.group(1), m.group(2), m.group(3), m.group(4), 'sp') or m.group(0)
    def f_cm(m): return rep(m.group(1), m.group(2), m.group(3), m.group(4), 'cm') or m.group(0)
    def f_hx(m):
        x = m.group(1); return rep(int(x[0:2], 16), int(x[2:4], 16), int(x[4:6], 16), None, 'hex') or m.group(0)
    def f_h3(m):
        x = m.group(1); return rep(int(x[0] * 2, 16), int(x[1] * 2, 16), int(x[2] * 2, 16), None, 'hex') or m.group(0)
    v = RGB_SP.sub(f_sp, value); v = RGB_CM.sub(f_cm, v); v = HEX6.sub(f_hx, v); v = HEX3.sub(f_h3, v)
    return v if changed[0] else None

def split_top(sel):
    parts, depth, cur = [], 0, ''
    for ch in sel:
        if ch in '([': depth += 1
        elif ch in ')]': depth -= 1
        if ch == ',' and depth == 0: parts.append(cur.strip()); cur = ''
        else: cur += ch
    if cur.strip(): parts.append(cur.strip())
    return parts

def emit(blocks, name, T, prefix, accents):
    out = []
    for b in blocks:
        if b[0] == 'at':
            inner = emit(b[2], name, T, prefix, accents)
            if inner: out.append(f'{b[1]}{{{"".join(inner)}}}')
            continue
        _, sel, body = b
        new = []
        for d in [x for x in body.split(';') if ':' in x]:
            prop, val = d.split(':', 1); prop = prop.strip(); val = val.strip()
            k = kind_of(prop)
            if not k: continue
            nv = map_value(val, k, prop, T)
            if nv: new.append(f'{prop}:{nv}')
        if new:
            sels = ','.join(f'{prefix} {s}' for s in split_top(sel))
            out.append(f'{sels}{{{";".join(new)}}}')
    return out

def collect_accent_classes(css):
    cls = set()
    for m in re.finditer(r'\.((?:bg|from|via|to)-(?:rose|red|emerald|green|teal|sky|blue|indigo|amber|orange)-(?:400|500|600|700|800)(?:\\/\d+)?)\s*[{,:]', css):
        cls.add(m.group(1))
    return sorted(cls)

def main(src, dst):
    css = strip_comments(open(src).read())
    blocks = parse_blocks(css)
    accents = collect_accent_classes(css)
    result = []
    for name, T in THEMES.items():
        prefix = f'html[data-theme="{name}"]'
        result += emit(blocks, name, T, prefix, accents)
        # teks putih tetap putih di atas isian aksen solid
        exc = ','.join(f'{prefix} .text-white.{c}' for c in accents if '\\/' not in c)
        if exc: result.append(f'{exc}{{color:#fff}}')
        blk = sorted(set(re.findall(r'\.(bg-black(?:\\/(?:[6-9][0-9]|100))?)\s*[{,:]', css)))
        if blk:
            sel = ','.join(f'{prefix} .{c}[class*="text-"]' for c in blk)
            result.append(f'{sel}{{color:#f1f5f9}}')
        result.append(f'{prefix}{{color-scheme:light}}')
    open(dst, 'w').write(''.join(result))
    print('tema css', len(''.join(result)) // 1024, 'KB; aksen', len(accents))

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'dist/app.css', sys.argv[2] if len(sys.argv) > 2 else 'dist/themes.css')
