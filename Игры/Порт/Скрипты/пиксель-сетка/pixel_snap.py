"""Python port of Sprite Fusion Pixel Snapper (MIT, Hugo Duprez)
https://github.com/Hugo-Dz/spritefusion-pixel-snapper — src/lib.rs, commit 02f9315.

Same pipeline and defaults: k-means++ quantization -> gradient edge profiles ->
step estimate from peak spacing -> elastic grid walker -> stabilize -> majority
vote per cell. RNG differs from the Rust ChaCha8 one, so palettes differ slightly.

usage: python3 pixel_snap.py in.png out.png [colors=16] [--pixel-size N] [--grid grid.png]
"""
import sys
import numpy as np
from PIL import Image, ImageDraw

CFG = dict(k=16, seed=42, iters=15, peak_thr=0.2, peak_dist=4, win_ratio=0.35,
           win_min=2.0, strength=0.5, min_cuts=4, fallback_segs=64, max_ratio=1.8)


def quantize(rgb, k, seed, iters):
    px = rgb.reshape(-1, 3).astype(np.float32)
    rng = np.random.default_rng(seed)
    # k-means++ init, on a sample for speed (full image is used for the final assignment)
    sample = px[rng.choice(len(px), min(len(px), 200_000), replace=False)]
    cents = [sample[rng.integers(len(sample))]]
    d = np.full(len(sample), np.inf, np.float32)
    for _ in range(1, k):
        d = np.minimum(d, ((sample - cents[-1]) ** 2).sum(1))
        cents.append(sample[rng.choice(len(sample), p=d / d.sum())] if d.sum() > 0
                     else sample[rng.integers(len(sample))])
    c = np.array(cents)
    prev = c.copy()
    for it in range(iters):
        lab = ((sample[:, None, :] - c[None]) ** 2).sum(2).argmin(1)
        for i in range(k):
            m = lab == i
            if m.any():
                c[i] = sample[m].mean(0)
        if it > 0 and ((c - prev) ** 2).sum(1).max() < 0.01:
            break
        prev = c.copy()
    lab = np.concatenate([((ch[:, None, :] - c[None]) ** 2).sum(2).argmin(1)
                          for ch in np.array_split(px, 32)])
    pal = np.round(c).astype(np.uint8)
    return pal[lab].reshape(rgb.shape), lab.reshape(rgb.shape[:2]), pal


def profiles(img):
    g = img.astype(np.float64) @ np.array([0.299, 0.587, 0.114])
    col = np.zeros(g.shape[1]); row = np.zeros(g.shape[0])
    col[1:-1] = np.abs(g[:, 2:] - g[:, :-2]).sum(0)
    row[1:-1] = np.abs(g[2:] - g[:-2]).sum(1)
    return col, row


