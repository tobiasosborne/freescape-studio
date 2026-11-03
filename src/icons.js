// Inline SVG icons. Unicode glyphs (⬠ ⌾ ◬ ⌁ …) render inconsistently or not
// at all with Windows system fonts, so the interface draws its own.
const stroke = (d, size = 16) =>
  `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;

const paths = {
  select: '<path d="M6 3.5 18.5 11l-5.6 1.4L10.2 18z" fill="currentColor" fill-opacity=".14"/>',
  move: '<path d="M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/>',
  scale: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  paint: '<path d="M4 14.5 11.5 7l6 6-7.5 7.5a2 2 0 0 1-2.8 0L4 17.3a2 2 0 0 1 0-2.8z" fill="currentColor" fill-opacity=".14"/><path d="M11.5 7 9 4.5M19.5 15.5s1.5 1.9 1.5 3a1.5 1.5 0 0 1-3 0c0-1.1 1.5-3 1.5-3z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  export: '<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13"/>',
  save: '<path d="M5 4h11l3 3v11.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5z"/><path d="M8 4v4.5h7V4M8 20v-6h8v6"/>',
  play: '<path d="M7 4.8v14.4a.8.8 0 0 0 1.2.7l11.5-7.2a.8.8 0 0 0 0-1.4L8.2 4.1A.8.8 0 0 0 7 4.8z" fill="currentColor"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  door: '<path d="M6 20V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v15M4 20h16"/><circle cx="14.5" cy="12.5" r=".6" fill="currentColor"/>',
  group: '<rect x="3.5" y="3.5" width="17" height="17" rx="2" stroke-dasharray="3 2.6"/><rect x="7.5" y="7.5" width="5" height="5" rx=".8"/><rect x="11.5" y="11.5" width="5" height="5" rx=".8"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  frame: '<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/><circle cx="12" cy="12" r="2.5"/>',
  grid: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/>',
  fine: '<circle cx="12" cy="12" r="7"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2.2-2.5 3.8"/><circle cx="12" cy="17" r=".5" fill="currentColor"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  camera: '<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.3l1.4-2h7.6l1.4 2h2.3A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/><circle cx="12" cy="12.5" r="3.5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  // Object types, drawn as small isometric line icons.
  cuboid: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  pyramid: '<path d="M12 3 3.5 17 12 21l8.5-4z"/><path d="M12 3v18"/>',
  rectangle: '<path d="M5.5 8 18.5 4v12l-13 4z"/>',
  triangle: '<path d="M12 4 20.5 19h-17z"/>',
  quadrilateral: '<path d="M5 7.5 14.5 4 20 15l-11 5z"/>',
  pentagon: '<path d="m12 3.5 8.5 6.2-3.2 10H6.7l-3.2-10z"/>',
  hexagon: '<path d="M12 3 19.8 7.5v9L12 21l-7.8-4.5v-9z"/>',
  line: '<path d="M5.5 18.5 18.5 5.5"/><circle cx="5" cy="19" r="1.8" fill="currentColor"/><circle cx="19" cy="5" r="1.8" fill="currentColor"/>',
  sensor: '<path d="m12 8 3.5 4-3.5 4-3.5-4z" fill="currentColor" fill-opacity=".2"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4M8.8 8.8a4.5 4.5 0 0 0 0 6.4M15.2 8.8a4.5 4.5 0 0 1 0 6.4" stroke-width="1.4"/>',
};
export const icon = (name, size) => stroke(paths[name] ?? "", size);

// Larger, toned illustrations for the primitive tray: three-tone isometric
// "kit pieces" in the studio palette.
const T = "var(--kit-top)",
  L = "var(--kit-left)",
  R = "var(--kit-right)",
  F = "var(--kit-facet)";
const piece = (body) =>
  `<svg class="kit-piece" width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="var(--kit-edge)" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
const shapes = {
  cuboid: `<path d="M24 7 40 15.5 24 24 8 15.5z" fill="${T}"/><path d="M8 15.5 24 24v17L8 32.5z" fill="${L}"/><path d="M24 24 40 15.5v17L24 41z" fill="${R}"/>`,
  pyramid: `<path d="M24 6 8 31l16 9z" fill="${L}"/><path d="M24 6l16 25-16 9z" fill="${R}"/>`,
  rectangle: `<path d="M9 15 33 7v27L9 42z" fill="${F}"/>`,
  triangle: `<path d="M24 7 41 38H7z" fill="${F}"/>`,
  quadrilateral: `<path d="M9 15 30 7l10 23-21 11z" fill="${F}"/>`,
  pentagon: `<path d="m24 6 18 13-7 21H13L6 19z" fill="${F}"/>`,
  hexagon: `<path d="m24 5 16.5 9.5v19L24 43 7.5 33.5v-19z" fill="${F}"/>`,
  line: `<path d="M10 38 38 10" stroke-width="2.4"/><circle cx="10" cy="38" r="3.5" fill="${T}"/><circle cx="38" cy="10" r="3.5" fill="${T}"/>`,
  sensor: `<path d="m24 15 8 9-8 9-8-9z" fill="${R}"/><path d="M24 15v18M16 24h16" stroke-opacity=".4"/><path d="M12 12a17 17 0 0 0 0 24M36 12a17 17 0 0 1 0 24" stroke-opacity=".55"/><path d="M7 7a24 24 0 0 0 0 34M41 7a24 24 0 0 1 0 34" stroke-opacity=".28"/>`,
};
export const kitPiece = (type) => piece(shapes[type] ?? "");

// Brand mark: an isometric cube in three studio tones.
export const brandMark = `<svg class="brand-mark" width="34" height="34" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M24 4 42 14 24 24 6 14z" fill="#f4e7cc"/><path d="M6 14 24 24v20L6 34z" fill="#2f5b52"/><path d="M24 24 42 14v20L24 44z" fill="#c8714d"/><path d="M24 4 42 14v20L24 44 6 34V14z" fill="none" stroke="#1f3433" stroke-width="2" stroke-linejoin="round"/><path d="M6 14 24 24 42 14M24 24v20" fill="none" stroke="#1f3433" stroke-width="1.4" stroke-linejoin="round" stroke-opacity=".55"/></svg>`;
