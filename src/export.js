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
 *{box-sizing:border-box}html,body{height:100%}body{margin:0;display:flex;flex-direction:column;background:radial-gradient(120% 90% at 50% 35%,#2c4644 0%,#1d3130 55%,#152524 100%);color:#ece6d3;font:13px/1.4 Inter,"Segoe UI Variable Text","Segoe UI",system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
 .player-header{height:56px;flex:none;display:flex;align-items:center;gap:8px;padding:0 18px}
 h1{font-size:15px;font-weight:650;letter-spacing:-.1px;margin:0 auto 0 0;display:flex;align-items:center;gap:10px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 h1:before{content:"";flex:none;width:22px;height:22px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Cpath d='M24 4 42 14 24 24 6 14z' fill='%23f4e7cc'/%3E%3Cpath d='M6 14 24 24v20L6 34z' fill='%232f5b52'/%3E%3Cpath d='M24 24 42 14v20L24 44z' fill='%23c8714d'/%3E%3C/svg%3E") center/contain no-repeat}
 .group{display:flex;gap:2px;padding:3px;background:#213634;border:1px solid rgb(255 255 255/.07);border-radius:9px}
 button{font:inherit;font-size:12px;font-weight:500;padding:6px 11px;border:0;border-radius:6px;background:transparent;color:#d9e1d7;cursor:pointer;transition:background .12s,color .12s}
 button:hover{background:rgb(255 255 255/.09);color:#fff}button:focus-visible{outline:2px solid #c8714d;outline-offset:1px}
 #player-viewport{position:relative;overflow:hidden;margin:4px auto 0;width:min(calc(100% - 32px),1400px,calc((100dvh - 150px)*1.6));aspect-ratio:8/5;border-radius:12px;background:#0f1b1a;box-shadow:0 0 0 1px rgb(255 255 255/.06),0 0 0 9px #101c1b,0 0 0 10px rgb(255 255 255/.05),0 30px 70px -20px rgb(0 0 0/.7)}
 #player-viewport canvas{display:block;outline:none;touch-action:none}
 .hud{position:absolute;inset:0;pointer-events:none;z-index:2}.instrument{position:absolute;overflow:hidden;white-space:pre-wrap;line-height:1;font-family:"Cascadia Mono",Consolas,monospace;display:flex;align-items:center}.instrument.number,.instrument.text{padding:0 .3em}.instrument.horizontal,.instrument.vertical{align-items:flex-end}.instrument span{display:block}.crosshair{position:absolute;transform:translate(-50%,-50%);font-size:22px;color:#fff9;text-shadow:0 0 3px rgb(0 0 0/.35)}
 .player-footer{flex:none;min-height:70px;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:12px;padding:12px;font-size:11px;color:#8fa198}
 kbd{display:inline-block;font:10.5px "Cascadia Mono",Consolas,monospace;color:#d9e1d7;background:#213634;border:1px solid rgb(255 255 255/.1);border-bottom-width:2px;border-radius:4px;padding:0 5px;margin:0 2px}
 #message{position:fixed;top:68px;left:50%;transform:translateX(-50%);display:none;align-items:center;gap:9px;background:#f4f0df;color:#1f3433;padding:9px 16px;border-radius:999px;font-weight:500;font-size:12px;z-index:5;box-shadow:0 12px 28px -8px rgb(0 0 0/.5)}
 @media(max-width:700px){.player-header{gap:4px;padding:0 8px}h1{font-size:12px}button{font-size:11px;padding:6px 7px}.player-footer .keys{display:none}}
 </style></head><body class="player-only"><header class="player-header"><h1>${escape(world.name)}</h1><div class="group"><button id="restart">Restart world</button><button id="save-game">Save game</button><button id="load-game">Load game</button></div><div class="group"><button id="look">Mouse look</button></div></header><main id="player-viewport"></main><footer class="player-footer"><div class="group"><button data-step="forward">Forward</button><button data-step="left">Left</button><button data-step="right">Right</button></div><div class="group"><button id="activate">Activate</button><button id="shoot">Shoot</button></div><span class="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move · <kbd>←</kbd><kbd>→</kbd> look · <kbd>E</kbd> activate · <kbd>Space</kbd> shoot · <kbd>V</kbd> fly · <kbd>R</kbd>/<kbd>F</kbd> rise/fall</span></footer><div id="message" role="status"></div><script>window.FREESCAPE_WORLD=${data};</script><script>${code.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}