def estimate_step(p):
    mx = p.max()
    if mx == 0:
        return None
    thr = mx * CFG['peak_thr']
    peaks = [i for i in range(1, len(p) - 1) if p[i] > thr and p[i] > p[i - 1] and p[i] > p[i + 1]]
    if len(peaks) < 2:
        return None
    clean = [peaks[0]]
    for q in peaks[1:]:
        if q - clean[-1] > CFG['peak_dist'] - 1:
            clean.append(q)
    if len(clean) < 2:
        return None
    diffs = sorted(np.diff(clean))
    return float(diffs[len(diffs) // 2])


def walk(p, step, limit):
    cuts, pos = [0], 0.0
    win = max(step * CFG['win_ratio'], CFG['win_min'])
    mean = p.mean()
    while pos < limit:
        t = pos + step
        if t >= limit:
            cuts.append(limit); break
        s, e = max(int(t - win), int(pos + 1)), min(int(t + win), limit)
        if e <= s:
            pos = t; continue
        i = s + int(np.argmax(p[s:e]))
        if p[i] > mean * CFG['strength']:
            cuts.append(i); pos = float(i)
        else:
            cuts.append(int(t)); pos = t
    return cuts


def sanitize(cuts, limit):
    return sorted(set([min(c, limit) for c in cuts] + [0, limit]))


def snap_uniform(p, limit, step, min_req):
    cells = max(int(round(limit / step)) if step > 0 else 0, min_req - 1, 1)
    cells = min(cells, limit)
    cw = limit / cells
    win = max(cw * CFG['win_ratio'], CFG['win_min'])
    mean = p.mean()
    cuts = [0]
    for idx in range(1, cells):
        t, prev = cw * idx, cuts[-1]
        if prev + 1 >= limit:
            break
        s = max(int(np.floor(t - win)), prev + 1, 0)
        e = min(int(np.ceil(t + win)), limit - 1)
        if e < s:
            s = e = prev + 1
        e = min(e, len(p) - 1)
        best = s + int(np.argmax(p[s:e + 1]))
        if p[best] < mean * CFG['strength']:
            f = int(round(t))
            f = max(f, prev + 1)
            if f >= limit:
                f = max(limit - 1, prev + 1)
            best = f
        cuts.append(best)
    return sanitize(cuts + [limit], limit)


def stabilize(p, cuts, limit, sib, sib_limit):
    cuts = sanitize(cuts, limit)
    min_req = min(max(CFG['min_cuts'], 2), limit + 1)
    ac, sc = len(cuts) - 1, len(sib) - 1
    sib_grid = sib_limit > 0 and sc >= min_req - 1 and sc > 0
    skew = False
    if sib_grid and ac > 0:
        r = (limit / ac) / (sib_limit / sc)
        skew = r > CFG['max_ratio'] or r < 1 / CFG['max_ratio']
    if len(cuts) >= min_req and not skew:
        return cuts
    step = sib_limit / sc if sib_grid else limit / CFG['fallback_segs']
    return snap_uniform(p, limit, step, min_req)


def snap(path_in, path_out, k=16, pixel_size=None, grid_out=None):
    src = Image.open(path_in).convert('RGB')
    rgb = np.array(src)
    h, w = rgb.shape[:2]
    q, lab, pal = quantize(rgb, k, CFG['seed'], CFG['iters'])
    px, py = profiles(q)
    if pixel_size:
        sx = sy = float(pixel_size)
    else:
        ex, ey = estimate_step(px), estimate_step(py)
        if ex and ey:
            r = max(ex, ey) / min(ex, ey)
            sx = sy = min(ex, ey) if r > CFG['max_ratio'] else (ex + ey) / 2
        else:
            sx = sy = ex or ey or max(min(w, h) / CFG['fallback_segs'], 1.0)
    rc, rr = walk(px, sx, w), walk(py, sy, h)
    cols = stabilize(px, rc, w, rr, h)
    rows = stabilize(py, rr, h, rc, w)
    cs, rs = w / (len(cols) - 1), h / (len(rows) - 1)
    if max(cs, rs) / min(cs, rs) > CFG['max_ratio']:
        t = min(cs, rs)
        if cs > t * 1.2: cols = snap_uniform(px, w, t, CFG['min_cuts'])
        if rs > t * 1.2: rows = snap_uniform(py, h, t, CFG['min_cuts'])
    # majority vote of quantized colours per cell (ties -> lowest palette index, close to Rust's)
    out = np.zeros((len(rows) - 1, len(cols) - 1), np.int64)
    for yi in range(len(rows) - 1):
        for xi in range(len(cols) - 1):
            cell = lab[rows[yi]:rows[yi + 1], cols[xi]:cols[xi + 1]].ravel()
            out[yi, xi] = np.bincount(cell, minlength=len(pal)).argmax()
    Image.fromarray(pal[out]).save(path_out)
    if grid_out:
        g = src.copy(); d = ImageDraw.Draw(g)
        for x in cols: d.line([(x, 0), (x, h)], fill=(80, 255, 140), width=1)
        for y in rows: d.line([(0, y), (w, y)], fill=(80, 255, 140), width=1)
        g.save(grid_out)
    return dict(step=round(sx, 2), size=(len(cols) - 1, len(rows) - 1), colors=len(pal))


if __name__ == '__main__':
    a = sys.argv[1:]
    ps = grid = None
    if '--pixel-size' in a:
        i = a.index('--pixel-size'); ps = float(a[i + 1]); del a[i:i + 2]
    if '--grid' in a:
        i = a.index('--grid'); grid = a[i + 1]; del a[i:i + 2]
    print(snap(a[0], a[1], int(a[2]) if len(a) > 2 else 16, ps, grid))
