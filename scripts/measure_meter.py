"""Measure the flat interior channel of panel_meter.png (the fuel-bar fill area).
Prints fractional bounds to paste into src/config/layout.ts. Run once; not shipped.
Finds the contiguous dark-purple run through the panel centre so the frame border
and the drop shadow underneath are excluded."""
from PIL import Image

im = Image.open('public/common/textures/panel_meter.png').convert('RGBA')
w, h = im.size
px = im.load()


def is_channel(p):
    r, g, b, a = p
    return a > 200 and 60 < b < 160 and r < 95 and g < 75 and b > r + 15


cy, cx = h // 2, w // 2

# contiguous horizontal run through the centre
x = cx
while x > 0 and is_channel(px[x - 1, cy]):
    x -= 1
left = x
x = cx
while x < w - 1 and is_channel(px[x + 1, cy]):
    x += 1
right = x

# contiguous vertical run through the centre
y = cy
while y > 0 and is_channel(px[cx, y - 1]):
    y -= 1
top = y
y = cy
while y < h - 1 and is_channel(px[cx, y + 1]):
    y += 1
bottom = y

print('size', w, h)
print('left', left, round(left / w, 4))
print('right', right, round((right + 1) / w, 4))
print('top', top, round(top / h, 4))
print('bottom', bottom, round((bottom + 1) / h, 4))
