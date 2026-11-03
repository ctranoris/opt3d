import struct, sys

d = open("Opti Model.stl", "rb").read()
n = struct.unpack_from("<I", d, 80)[0]
tris = []
for i in range(n):
    v = struct.unpack_from("<12fH", d, 84 + i * 50)[3:12]
    tris.append(((v[0], v[1], v[2]), (v[3], v[4], v[5]), (v[6], v[7], v[8])))

pts = [p for t in tris for p in t]
mn = [min(p[c] for p in pts) for c in range(3)]
mx = [max(p[c] for p in pts) for c in range(3)]

def view(a, b, W=110, H=44, label=""):
    grid = [[" "] * W for _ in range(H)]
    sa = (W - 1) / (mx[a] - mn[a] or 1)
    sb = (H - 1) / (mx[b] - mn[b] or 1)
    for t in tris:
        for k in range(3):
            x = int((t[k][a] - mn[a]) * sa)
            y = H - 1 - int((t[k][b] - mn[b]) * sb)
            grid[y][x] = "."
        # fill edges
        for k in range(3):
            p0, p1 = t[k], t[(k + 1) % 3]
            x0 = int((p0[a] - mn[a]) * sa); y0 = H - 1 - int((p0[b] - mn[b]) * sb)
            x1 = int((p1[a] - mn[a]) * sa); y1 = H - 1 - int((p1[b] - mn[b]) * sb)
            steps = max(abs(x1 - x0), abs(y1 - y0), 1)
            for s in range(steps + 1):
                x = x0 + (x1 - x0) * s // steps
                y = y0 + (y1 - y0) * s // steps
                if 0 <= y < H and 0 <= x < W:
                    grid[y][x] = "#"
    print("=== %s  axes %s-%s   span %.1f x %.1f  (min %.1f,%.1f max %.1f,%.1f)" %
          (label, "XYZ"[a], "XYZ"[b], mx[a]-mn[a], mx[b]-mn[b], mn[a], mn[b], mx[a], mx[b]))
    for row in grid:
        print("".join(row))
    print()

view(0, 2, label="profile (bow-stern vs height)")
view(1, 2, label="transverse (beam vs height)")
view(0, 1, label="plan (length vs beam)")
