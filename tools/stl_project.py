import struct, sys

path = sys.argv[1]
d = open(path, "rb").read()
n = struct.unpack_from("<I", d, 80)[0]
tris = []
for i in range(n):
    off = 84 + i * 50
    v = struct.unpack_from("<12fH", d, off)[3:12]
    tris.append(((v[0], v[1], v[2]), (v[3], v[4], v[5]), (v[6], v[7], v[8])))

mn = [min(min(t[k][c] for t in tris) for k in range(3)) for c in range(3)]
mx = [max(max(t[k][c] for t in tris) for k in range(3)) for c in range(3)]

# three views: (a,b) axis pairs
views = [("XY", 0, 1), ("XZ", 0, 2), ("YZ", 1, 2)]
W, H = 700, 700
out = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' % (W * 3 + 60, H + 40, W * 3 + 60, H + 40)]
out.append('<rect width="100%" height="100%" fill="white"/>')
for vi, (name, a, b) in enumerate(views):
    ox = vi * (W + 30) + 20
    sa = (W - 40) / (mx[a] - mn[a])
    sb = (H - 40) / (mx[b] - mn[b])
    s = min(sa, sb)
    def P(p):
        return (ox + (p[a] - mn[a]) * s + 20, H - 20 - (p[b] - mn[b]) * s)
    out.append('<g stroke="black" stroke-width="0.35" fill="none" opacity="0.8">')
    for t in tris:
        x0, y0 = P(t[0]); x1, y1 = P(t[1]); x2, y2 = P(t[2])
        out.append('<path d="M%.1f %.1fL%.1f %.1fL%.1f %.1fZ"/>' % (x0, y0, x1, y1, x2, y2))
    out.append('</g>')
    out.append('<text x="%d" y="18" font-size="18" font-family="sans-serif">%s  (%.1f x %.1f)</text>'
               % (ox, name, mx[a] - mn[a], mx[b] - mn[b]))
out.append('</svg>')
open("stl_views.svg", "w").write("\n".join(out))
print("wrote stl_views.svg")
