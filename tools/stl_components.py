import struct, sys
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

CELL = float(sys.argv[1]) if len(sys.argv) > 1 else 2.0

for ci, c in enumerate(comps[:8]):
    pts = [p for t in c for p in t]
    x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
    y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
    sx = 1.0 / CELL; sy = 1.0 / CELL
    W = int((x1 - x0) * sx) + 2; H = int((y1 - y0) * sy) + 2
    if W > 200:
        sx *= 200 / W; sy *= 200 / W; W = 200; H = int((y1 - y0) * sy) + 2
    grid = [[" "] * W for _ in range(H)]
    for yy in range(H):
        y = y0 + (H - 1 - yy) / sy
        xs = []
        for t in c:
            for a, b in ((0,1),(1,2),(2,0)):
                p0, p1 = t[a], t[b]
                if (p0[1] <= y < p1[1]) or (p1[1] <= y < p0[1]):
                    f = (y - p0[1]) / (p1[1] - p0[1])
                    xs.append(p0[0] + f * (p1[0] - p0[0]))
        xs.sort()
        for k in range(0, len(xs) - 1, 2):
            ia = int((xs[k] - x0) * sx); ib = int((xs[k+1] - x0) * sx)
            for xx in range(max(0, ia), min(W, ib + 1)):
                grid[yy][xx] = "#"
    print("=== comp %d  tris=%d  X[%.1f..%.1f]=%.1f  Y[%.1f..%.1f]=%.1f  ratio h/w=%.2f"
          % (ci, len(c), x0, x1, x1-x0, y0, y1, y1-y0, (y1-y0)/(x1-x0)))
    for row in grid: print("".join(row))
    print()
