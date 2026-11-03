import * as THREE from "three";
export const faceCount = (type) =>
  ["cuboid", "pyramid"].includes(type)
    ? 6
    : ["group", "sensor", "line"].includes(type)
      ? 0
      : 2;
export function geometryFor(o) {
  const geometry = new THREE.BufferGeometry(),
    s = o.size;
  let points, faces;
  if (o.type === "line") {
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        o.points.flatMap((p) => p.map((n, i) => n * s[i])),
        3,
      ),
    );
    return geometry;
  }
  if (o.type === "cuboid") {
    points = o.points || [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
      [0, 1, 0],
      [1, 1, 0],
      [1, 1, 1],
      [0, 1, 1],
    ];
    faces = [
      [1, 2, 6, 5],
      [3, 0, 4, 7],
      [4, 5, 6, 7],
      [0, 3, 2, 1],
      [2, 3, 7, 6],
      [0, 1, 5, 4],
    ];
  } else if (o.type === "pyramid") {
    points = o.points;
    faces = [
      [1, 2, 6, 5],
      [3, 0, 4, 7],
      [4, 5, 6, 7],
      [0, 3, 2, 1],
      [2, 3, 7, 6],
      [0, 1, 5, 4],
    ];
  } else if (o.points) {
    points = o.points;
    faces = [
      points.map((_, i) => i),
      points.map((_, i) => points.length - 1 - i),
    ];
  } else return geometry;
  if (["cuboid", "pyramid"].includes(o.type))
    faces = faces.map((f) => [...f].reverse());
  const vertices = [],
    uvs = [];
  for (let f = 0; f < faces.length; f++) {
    const ids = faces[f],
      start = vertices.length / 3;
    for (let i = 1; i < ids.length - 1; i++)
      for (const j of [0, i, i + 1]) {
        const point = points[ids[j]].map((n, axis) => n * s[axis]);
        vertices.push(...point);
        const u = new THREE.Vector3(...points[ids[1]]).sub(
            new THREE.Vector3(...points[ids[0]]),
          ),
          v = new THREE.Vector3(...points[ids[2]]).sub(
            new THREE.Vector3(...points[ids[0]]),
          ),
          normal = u.cross(v);
        const axes =
          Math.abs(normal.x) > Math.abs(normal.y) &&
          Math.abs(normal.x) > Math.abs(normal.z)
            ? [1, 2]
            : Math.abs(normal.y) > Math.abs(normal.z)
              ? [0, 2]
              : [0, 1];
        uvs.push(point[axes[0]] / 24, point[axes[1]] / 24);
      }
    geometry.addGroup(start, vertices.length / 3 - start, f);
  }
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.translate(-s[0] / 2, -s[1] / 2, -s[2] / 2);
  const d = Math.PI / 180;
  geometry.rotateX(o.rotation[0] * d);
  geometry.rotateY(o.rotation[1] * d);
  geometry.rotateZ(o.rotation[2] * d);
  geometry.translate(s[0] / 2, s[1] / 2, s[2] / 2);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}
export function materialsFor(o, palette) {
  return Array.from({ length: faceCount(o.type) }, (_, i) => {
    const index = o.colors[i % o.colors.length],
      pattern = o.patterns?.[i];
    const material = new THREE.MeshBasicMaterial({
      color: pattern ? "#ffffff" : palette[index] || palette[2],
      side: THREE.FrontSide,
      visible: index !== 0,
    });
    if (pattern) {
      const bytes = [];
      for (const idx of [pattern.a, pattern.b, pattern.b, pattern.a]) {
        const c = new THREE.Color(palette[idx]);
        bytes.push(
          Math.round(c.r * 255),
          Math.round(c.g * 255),
          Math.round(c.b * 255),
          255,
        );
      }
      const texture = new THREE.DataTexture(new Uint8Array(bytes), 2, 2);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.magFilter = texture.minFilter = THREE.NearestFilter;
      texture.needsUpdate = true;
      material.map = texture;
    }
    return material;
  });
}
