import * as THREE from 'three';

// Textures drawn at runtime: registration plates from the case records, and the small
// repeating details of the street that would otherwise need image files.

const cache = new Map<string, THREE.Texture>();

function canvasTexture(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat = false) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache.set(key, tex);
  return tex;
}

/** A deterministic pseudo-random sequence, so textures look the same on every load. */
function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** "KA-01-AB-1234" as an Indian high-security plate reads it: "KA 01 AB 1234". */
export function formatPlate(raw: string) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = clean.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/);
  return m ? [m[1], m[2].padStart(2, '0'), m[3], m[4]].filter(Boolean).join(' ') : raw.toUpperCase();
}

/**
 * A high-security registration plate (500 x 120 mm): black characters on white for
 * private vehicles or on yellow for commercial ones, with the blue IND strip.
 */
export function plateTexture(text: string, background: string) {
  return canvasTexture(`plate:${text}:${background}`, 1000, 240, (ctx) => {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 1000, 240);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, 976, 216);
    // Blue strip with the chakra hologram and IND.
    ctx.fillStyle = '#1d4fa3';
    ctx.fillRect(26, 26, 74, 188);
    ctx.strokeStyle = '#9db8e8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(63, 82, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px "Arial Narrow", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('IND', 63, 168);
    // Characters.
    ctx.fillStyle = '#111';
    ctx.font = 'bold 150px "Arial Narrow", "Roboto Condensed", Arial, sans-serif';
    const label = formatPlate(text);
    const maxWidth = 840;
    const width = ctx.measureText(label).width;
    ctx.save();
    ctx.translate(560, 126);
    if (width > maxWidth) ctx.scale(maxWidth / width, 1);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });
}

/** Weathering for painted plaster walls: speckle, patches and rain streaks under the windows. */
export function plasterTexture() {
  return canvasTexture(
    'plaster',
    512,
    512,
    (ctx) => {
      const rnd = random(7);
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 9000; i += 1) {
        const v = 200 + Math.floor(rnd() * 55);
        ctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
        ctx.fillRect(rnd() * 512, rnd() * 512, 2, 2);
      }
      for (let i = 0; i < 40; i += 1) {
        const x = rnd() * 512;
        const y = rnd() * 512;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 30 + rnd() * 60);
        g.addColorStop(0, 'rgba(120,110,95,0.10)');
        g.addColorStop(1, 'rgba(120,110,95,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 100, y - 100, 200, 200);
      }
      for (let i = 0; i < 26; i += 1) {
        const x = rnd() * 512;
        const top = rnd() * 512;
        const g = ctx.createLinearGradient(0, top, 0, top + 120);
        g.addColorStop(0, 'rgba(70,65,55,0.16)');
        g.addColorStop(1, 'rgba(70,65,55,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, top, 3 + rnd() * 5, 120);
      }
    },
    true
  );
}

/** Kerb stones painted in alternating black and yellow, 0.5 m each. */
export function kerbTexture() {
  return canvasTexture(
    'kerb',
    256,
    32,
    (ctx) => {
      const rnd = random(11);
      ctx.fillStyle = '#e2b51c';
      ctx.fillRect(0, 0, 128, 32);
      ctx.fillStyle = '#1b1b1b';
      ctx.fillRect(128, 0, 128, 32);
      for (let i = 0; i < 700; i += 1) {
        const v = 90 + Math.floor(rnd() * 90);
        ctx.fillStyle = `rgba(${v},${v - 6},${v - 18},0.5)`;
        ctx.fillRect(rnd() * 256, rnd() * 32, 2 + rnd() * 3, 1 + rnd() * 2);
      }
    },
    true
  );
}

/** A galvanised rolling shutter: horizontal ridges with dust. */
export function shutterTexture() {
  return canvasTexture(
    'shutter',
    128,
    256,
    (ctx) => {
      const rnd = random(5);
      for (let y = 0; y < 256; y += 8) {
        const g = ctx.createLinearGradient(0, y, 0, y + 8);
        g.addColorStop(0, '#a9adaf');
        g.addColorStop(0.5, '#d6d9da');
        g.addColorStop(1, '#7d8183');
        ctx.fillStyle = g;
        ctx.fillRect(0, y, 128, 8);
      }
      for (let i = 0; i < 400; i += 1) {
        ctx.fillStyle = `rgba(90,80,60,${0.05 + rnd() * 0.1})`;
        ctx.fillRect(rnd() * 128, rnd() * 256, 1 + rnd() * 3, 1);
      }
    },
    true
  );
}

