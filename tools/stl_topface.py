import struct
from collections import defaultdict

d = open("Opti Model.stl", "rb").read()
n = struct.unpack_from("<I", d, 80)[0]
tris = []
for i in range(n):
    vals = struct.unpack_from("<12fH", d, 84 + i * 50)
    v = vals[3:12]
    tris.append(((vals[0], vals[1], vals[2]),
                 ((v[0], v[1], v[2]), (v[3], v[4], v[5]), (v[6], v[7], v[8]))))

# split into the two slabs by z extent
zmax = max(p[2] for _, t in tris for p in t)
top = [t for nz, t in tris if nz[2] > 0.9]
print("upward-facing tris:", len(top))

def q(p): return (round(p[0], 1), round(p[1], 1))

# cluster top tris into components
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
print("top-face components:", [len(c) for c in comps])

for ci, c in enumerate(comps):
    cnt = defaultdict(int)
    for t in c:
        ks = [q(p) for p in t]
        for a, b in ((0,1),(1,2),(2,0)):
            cnt[tuple(sorted((ks[a], ks[b])))] += 1
    bnd = [e for e, k in cnt.items() if k == 1]
    adj = defaultdict(list)
    for a, b in bnd: adj[a].append(b); adj[b].append(a)
    seen = set(); loops = []
    for st in adj:
        if st in seen: continue
        loop = [st]; seen.add(st); cur = st
        while True:
            nxt = next((nb for nb in adj[cur] if nb not in seen), None)
            if nxt is None: break
            seen.add(nxt); loop.append(nxt); cur = nxt
        # loop closure check
    # rebuild properly: collect all loops
    seen = set(); loops = []
    for st in adj:
        if st in seen: continue
        lp = [st]; seen.add(st); cur = st
        while True:
            nxt = next((nb for nb in adj[cur] if nb not in seen), None)
            if nxt is None: break
            seen.add(nxt); lp.append(nxt); cur = nxt
        loops.append(lp)
    loops.sort(key=len, reverse=True)
    print("=== component with %d tris, %d loops, sizes %s" % (len(top_tris) if False else 0, len(loops), [len(l) for l in loops[:6]]))
    for li, lp in enumerate(loops[:3]):
        xs = [p[0] for p in lp]; ys = [p[1] for p in lp]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        W, H = 116, 46
        grid = [[" "] * W for _ in range(H)]
        for i in range(len(lp)):
            a, b = lp[i], lp[(i + 1) % len(lp)]
            ax = int((a[0]-x0)/((x1-x0) or 1)*(W-1)); ay = H-1-int((a[1]-y0)/((y1-y0) or 1)*(H-1))
            bx = int((b[0]-x0)/((x1-x0) or 1)*(W-1)); by = H-1-int((b[1]-y0)/((y1-y0) or 1)*(H-1))
            st = max(abs(bx-ax), abs(by-ay), 1)
            for s in range(st+1):
                x = ax+(bx-ax)*s//st; y = ay+(by-ay)*s//st
                if 0 <= y < H and 0 <= x < W: grid[y][x] = "#"
        print("--- loop %d  n=%d  X[%.1f,%.1f]=%.1f  Y[%.1f,%.1f]=%.1f" % (li, len(lp), x0, x1, x1-x0, y0, y1, y1-y0))
        for row in grid: print("".join(row))
    break
