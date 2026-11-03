import * as THREE from "three";
import { geometryFor } from "./geometry.js";
import { includedGlobals } from "./model.js";
const cache = new WeakMap(),
  material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const triangleCache = new WeakMap();
export function worldColliders(r) {
  const global = r.world.areas.find((a) => a.id === 0);
  const objects = [...r.area.objects, ...includedGlobals(r.world, r.area)];
  return objects
    .filter(
      (o) =>
        o.status === "visible" && !["sensor", "group", "line"].includes(o.type),
    )
    .map((o) => {
      const signature = JSON.stringify([o.type, o.size, o.rotation, o.points]);
      let c = cache.get(o);
      if (!c || c.signature !== signature) {
        c?.mesh.geometry.dispose();
        c = { signature, mesh: new THREE.Mesh(geometryFor(o), material) };
        cache.set(o, c);
      }
      c.mesh.position.fromArray(o.position);
      c.mesh.userData.object = o;
      c.mesh.userData.area = global.objects.includes(o) ? 0 : r.areaId;
      c.mesh.updateMatrixWorld(true);
      return c.mesh;
    });
}
function hits(colliders, origin, direction, far) {
  const ray = new THREE.Raycaster(
    new THREE.Vector3(...origin),
    new THREE.Vector3(...direction),
    0,
    far,
  );
  return ray.intersectObjects(colliders, false);
}
function floorBelow(colliders, x, z, ceiling) {
  const heights = [
    [0, 0],
    [-19, -19],
    [-19, 19],
    [19, -19],
    [19, 19],
  ].map(
    ([dx, dz]) =>
      hits(colliders, [x + dx, ceiling, z + dz], [0, -1, 0], 16384).find(
        (h) => h.face.normal.y > 0.12,
      )?.point.y ?? 0,
  );
  return Math.max(...heights);
}
function bodyContact(colliders, position, height) {
  const body = new THREE.Box3(
    new THREE.Vector3(
      position[0] - 20,
      position[1] - height + 0.01,
      position[2] - 20,
    ),
    new THREE.Vector3(position[0] + 20, position[1] - 0.01, position[2] + 20),
  );
  for (const mesh of colliders) {
    const local = body.clone().translate(mesh.position.clone().negate()),
      bounds = mesh.geometry.boundingBox;
    if (
      ["x", "y", "z"].some(
        (axis) =>
          local.max[axis] <= bounds.min[axis] + 0.001 ||
          local.min[axis] >= bounds.max[axis] - 0.001,
      )
    )
      continue;
    const o = mesh.userData.object;
    if (
      o.type === "cuboid" &&
      !o.points &&
      o.rotation.every((angle) => Math.abs(angle % 90) < 0.0001)
    )
      return mesh;
    let triangles = triangleCache.get(mesh.geometry);
    if (!triangles) {
      const p = mesh.geometry.attributes.position;
      triangles = [];
      for (let i = 0; i < p.count; i += 3)
        triangles.push(
          new THREE.Triangle(
            new THREE.Vector3().fromBufferAttribute(p, i),
            new THREE.Vector3().fromBufferAttribute(p, i + 1),
            new THREE.Vector3().fromBufferAttribute(p, i + 2),
          ),
        );
      triangleCache.set(mesh.geometry, triangles);
    }
    if (triangles.some((triangle) => local.intersectsTriangle(triangle)))
      return mesh;
    if (["cuboid", "pyramid"].includes(o.type)) {
      const center = body.getCenter(new THREE.Vector3()),
        direction = new THREE.Vector3(1, 0.371, 0.193).normalize();
      const intersections = hits(
        [mesh],
        center.toArray(),
        direction.toArray(),
        30000,
      )
        .map((h) => h.distance)
        .filter((d, i, all) => i === 0 || Math.abs(d - all[i - 1]) > 0.001);
      if (intersections.length % 2) return mesh;
    }
  }
  return null;
}
export function lineOfSight(r, from, to) {
  const delta = to.map((p, i) => p - from[i]),
    length = Math.hypot(...delta);
  if (length === 0) return true;
  return !hits(
    worldColliders(r),
    from,
    delta.map((d) => d / length),
    Math.max(0, length - 1),
  ).length;
}
export function setPlayerHeight(r, requested) {
  const feet = r.position[1] - r.height,
    colliders = worldColliders(r),
    desired = Math.max(64, Math.min(280, requested));
  const ceilings = [
    [0, 0],
    [-19, -19],
    [-19, 19],
    [19, -19],
    [19, 19],
  ].map(
    ([dx, dz]) =>
      hits(
        colliders,
        [r.position[0] + dx, feet + 0.01, r.position[2] + dz],
        [0, 1, 0],
        281,
      ).find((h) => h.face.normal.y < -0.12)?.point.y ?? feet + 281,
  );
  const available = Math.min(...ceilings) - feet - 0.01;
  r.height = Math.max(64, Math.min(desired, available));
  r.position[1] = feet + r.height;
  r.syncVars();
}
export function movePlayer(r, input, free = false) {
  const d = Math.PI / 180,
    yaw = r.rotation[1] * d,
    pitch = r.rotation[0] * d,
    forward = input.forward || 0,
    strafe = input.strafe || 0,
    rise = r.mode === 1 && !free ? 0 : input.rise || 0;
  const cp = r.mode === 3 && !free ? Math.cos(pitch) : 1,
    sp = r.mode === 3 && !free ? Math.sin(pitch) : 0;
  const delta = [
    Math.sin(yaw) * forward * cp + Math.cos(yaw) * strafe,
    forward * sp + rise,
    Math.cos(yaw) * forward * cp - Math.sin(yaw) * strafe,
  ];
  if (free) {
    r.position = r.position.map((p, i) => p + delta[i]);
    return;
  }
  const colliders = worldColliders(r),
    n = Math.max(1, Math.ceil(Math.hypot(...delta) / 20));
  const step = delta.map((v) => v / n),
    events = new Set();
  for (let k = 0; k < n; k++) {
    const candidate = r.position.map((p, i) => p + step[i]);
    let height = candidate[1];
    const feet = r.position[1] - r.height;
    if (r.mode === 1) {
      const floor = floorBelow(
        colliders,
        candidate[0],
        candidate[2],
        feet + r.world.defaults.climb + 1,
      );
      if (floor >= feet - 1 && floor - feet <= r.world.defaults.climb)
        height = floor + r.height;
    }
    const blocked = bodyContact(
      colliders,
      [candidate[0], height, candidate[2]],
      r.height,
    );
    if (blocked) {
      events.add(`${blocked.userData.area}:${blocked.userData.object.id}`);
      break;
    }
    r.position = [
      Math.max(20, Math.min(8172, candidate[0])),
      Math.max(r.height, Math.min(8192, height)),
      Math.max(20, Math.min(8172, candidate[2])),
    ];
  }
  for (const key of events) {
    const [area, id] = key.split(":").map(Number);
    r.interact(id, "collided", 0, area);
  }
  r.syncVars();
}
export function stepGravity(r, dt) {
  if (r.mode !== 1) return;
  const floor = floorBelow(
      worldColliders(r),
      r.position[0],
      r.position[2],
      r.position[1],
    ),
    feet = r.position[1] - r.height;
  if (feet <= floor + 0.01) {
    r.position[1] = floor + r.height;
    r.velocityY = 0;
    r.fallStart = null;
    return;
  }
  r.fallStart ??= feet;
  r.velocityY -= 1400 * dt;
  const nextFeet = feet + r.velocityY * dt;
  if (nextFeet <= floor) {
    const fallen = r.fallStart - floor;
    r.vars[10] += Math.max(0, Math.round(fallen - r.world.defaults.safeFall));
    r.position[1] = floor + r.height;
    r.velocityY = 0;
    r.fallStart = null;
  } else r.position[1] = nextFeet + r.height;
  r.syncVars();
}
