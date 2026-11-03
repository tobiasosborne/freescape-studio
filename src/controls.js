export function controlAction(world, x, y, buttons) {
  for (const zone of world.controlZones || []) {
    if (
      !world.controls[zone.action] ||
      x < zone.x ||
      y < zone.y ||
      x >= zone.x + zone.width ||
      y >= zone.y + zone.height
    )
      continue;
    const accepted =
      zone.button === "either"
        ? !!(buttons & 3)
        : zone.button === "both"
          ? (buttons & 3) === 3
          : zone.button === "right"
            ? !!(buttons & 2)
            : !!(buttons & 1);
    if (accepted) return zone.action;
  }
  return null;
}
