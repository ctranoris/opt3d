import struct, math, itertools
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

def loops_of(c):
    cnt = defaultdict(int)
    for t in c:
        ks = [q(p) for p in t]
        for a, b in ((0,1),(1,2),(2,0)):
            cnt[tuple(sorted((ks[a], ks[b])))] += 1
    adj = defaultdict(list)
    for (a, b), k in cnt.items():
        if k == 1:
            adj[a].append(b); adj[b].append(a)
    seen = set(); out = []
    for st in adj:
        if st in seen: continue
        lp = [st]; seen.add(st); cur = st
        while True:
            nxt = next((nb for nb in adj[cur] if nb not in seen), None)
            if nxt is None: break
            seen.add(nxt); lp.append(nxt); cur = nxt
        out.append(lp)
    out.sort(key=len, reverse=True)
    return out

for ci in (0, 1, 2, 3, 4, 5, 6, 7):
    if ci >= len(comps): break
    ls = loops_of(comps[ci])
    if not ls: continue
    lp = ls[0]
    pts = [p for t in comps[ci] for p in t]
    area = 0.0
    for i in range(len(lp)):
        x1, y1 = lp[i]; x2, y2 = lp[(i+1) % len(lp)]
        area += x1 * y2 - x2 * y1
    area = abs(area) / 2
    # farthest-4 heuristic for the main corners
    def dist(a, b): return math.hypot(a[0]-b[0], a[1]-b[1])
    best = None
    cand = list(range(len(lp)))
    # pick extremes
    ext = {'minx': min(cand, key=lambda i: lp[i][0]), 'maxx': max(cand, key=lambda i: lp[i][0]),
           'miny': min(cand, key=lambda i: lp[i][1]), 'maxy': max(cand, key=lambda i: lp[i][1])}
    print("=== comp %d  tris=%d  loopN=%d  area=%.0f  bbox X[%.1f..%.1f] Y[%.1f..%.1f]" %
          (ci, len(comps[ci]), len(lp), area,
           min(p[0] for p in pts), max(p[0] for p in pts),
           min(p[1] for p in pts), max(p[1] for p in pts)))
    for k, i in ext.items():
        print("    %-5s idx%3d (%.1f, %.1f)" % (k, i, lp[i][0], lp[i][1]))
    if ci == 0:
        print("    full loop:")
        for i in range(len(lp)):
            a = lp[(i-1) % len(lp)]; b = lp[i]; c = lp[(i+1) % len(lp)]
            a1 = (b[0]-a[0], b[1]-a[1]); a2 = (c[0]-b[0], c[1]-b[1])
            l1 = math.hypot(*a1) or 1; l2 = math.hypot(*a2) or 1
            ang = math.degrees(math.acos(max(-1, min(1, (a1[0]*a2[0]+a1[1]*a2[1])/(l1*l2)))))
            print("      %2d (%7.1f,%7.1f) seg=%.1f turn=%3d" % (i, b[0], b[1], l1, ang))
