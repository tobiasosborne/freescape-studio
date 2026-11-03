import { THREE_NOTICE } from "./notices.js";
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function standaloneHTML(world, code) {
  const data = JSON.stringify(world)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return `<!doctype html><!-- ${THREE_NOTICE} --><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(world.name)} · Freescape</title><style>
 *{box-sizing:border-box}body{margin:0;background:#263c3c;color:#eee8d8;font-family:system-ui,sans-serif}.player-header{height:55px;display:flex;align-items:center;gap:8px;padding:10px 18px}h1{font-size:15px;font-weight:500;margin:0 auto 0 0}button{font:inherit;font-size:11px;padding:7px 10px;border:1px solid #a4b6a0;border-radius:4px;background:#eeeadd;color:#263b3a;cursor:pointer}#player-viewport{height:calc(100dvh - 100px);position:relative;width:min(100%,1400px);margin:auto;overflow:hidden}.hud{position:absolute;inset:0;pointer-events:none;z-index:2}.instrument{position:absolute;overflow:hidden;white-space:pre-wrap;line-height:1;font-family:monospace;display:flex;align-items:center}.instrument.horizontal,.instrument.vertical{align-items:flex-end}.instrument span{display:block}.crosshair{position:absolute;transform:translate(-50%,-50%);font-size:22px;color:#fff9}.player-footer{height:45px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:10px;color:#b4c4b1}#message{position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:#f1edda;color:#263b3a;padding:10px 16px;border-radius:4px;z-index:5;display:none}@media(max-width:600px){.player-header{gap:4px;padding:8px}h1{font-size:11px}button{font-size:9px;padding:6px}.player-footer span{display:none}}
 </style></head><body class="player-only"><header class="player-header"><h1>${escape(world.name)}</h1><button id="restart">Restart world</button><button id="save-game">Save game</button><button id="load-game">Load game</button><button id="look">Mouse look</button></header><main id="player-viewport"></main><footer class="player-footer"><button data-step="forward">Forward</button><button data-step="left">Left</button><button data-step="right">Right</button><button id="activate">Activate</button><button id="shoot">Shoot</button><span>WASD · Arrows look · E activate · Space shoot · V fly · R/F rise/fall</span></footer><div id="message" role="status"></div><script>window.FREESCAPE_WORLD=${data};</script><script>${code.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}
