import struct, sys
from collections import defaultdict

d = open("Opti Model.stl", "rb").read()
n = struct.unpack_from("<I", d, 80)[0]
tris = []
for i in range(n):
    v = struct.unpack_from("<12fH", d, 84 + i * 50)[3:12]
    tris.append(((v[0], v[1], v[2]), (v[3], v[4], v[5]), (v[6], v[7], v[8])))

def q(p):
    return (round(p[0], 1), round(p[1], 1), round(p[2], 1))

# boundary edges = edges used by exactly one triangle
cnt = defaultdict(int)
for t in tris:
    ks = [q(p) for p in t]
    for a, b in ((0,1),(1,2),(2,0)):
        e = tuple(sorted((ks[a], ks[b])))
        cnt[e] += 1
boundary = [e for e, c in cnt.items() if c == 1]
print("boundary edges:", len(boundary))

# chain them into loops
adj = defaultdict(list)
for a, b in boundary:
    adj[a].append(b); adj[b].append(a)
seen = set(); loops = []
for start in adj:
    if start in seen: continue
    loop = [start]; seen.add(start); cur = start
    while True:
        nxt = None
        for nb in adj[cur]:
            if nb not in seen:
                nxt = nb; break
        if nxt is None: break
        seen.add(nxt); loop.append(nxt); cur = nxt
    loops.append(loop)
loops.sort(key=len, reverse=True)
print("loops:", [len(l) for l in loops[:8]])

pts = [p for l in loops for p in l]
mn = [min(p[c] for p in pts) for c in range(3)]
mx = [max(p[c] for p in pts) for c in range(3)]

for li, l in enumerate(loops[:4]):
    W, H = 118, 52
    xs = [p[0] for p in l]; ys = [p[1] for p in l]
    x0, x1 = min(xs), max(xs); y0, y1 = min(ys), max(ys)
    grid = [[" "] * W for _ in range(H)]
    for i in range(len(l)):
        a, b = l[i], l[(i + 1) % len(l)]
        gx0 = int((a[0]-x0)/((x1-x0) or 1)*(W-1)); gy0 = H-1-int((a[1]-y0)/((y1-y0) or 1)*(H-1))
        gx1 = int((b[0]-x0)/((x1-x0) or 1)*(W-1)); gy1 = H-1-int((b[1]-y0)/((y1-y0) or 1)*(H-1))
        steps = max(abs(gx1-gx0), abs(gy1-gy0), 1)
        for s in range(steps+1):
            x = gx0+(gx1-gx0)*s//steps; y = gy0+(gy1-gy0)*s//steps
            if 0 <= y < H and 0 <= x < W: grid[y][x] = "#"
    print("=== loop %d  pts=%d  X[%.1f,%.1f]=%.1f  Y[%.1f,%.1f]=%.1f" % (li, len(l), x0, x1, x1-x0, y0, y1, y1-y0))
    for row in grid: print("".join(row))
