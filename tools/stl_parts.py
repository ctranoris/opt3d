import struct
from collections import defaultdict

d = open("Opti Model.stl", "rb").read()
n = struct.unpack_from("<I", d, 80)[0]
tris = []
for i in range(n):
    v = struct.unpack_from("<12fH", d, 84 + i * 50)[3:12]
    tris.append(((v[0], v[1], v[2]), (v[3], v[4], v[5]), (v[6], v[7], v[8])))

def q(p):
    return (round(p[0], 2), round(p[1], 2), round(p[2], 2))

# union-find on quantized vertices (3D) -> connected solids
parent = {}
def find(a):
    while parent[a] != a:
        parent[a] = parent[parent[a]]
        a = parent[a]
    return a
def union(a, b):
    ra, rb = find(a), find(b)
    if ra != rb:
        parent[ra] = rb

for t in tris:
    for p in t:
        k = q(p)
        if k not in parent:
            parent[k] = k
    ks = [q(p) for p in t]
    union(ks[0], ks[1]); union(ks[0], ks[2])

groups = defaultdict(list)
for t in tris:
    groups[find(q(t[0]))].append(t)

print("components:", len(groups))
comps = sorted(groups.values(), key=lambda g: -len(g))
for ci, g in enumerate(comps):
    pts = [p for t in g for p in t]
    mn = [min(p[c] for p in pts) for c in range(3)]
    mx = [max(p[c] for p in pts) for c in range(3)]
    print("--- comp %d  tris=%d  X[%.1f,%.1f] Y[%.1f,%.1f] Z[%.1f,%.1f]  size %.1f x %.1f x %.1f"
          % (ci, len(g), mn[0], mx[0], mn[1], mx[1], mn[2], mx[2],
             mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]))

# ASCII render of the two biggest, in XY
def render(g, a=0, b=1, W=100, H=60, label=""):
    pts = [p for t in g for p in t]
    mn = [min(p[c] for p in pts) for c in range(3)]
    mx = [max(p[c] for p in pts) for c in range(3)]
    grid = [[" "] * W for _ in range(H)]
    sa = (W - 1) / (mx[a] - mn[a] or 1)
    sb = (H - 1) / (mx[b] - mn[b] or 1)
    for t in g:
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
    print("=== %s XY outline" % label)
    for row in grid:
        print("".join(row))

for ci in range(min(4, len(comps))):
    render(comps[ci], label="comp%d" % ci)
