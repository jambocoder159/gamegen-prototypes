#!/usr/bin/env python3
"""Measure the flat inner field of panel_board.png (and the flat inset of panel_cell.png)
by scanning alpha/colour, so the 4x4 grid can sit exactly inside the frame.
Prints fractions that are copied as constants into src/config/layout.ts."""
from PIL import Image
import numpy as np

def inner_field(path):
    im = Image.open(path).convert('RGBA')
    a = np.array(im).astype(int)
    H, W, _ = a.shape
    cx, cy = W // 2, H // 2
    center = a[cy, cx, :3]
    rgb = a[:, :, :3]
    dist = np.sqrt(((rgb - center) ** 2).sum(axis=2))
    mask = (dist < 18) & (a[:, :, 3] > 200)
    col = mask[:, cx]
    top, bot = cy, cy
    while top > 0 and col[top - 1]:
        top -= 1
    while bot < H - 1 and col[bot + 1]:
        bot += 1
    row = mask[cy, :]
    left, right = cx, cx
    while left > 0 and row[left - 1]:
        left -= 1
    while right < W - 1 and row[right + 1]:
        right += 1
    return W, H, left, top, right + 1, bot + 1, tuple(center)

for p in ['public/common/textures/panel_board.png', 'public/common/textures/panel_cell.png']:
    W, H, x0, y0, x1, y1, c = inner_field(p)
    print(p.split('/')[-1])
    print('  size', W, H, 'center colour', c)
    print('  inner px: x0=%d y0=%d x1=%d y1=%d  (w=%d h=%d)' % (x0, y0, x1, y1, x1 - x0, y1 - y0))
    print('  fractions: x0=%.4f y0=%.4f x1=%.4f y1=%.4f' % (x0 / W, y0 / H, x1 / W, y1 / H))
