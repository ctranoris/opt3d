import struct, sys, math

path = sys.argv[1]
d = open(path, "rb").read()
n = struct.unpack_from("<I", d, 80)[0]
print("triangles:", n, "bytes:", len(d), "expected:", 84 + n * 50)

mn = [1e18] * 3
mx = [-1e18] * 3
tris = []
for i in range(n):
    off = 84 + i * 50
    vals = struct.unpack_from("<12fH", d, off)
    nx, ny, nz = vals[0:3]
    v = vals[3:12]
    tris.append((nx, ny, nz, v))
    for k in range(3):
        for c in range(3):
            x = v[k * 3 + c]
            if x < mn[c]: mn[c] = x
            if x > mx[c]: mx[c] = x

print("min:", ["%.3f" % a for a in mn])
print("max:", ["%.3f" % a for a in mx])
print("size:", ["%.3f" % (b - a) for a, b in zip(mn, mx)])

# area-weighted normal histogram to find dominant orientations
buckets = {}
total_area = 0.0
for nx, ny, nz, v in tris:
    ax, ay, az = v[0], v[1], v[2]
    bx, by, bz = v[3], v[4], v[5]
    cx, cy, cz = v[6], v[7], v[8]
    ux, uy, uz = bx - ax, by - ay, bz - az
    wx, wy, wz = cx - ax, cy - ay, cz - az
    fx = uy * wz - uz * wy
    fy = uz * wx - ux * wz
    fz = ux * wy - uy * wx
    area = 0.5 * math.sqrt(fx * fx + fy * fy + fz * fz)
    total_area += area
    key = (round(nx), round(ny), round(nz))
    buckets[key] = buckets.get(key, 0.0) + area

print("total area: %.1f" % total_area)
for k, a in sorted(buckets.items(), key=lambda kv: -kv[1])[:10]:
    print("  normal", k, "%.1f" % a, "%.1f%%" % (100 * a / total_area))

# slice along each axis to see distribution of area
for axis, name in enumerate("XYZ"):
    hist = [0.0] * 12
    span = mx[axis] - mn[axis] or 1.0
    for nx, ny, nz, v in tris:
        c = (v[axis] + v[axis + 3] + v[axis + 6]) / 3.0
        b = min(11, int((c - mn[axis]) / span * 12))
        hist[b] += 1
    print(name, "hist:", " ".join("%4d" % h for h in hist))
