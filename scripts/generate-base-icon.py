#!/usr/bin/env python3
"""
Generates a simple 1024x1024 base icon PNG for Melody Clipboard using only
the Python standard library (struct + zlib), so no image-library dependency
is required. Feed the output to `tauri icon` to produce the full platform
icon set (see scripts/generate-icons.sh).

Design: a near-black rounded square with three accent-colored bars of
varying height (a minimal "waveform" mark), matching the app's dark,
minimal visual language.
"""
import struct
import zlib
import pathlib

SIZE = 1024
BG = (17, 17, 19, 255)  # near-black
ACCENT = (94, 209, 172, 255)  # muted teal accent
CORNER_RADIUS = 180


def in_rounded_rect(x, y, w, h, r):
    if x < r and y < r:
        return (x - r) ** 2 + (y - r) ** 2 <= r * r
    if x >= w - r and y < r:
        return (x - (w - r)) ** 2 + (y - r) ** 2 <= r * r
    if x < r and y >= h - r:
        return (x - r) ** 2 + (y - (h - r)) ** 2 <= r * r
    if x >= w - r and y >= h - r:
        return (x - (w - r)) ** 2 + (y - (h - r)) ** 2 <= r * r
    return True


def bar_rects():
    # Three vertical bars, centered, evenly spaced, varying heights.
    bar_width = 120
    gap = 90
    heights = [420, 620, 500]
    total_width = bar_width * 3 + gap * 2
    start_x = (SIZE - total_width) // 2
    rects = []
    for i, h in enumerate(heights):
        x0 = start_x + i * (bar_width + gap)
        x1 = x0 + bar_width
        y1 = SIZE // 2 + h // 2
        y0 = y1 - h
        rects.append((x0, y0, x1, y1, 60))
    return rects


def in_any_bar(x, y, rects):
    for (x0, y0, x1, y1, r) in rects:
        if x0 <= x < x1 and y0 <= y < y1:
            local_x = x - x0
            local_y = y - y0
            if in_rounded_rect(local_x, local_y, x1 - x0, y1 - y0, r):
                return True
    return False


def build_png(path: pathlib.Path):
    rects = bar_rects()
    rows = []
    for y in range(SIZE):
        row = bytearray()
        row.append(0)  # no filter
        for x in range(SIZE):
            if not in_rounded_rect(x, y, SIZE, SIZE, CORNER_RADIUS):
                row.extend((0, 0, 0, 0))
            elif in_any_bar(x, y, rects):
                row.extend(ACCENT)
            else:
                row.extend(BG)
        rows.append(bytes(row))
    raw = b"".join(rows)
    compressed = zlib.compress(raw, 9)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0)
    png = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")
    path.write_bytes(png)


if __name__ == "__main__":
    out = pathlib.Path(__file__).resolve().parent.parent / "icons-src" / "icon-base.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    build_png(out)
    print(f"Wrote {out}")
