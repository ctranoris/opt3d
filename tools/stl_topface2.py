import struct
from collections import defaultdict

d = open("Opti Model.stl", "rb").read()
n = struct.unpack_from("<I", d, 80)[0]
tris = []
for i in range(n):
    vals = struct.unpack_from("<12fH", d, 84 + i * 50)
    v = vals[3:12]
    tris.append((vals[0:3], ((v[0], v[1], v[2]), (v[3], v[4], v[5]), (v[6], v[7], v[8]))))

top = [t for nz, t in tris if nz[2] > 0.9]

def q(p): return (round(p[0], 1), round(p[1], 1))
parent = {}
def find(a):
    while parent[a] != a:
        parent[a] = parent[parent[a]]; a = parent[a]
    return a
def union(a, b):
    ra, rb = find(a), find(b)
    if ra != rb: parent[ra] = rb
for t in top:
    ks = [q(p) for p in t]
    for k in ks:
        if k not in parent: parent[k] = k
    union(ks[0], ks[1]); union(ks[0], ks[2])
g = defaultdict(list)
for t in top: g[find(q(t[0]))].append(t)
comps = sorted(g.values(), key=lambda x: -len(x))
print("components:", [len(c) for c in comps])

ALL = [p for _, t in tris for p in t]
GX0, GX1 = min(p[0] for p in ALL), max(p[0] for p in ALL)
GY0, GY1 = min(p[1] for p in ALL), max(p[1] for p in ALL)
W, H = 150, 62
sx = (W - 1) / (GX1 - GX0); sy = (H - 1) / (GY1 - GY0)

for ci, c in enumerate(comps):
    # rasterize filled triangles by scanline in model space
    grid = [[" "] * W for _ in range(H)]
    ymin = min(p[1] for t in c for p in t); ymax = max(p[1] for t in c for p in t)
    for yy in range(H):
        y = GY0 + (H - 1 - yy) / sy
        xs = []
        for t in c:
            pts = t
            for a, b in ((0,1),(1,2),(2,0)):
                p0, p1 = pts[a], pts[b]
                if (p0[1] <= y < p1[1]) or (p1[1] <= y < p0[1]):
                    f = (y - p0[1]) / (p1[1] - p0[1])
                    xs.append(p0[0] + f * (p1[0] - p0[0]))
        xs.sort()
        for k in range(0, len(xs) - 1, 2):
            a, b = xs[k], xs[k+1]
            ia = int((a - GX0) * sx); ib = int((b - GX0) * sx)
            for xx in range(max(0, ia), min(W, ib + 1)):
                grid[yy][xx] = "#"
    print("=== component %d (%d tris)  full-panel raster, X %.1f..%.1f  Y %.1f..%.1f" %
          (ci, len(c), GX0, GX1, GY0, GY1))
    for row in grid: print("".join(row))
