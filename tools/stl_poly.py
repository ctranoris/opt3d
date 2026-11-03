import struct, sys, json
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
    bnd = [e for e, k in cnt.items() if k == 1]
    adj = defaultdict(list)
    for a, b in bnd: adj[a].append(b); adj[b].append(a)
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

idx = int(sys.argv[1]) if len(sys.argv) > 1 else 0
c = comps[idx]
ls = loops_of(c)
print("comp", idx, "loops:", [len(l) for l in ls])
for li, lp in enumerate(ls[:2]):
    # simplify: keep vertices where direction changes > 8 deg
    keep = []
    m = len(lp)
    for i in range(m):
        p0, p1, p2 = lp[(i-1) % m], lp[i], lp[(i+1) % m]
        a1 = (p1[0]-p0[0], p1[1]-p0[1]); a2 = (p2[0]-p1[0], p2[1]-p1[1])
        import math
        l1 = math.hypot(*a1) or 1; l2 = math.hypot(*a2) or 1
        ang = math.degrees(math.acos(max(-1, min(1, (a1[0]*a2[0]+a1[1]*a2[1])/(l1*l2)))))
        if ang > 10: keep.append((i, p1, round(ang)))
    print("loop", li, "n=", m, "corners:", len(keep))
    for i, p, a in keep[:40]:
        print("   idx%4d  (%7.1f, %7.1f)  turn %3d" % (i, p[0], p[1], a))
