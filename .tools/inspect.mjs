// Geometry audit: bounding box and triangle count for every mesh in the boat.
import * as THREE from '../lib/three.module.js';

const warns = [];
THREE.BufferGeometry.prototype.__origCompute = THREE.BufferGeometry.prototype.computeVertexNormals;

const { createBoat, makeMaterials } = await import('../model/opti-boat.js');

globalThis.document = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => new Proxy({}, {
      get: (t, k) => {
        if (k === 'createLinearGradient' || k === 'createRadialGradient') {
          return () => ({ addColorStop() {} });
        }
        if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
        if (k === 'measureText') return () => ({ width: 0 });
        return () => {};
      },
      set: () => true,
    }),
  }),
};

const boat = createBoat(makeMaterials());
boat.group.updateMatrixWorld(true);

const box = new THREE.Box3();
let i = 0;
const rows = [];
boat.group.traverse((o) => {
  if (!o.isMesh && !o.isLine) return;
  const g = o.geometry;
  const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  g.computeBoundingBox();
  box.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
  const p = new THREE.Vector3(), q = new THREE.Vector3(), r = new THREE.Vector3();
  const pos = g.attributes.position;
  const idx = g.index ? g.index.array : null;
  let degenerate = 0, huge = 0;
  const tris = Math.floor(n);
  for (let t = 0; t < tris; t++) {
    const a = idx ? idx[t * 3] : t * 3;
    const b = idx ? idx[t * 3 + 1] : t * 3 + 1;
    const c = idx ? idx[t * 3 + 2] : t * 3 + 2;
    p.fromBufferAttribute(pos, a);
    q.fromBufferAttribute(pos, b);
    r.fromBufferAttribute(pos, c);
    const area = q.clone().sub(p).cross(r.clone().sub(p)).length() * 0.5;
    if (area < 1e-9) degenerate++;
    if (area > 0.05) huge++;
  }
  const fmt = (v) => v.toFixed(2);
  rows.push({
    n: i++,
    type: o.isLine ? 'line' : o.geometry.type,
    tris,
    degenerate,
    huge,
    bbox: `${fmt(box.min.x)}..${fmt(box.max.x)} ${fmt(box.min.y)}..${fmt(box.max.y)} ${fmt(box.min.z)}..${fmt(box.max.z)}`,
  });
});

console.log('idx  type                     tris    degen  huge   bbox x y z');
for (const r of rows) {
  console.log(
    String(r.n).padStart(3), r.type.padEnd(22),
    String(r.tris).padStart(7), String(r.degenerate).padStart(7),
    String(r.huge).padStart(6), ' ', r.bbox);
}