/** A painted shop sign. */
export function signTexture(text: string, background: string) {
  return canvasTexture(`sign:${text}:${background}`, 1024, 160, (ctx) => {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 1024, 160);
    ctx.fillStyle = '#fff8e6';
    ctx.font = 'bold 92px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 512, 86, 960);
  });
}

/** Rubber deposited by a skidding tyre: dark, streaky, fading in where braking began. */
export function skidTexture() {
  return canvasTexture('skid', 512, 64, (ctx) => {
    const rnd = random(3);
    const g = ctx.createLinearGradient(0, 0, 512, 0);
    g.addColorStop(0, 'rgba(10,10,10,0)');
    g.addColorStop(0.18, 'rgba(10,10,10,0.55)');
    g.addColorStop(1, 'rgba(10,10,10,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 6, 512, 52);
    for (let i = 0; i < 60; i += 1) {
      ctx.fillStyle = `rgba(0,0,0,${0.1 + rnd() * 0.25})`;
      ctx.fillRect(rnd() * 512, 6 + rnd() * 52, 40 + rnd() * 200, 1 + rnd() * 2);
    }
  });
}

/** Worn road paint: mostly solid with gaps where traffic has scuffed it. */
export function paintWearTexture() {
  return canvasTexture(
    'paint-wear',
    256,
    256,
    (ctx) => {
      const rnd = random(19);
      ctx.fillStyle = '#e6e6e6';
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 1600; i += 1) {
        const v = Math.floor(rnd() * 120);
        ctx.fillStyle = `rgba(${v},${v},${v},${0.25 + rnd() * 0.5})`;
        ctx.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 4, 1 + rnd() * 3);
      }
    },
    true
  );
}

/** An irregular pool or spatter, alpha only at the edge: blood when red, soot when black. */
export function stainTexture(kind: 'blood' | 'scorch' | 'soot', seed = 1) {
  return canvasTexture(`stain:${kind}:${seed}`, 512, 512, (ctx) => {
    const rnd = random(seed * 7 + (kind === 'blood' ? 1 : kind === 'scorch' ? 2 : 3));
    const colour = kind === 'blood' ? [74, 6, 10] : [14, 11, 9];
    // A lumpy outline from overlapping blobs, softened at the rim.
    const blobs = kind === 'blood' ? 14 : 26;
    for (let i = 0; i < blobs; i += 1) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * (kind === 'blood' ? 90 : 120);
      const x = 256 + Math.cos(a) * d;
      const y = 256 + Math.sin(a) * d;
      const r = (kind === 'blood' ? 60 : 80) + rnd() * 70;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const alpha = kind === 'blood' ? 0.9 : kind === 'scorch' ? 0.85 : 0.55;
      g.addColorStop(0, `rgba(${colour[0]},${colour[1]},${colour[2]},${alpha})`);
      g.addColorStop(0.75, `rgba(${colour[0]},${colour[1]},${colour[2]},${alpha * 0.8})`);
      g.addColorStop(1, `rgba(${colour[0]},${colour[1]},${colour[2]},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (kind === 'blood') {
      // Satellite drops around the pool.
      for (let i = 0; i < 40; i += 1) {
        const a = rnd() * Math.PI * 2;
        const d = 170 + rnd() * 70;
        ctx.fillStyle = `rgba(80,6,12,${0.6 + rnd() * 0.35})`;
        ctx.beginPath();
        ctx.arc(256 + Math.cos(a) * d, 256 + Math.sin(a) * d, 2 + rnd() * 7, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Ash and char flecks.
      for (let i = 0; i < 900; i += 1) {
        const a = rnd() * Math.PI * 2;
        const d = rnd() * 230;
        const v = Math.floor(rnd() * 50);
        ctx.fillStyle = `rgba(${v},${v},${v},${0.2 + rnd() * 0.5})`;
        ctx.fillRect(256 + Math.cos(a) * d, 256 + Math.sin(a) * d, 1 + rnd() * 4, 1 + rnd() * 4);
      }
    }
  });
}

/** One shoe print, toe towards +u. */
export function shoeTexture() {
  return canvasTexture('shoe', 128, 256, (ctx) => {
    ctx.fillStyle = 'rgba(40,30,24,0.75)';
    ctx.beginPath();
    ctx.ellipse(64, 80, 40, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(64, 200, 30, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    for (let y = 20; y < 150; y += 14) ctx.fillRect(20, y, 88, 4);
  });
}

/** The number on a yellow evidence tent. */
export function tentTexture(text: string) {
  return canvasTexture(`tent:${text}`, 256, 256, (ctx) => {
    ctx.fillStyle = '#f2c518';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, 256, 18);
    ctx.font = 'bold 150px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 142, 230);
  });
}
