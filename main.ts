// The World in One Day - Wednesday 25 November 2026.
// A newspaper front page that sums up the day's world news in one image.
// Pure Node.js standard library: no network, no randomness, no clock.
// The program draws every pixel itself (framebuffer + hand-typed 5x7
// bitmap font + its own PNG encoder) and writes entry.png deterministically.
// Deterministic by construction: no Date.now, no Math.random, no I/O
// besides the single output write, so every run produces byte-identical
// output from the same source. Run it twice to verify the hash matches.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------- palette ----------
type RGB = [number, number, number];
const INK: RGB = [20, 20, 20];
const PAPER: RGB = [247, 242, 231];
const PAPER_DARK: RGB = [245, 239, 226];
const RED: RGB = [163, 30, 34];
const NAVY: RGB = [29, 53, 87];
const TEAL: RGB = [15, 118, 110];
const OCHRE: RGB = [180, 83, 9];
const GOLD: RGB = [202, 138, 4];
const GREY: RGB = [100, 100, 96];
const LIGHT_GREY: RGB = [214, 207, 192];
const WHITE: RGB = [255, 255, 255];
const CREAM: RGB = [247, 242, 231];
const DARK_BG: RGB = [18, 32, 54];
const DARK_PANEL: RGB = [28, 48, 80];
const DARK_INK: RGB = [238, 232, 214];
const DARK_LINE: RGB = [90, 110, 140];

// ---------- framebuffer ----------
const fb = new Uint8Array(W * H * 3);
function fill(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    fb[i * 3] = c[0];
    fb[i * 3 + 1] = c[1];
    fb[i * 3 + 2] = c[2];
  }
}
function px(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  fb[i] = c[0];
  fb[i + 1] = c[1];
  fb[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) px(xx, yy, c);
  }
}
function hline(x: number, y: number, w: number, c: RGB, th = 1): void {
  fillRect(x, y, w, th, c);
}
function vline(x: number, y: number, h: number, c: RGB, th = 1): void {
  fillRect(x, y, th, h, c);
}
function rect(x: number, y: number, w: number, h: number, c: RGB, th = 1): void {
  hline(x, y, w, c, th);
  hline(x, y + h - th, w, c, th);
  vline(x, y, h, c, th);
  vline(x + w - th, y, h, c, th);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (let guard = 0; guard < 4096; guard++) {
    px(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) px(cx + x, cy + y, c);
  }
}
function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let y = -ry; y <= ry; y++) {
    const t = 1 - (y * y) / (ry * ry);
    if (t < 0) continue;
    const half = Math.floor(rx * Math.sqrt(t));
    for (let x = -half; x <= half; x++) px(cx + x, cy + y, c);
  }
}
// Scanline polygon fill (even-odd rule): for each horizontal scanline
// between the polygon's top and bottom, collect the x-intersections with
// its edges, sort them, and fill the spans between each pair of
// intersections. The even-odd rule means a point is inside when a ray
// from it crosses the boundary an odd number of times, which is what
// lets this one helper draw triangles, flames, arrows and map pins.
function fillPoly(pts: Array<[number, number]>, c: RGB): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const t = (y - a[1]) / (b[1] - a[1]);
        xs.push(a[0] + t * (b[0] - a[0]));
      }
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) px(x, y, c);
    }
  }
}
function pointInPoly(x: number, y: number, pts: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0];
    const yi = pts[i][1];
    const xj = pts[j][0];
    const yj = pts[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---------- CRC32 + PNG encoder (stdlib zlib for deflate) ----------
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(fb.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const comp = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", comp),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- 5x7 bitmap font (typed by hand) ----------
// Each glyph is 7 rows of 5 bits, concatenated into one 35-char string.
const FONT: Record<string, string> = {
  A: "01110100011000111111100011000110001",
  B: "11110100011000111110100011000111110",
  C: "01110100011000010000100001000101110",
  D: "11110100011000110001100011000111110",
  E: "11111100001000011110100001000011111",
  F: "11111100001000011110100001000010000",
  G: "01110100011000010111100011000101111",
  H: "10001100011000111111100011000110001",
  I: "01110001000010000100001000010001110",
  J: "00111000100001000010000101001001100",
  K: "10001100101010011000101001001010001",
  L: "10000100001000010000100001000011111",
  M: "10001110111010110101100011000110001",
  N: "10001110011010110011100011000110001",
  O: "01110100011000110001100011000101110",
  P: "11110100011000111110100001000010000",
  Q: "01110100011000110001101011001001101",
  R: "11110100011000111110101001001010001",
  S: "01111100001000001110000010000111110",
  T: "11111001000010000100001000010000100",
  U: "10001100011000110001100011000101110",
  V: "10001100011000110001100010101000100",
  W: "10001100011000110101101011101110001",
  X: "10001100010101000100010101000110001",
  Y: "10001100010101000100001000010000100",
  Z: "11111000010001000100010001000011111",
  a: "00000000000111000001011111000101111",
  b: "10000100001111010001100011000111110",
  c: "00000000000111010001100001000101110",
  d: "00001000010111110001100011000101111",
  e: "00000000000111010001111111000001110",
  f: "00110010010100011110010000100001000",
  g: "00000011111000110001011110000101110",
  h: "10000100001111010001100011000110001",
  i: "00100000000110000100001000010001110",
  j: "00010000000011000010000100001001100",
  k: "10000100001001010100110001010010010",
  l: "01100001000010000100001000010001110",
  m: "00000000001101010101101011010110101",
  n: "00000000001111010001100011000110001",
  o: "00000000000111010001100011000101110",
  p: "00000000001111010001100011111010000",
  q: "00000000000111110001100010111100001",
  r: "00000000001011011001100001000010000",
  s: "00000000000111110000011100000111110",
  t: "01000010001110001000010000100100110",
  u: "00000000001000110001100011001101101",
  v: "00000000001000110001100010101000100",
  w: "00000000001000110101101011010101010",
  x: "00000000001000101010001000101010001",
  y: "00000000001000110001011110000101110",
  z: "00000000001111100010001000100011111",
  "0": "01110100011001110101110011000101110",
  "1": "00100011000010000100001000010001110",
  "2": "01110100010000100110010001000011111",
  "3": "11111000100010000010000011000101110",
  "4": "00010001100101010010111110001000010",
  "5": "11111100001111000001000011000101110",
  "6": "00110010001000011110100011000101110",
  "7": "11111000010001000100010001000010000",
  "8": "01110100011000101110100011000101110",
  "9": "01110100011000101111000010001001100",
  " ": "00000000000000000000000000000000000",
  ".": "00000000000000000000000000110001100",
  ",": "00000000000000000000011000010001000",
  ":": "00000011000110000000011000110000000",
  ";": "00000011000110000000011000010001000",
  "!": "00100001000010000100001000000000100",
  "?": "01110100010000100110001000000000100",
  "'": "00100001000100000000000000000000000",
  '"': "01010010100101000000000000000000000",
  "-": "00000000000000011111000000000000000",
  "(": "00010001000100001000010000010000010",
  ")": "01000001000001000010000100001001000",
  "/": "00001000100001000100010001000010000",
  "%": "11001110100001000100010000101110011",
  "&": "01100100101010001000101011001001101",
  "+": "00000001000010011111001000010000000",
  "=": "00000000001111100000111110000000000",
  "*": "00000101010111011111011101010100000",
  "#": "01010010101111101010111110101001010",
  $: "00100011111010001110001011111000100",
  "@": "01110100011011110101101101000001110",
  _: "0000000000000000000000000000011111",
  "•": "00000000000010001110011100010000000",
  "°": "01100100101001001100000000000000000",
  "×": "00000100010101000100010101000100000",
  "<": "00010001000100010000010000010000010",
  ">": "01000001000010000100000100001001000",
  "[": "01110010000100001000010000100001110",
  "]": "01110000100001000010000100001001110",
};
function glyphFor(ch: string): string {
  if (FONT[ch]) return FONT[ch];
  if (ch === "’" || ch === "‘") return FONT["'"];
  if (ch === "“" || ch === "”") return FONT['"'];
  if (ch === "–" || ch === "—") return FONT["-"];
  if (ch === "…" ) return FONT["."];
  return FONT["?"];
}
function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB, bold = false): void {
  let cx = x;
  for (const ch of s) {
    const g = glyphFor(ch);
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r * 5 + col] === "1") {
          fillRect(cx + col * scale, y + r * scale, scale, scale, c);
          if (bold) fillRect(cx + col * scale + 1, y + r * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}
function drawTextCentered(x: number, y: number, w: number, s: string, scale: number, c: RGB, bold = false): void {
  const tw = textWidth(s, scale) + (bold ? scale : 0);
  drawText(x + Math.floor((w - tw) / 2), y, s, scale, c, bold);
}
// Word-wrap into lines of at most maxW pixels at the given scale.
function wrapText(s: string, maxW: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textWidth(trial, scale) <= maxW) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      // A single word too long: hard-split it.
      let rest = w;
      while (textWidth(rest, scale) > maxW) {
        let n = 1;
        while (n < rest.length && textWidth(rest.slice(0, n + 1), scale) <= maxW) n++;
        lines.push(rest.slice(0, n));
        rest = rest.slice(n);
      }
      cur = rest;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawPara(x: number, y: number, w: number, s: string, scale: number, c: RGB, lineGap = 2): number {
  const lines = wrapText(s, w, scale);
  for (let i = 0; i < lines.length; i++) {
    drawText(x, y + i * (7 * scale + lineGap), lines[i], scale, c);
  }
  return lines.length * (7 * scale + lineGap);
}

// ---------- illustrations (all drawn, no photos) ----------
function drawRocketScene(x: number, y: number, w: number, h: number): void {
  // Dawn sky over the Jiuquan desert.
  const skyTop: RGB = [24, 48, 84];
  const skyMid: RGB = [214, 128, 60];
  const skyBot: RGB = [247, 220, 160];
  for (let yy = 0; yy < h; yy++) {
    const t = yy / h;
    const c: RGB = [
      Math.round(skyTop[0] + (skyMid[0] - skyTop[0]) * Math.min(1, t * 1.6)),
      Math.round(skyTop[1] + (skyMid[1] - skyTop[1]) * Math.min(1, t * 1.6)),
      Math.round(skyTop[2] + (skyMid[2] - skyTop[2]) * Math.min(1, t * 1.6)),
    ];
    if (t > 0.62) {
      const u = (t - 0.62) / 0.38;
      c[0] = Math.round(skyMid[0] + (skyBot[0] - skyMid[0]) * u);
      c[1] = Math.round(skyMid[1] + (skyBot[1] - skyMid[1]) * u);
      c[2] = Math.round(skyMid[2] + (skyBot[2] - skyMid[2]) * u);
    }
    hline(x, y + yy, w, c);
  }
  // Stars.
  const stars: Array<[number, number]> = [
    [14, 12], [52, 8], [96, 18], [150, 10], [210, 22], [260, 8], [40, 34], [180, 30], [230, 40],
  ];
  for (const s of stars) {
    if (s[0] < w && s[1] < h * 0.4) fillRect(x + s[0], y + s[1], 3, 3, WHITE);
  }
  // Desert ground.
  fillRect(x, y + h - 26, w, 26, [150, 104, 58]);
  fillRect(x, y + h - 26, w, 3, [120, 80, 40]);
  // Launch pad + gantry.
  fillRect(x + 18, y + h - 66, 8, 40, [70, 70, 74]);
  fillRect(x + 14, y + h - 70, 16, 5, [70, 70, 74]);
  fillRect(x + w - 40, y + h - 58, 6, 32, [90, 90, 96]);
  // Rocket, centre.
  const cx = x + Math.floor(w / 2);
  const noseY = y + 16;
  fillPoly([[cx - 13, noseY + 26], [cx, noseY], [cx + 13, noseY + 26]], [200, 40, 40]);
  fillRect(cx - 13, noseY + 26, 26, 62, [238, 238, 232]);
  fillRect(cx - 13, noseY + 26, 26, 10, RED);
  fillRect(cx - 13, noseY + 52, 26, 6, NAVY);
  fillRect(cx - 4, noseY + 62, 8, 12, [40, 40, 44]);
  // Fins.
  fillPoly([[cx - 13, noseY + 66], [cx - 26, noseY + 96], [cx - 13, noseY + 96]], RED);
  fillPoly([[cx + 13, noseY + 66], [cx + 26, noseY + 96], [cx + 13, noseY + 96]], RED);
  // Flame + smoke.
  const flameTip = Math.min(noseY + 122, y + h - 28);
  fillPoly([[cx - 9, noseY + 92], [cx + 9, noseY + 92], [cx, flameTip]], [255, 176, 32]);
  fillPoly([[cx - 5, noseY + 92], [cx + 5, noseY + 92], [cx, Math.min(noseY + 110, y + h - 30)]], [255, 240, 180]);
  fillCircle(cx - 34, y + h - 30, 12, [220, 214, 200]);
  fillCircle(cx + 36, y + h - 28, 14, [228, 222, 208]);
  fillCircle(cx + 14, y + h - 26, 9, [210, 204, 190]);
  // Red flag badge: first foreign astronaut.
  fillRect(x + w - 92, y + 10, 82, 22, RED);
  drawText(x + w - 86, y + 16, "41st mission", 1, WHITE, true);
}
function drawFireScene(x: number, y: number, w: number, h: number): void {
  // Smoky orange sky.
  for (let yy = 0; yy < h; yy++) {
    const t = yy / h;
    const c: RGB = [
      Math.round(120 + (230 - 120) * t),
      Math.round(52 + (120 - 52) * t),
      Math.round(24 + (60 - 24) * t),
    ];
    hline(x, y + yy, w, c);
  }
  // Sun disc behind smoke.
  fillCircle(x + w - 52, y + 30, 16, [255, 214, 120]);
  // Smoke columns.
  fillCircle(x + 60, y + 26, 18, [96, 88, 84]);
  fillCircle(x + 96, y + 18, 14, [110, 102, 98]);
  fillCircle(x + 150, y + 30, 16, [90, 82, 78]);
  fillCircle(x + 210, y + 22, 12, [104, 96, 92]);
  // Far hills.
  fillPoly([[x, y + h - 52], [x + 80, y + h - 78], [x + 170, y + h - 56], [x + 250, y + h - 74], [x + w, y + h - 58], [x + w, y + h], [x, y + h]], [74, 52, 36]);
  // Near ground.
  fillPoly([[x, y + h - 34], [x + 110, y + h - 46], [x + w, y + h - 30], [x + w, y + h], [x, y + h]], [46, 34, 22]);
  // Flame wall, centre-left.
  const fx = x + 96;
  const fy = y + h - 40;
  fillPoly([[fx - 34, fy], [fx - 10, fy - 52], [fx + 4, fy - 22], [fx + 18, fy - 58], [fx + 34, fy]], [230, 90, 16]);
  fillPoly([[fx - 20, fy], [fx - 4, fy - 34], [fx + 8, fy - 12], [fx + 20, fy - 38], [fx + 22, fy]], [255, 176, 32]);
  fillPoly([[fx - 8, fy], [fx, fy - 20], [fx + 10, fy]], [255, 240, 160]);
  // Lighthouse silhouette, right.
  const lx = x + w - 46;
  fillRect(lx, y + h - 96, 12, 62, [24, 24, 26]);
  fillRect(lx - 3, y + h - 102, 18, 6, [24, 24, 26]);
  fillRect(lx - 6, y + h - 108, 24, 6, RED);
  fillCircle(lx + 6, y + h - 100, 3, [255, 240, 160]);
  // Trees.
  for (const tx of [x + 18, x + 34, x + 250, x + 272]) {
    fillRect(tx, y + h - 62, 3, 28, [30, 22, 14]);
    fillCircle(tx + 1, y + h - 66, 8, [34, 60, 30]);
  }
  // Warning badge.
  fillRect(x + 10, y + 10, 128, 22, [20, 20, 20]);
  drawText(x + 16, y + 16, "TOO LATE TO LEAVE", 1, [255, 210, 60], true);
}
function drawChartScene(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [232, 228, 214]);
  // Capitol dome silhouette, top right.
  const dx = x + w - 78;
  fillRect(dx, y + 18, 56, 6, NAVY);
  fillEllipse(dx + 28, y + 20, 20, 12, NAVY);
  fillRect(dx + 26, y + 4, 4, 12, NAVY);
  fillRect(dx + 8, y + 24, 40, 26, NAVY);
  for (let i = 0; i < 4; i++) fillRect(dx + 10 + i * 10, y + 30, 5, 16, PAPER);
  // Bar chart: GDP, PCE, goods, claims.
  const baseY = y + h - 34;
  const bars: Array<[number, number, RGB, string]> = [
    [0, 78, TEAL, "GDP"],
    [1, 52, RED, "PCE"],
    [2, 64, NAVY, "GOODS"],
    [3, 40, GOLD, "CLAIMS"],
  ];
  const bw = 34;
  const gap = 14;
  const bx0 = x + 22;
  for (const b of bars) {
    const bx = bx0 + b[0] * (bw + gap);
    const bh = Math.round((b[1] / 90) * (h - 78));
    fillRect(bx, baseY - bh, bw, bh, b[2]);
    rect(bx, baseY - bh, bw, bh, INK, 1);
    drawText(bx - 2, baseY + 6, b[3], 1, INK, true);
  }
  hline(x + 14, baseY, w - 28, INK, 2);
  // Rising arrow.
  const arrowTop = Math.max(y + 6, baseY - 84);
  line(x + 26, arrowTop + 24, x + 120, arrowTop, RED);
  line(x + 120, arrowTop, x + 196, arrowTop + 12, RED);
  fillPoly([[x + 196, arrowTop + 12], [x + 182, arrowTop + 8], [x + 192, arrowTop + 24]], RED);
  // Clock badge 13:30 UTC.
  fillRect(x + 14, y + 10, 96, 22, NAVY);
  drawText(x + 20, y + 16, "13:30 UTC", 1, WHITE, true);
  drawText(x + 14, y + 40, "4 releases,", 1, INK);
  drawText(x + 14, y + 52, "one minute", 1, INK);
}
// Simplified continent outlines, in a 0..360 x 0..170 map space.
const CONTINENTS: Array<Array<[number, number]>> = [
  // North America
  [[18, 34], [58, 14], [104, 18], [128, 38], [118, 58], [96, 52], [88, 72], [64, 84], [38, 74], [16, 54]],
  // Greenland
  [[128, 8], [148, 6], [152, 18], [136, 22]],
  // South America
  [[96, 96], [122, 88], [138, 108], [128, 140], [112, 158], [100, 128]],
  // Africa
  [[196, 82], [232, 74], [256, 92], [250, 122], [232, 146], [212, 132], [194, 104]],
  // Europe
  [[200, 56], [228, 42], [252, 52], [244, 70], [216, 74], [198, 66]],
  // Asia
  [[252, 44], [300, 22], [344, 30], [358, 56], [336, 84], [306, 96], [282, 78], [256, 62]],
  // Australia
  [[312, 122], [344, 116], [352, 132], [330, 142], [312, 134]],
];
function drawWorldMap(x: number, y: number, w: number, h: number, ink: RGB, dot: RGB): void {
  const sx = w / 360;
  const sy = h / 170;
  const s = Math.min(sx, sy);
  const ox = x + (w - 360 * s) / 2;
  const oy = y + (h - 170 * s) / 2;
  // Graticule.
  for (let gx = 0; gx <= 360; gx += 60) vline(Math.round(ox + gx * s), Math.round(oy), Math.round(170 * s), LIGHT_GREY, 1);
  for (let gy = 0; gy <= 170; gy += 42) hline(Math.round(ox), Math.round(oy + gy * s), Math.round(360 * s), LIGHT_GREY, 1);
  // Dotted land: sample a grid, dot where inside a continent.
  for (let gy = 4; gy < 170; gy += 6) {
    for (let gx = 3; gx < 360; gx += 6) {
      for (const poly of CONTINENTS) {
        if (pointInPoly(gx, gy, poly)) {
          fillCircle(Math.round(ox + gx * s), Math.round(oy + gy * s), 2, dot);
          break;
        }
      }
    }
  }
  void ink;
}

// ---------- content: every story verified dated 25 November 2026 ----------
type Lead = { num: number; place: string; field: string; time: string; tag: string; headline: string; body: string; source: string; art: string };
type Small = { num: number; place: string; field: string; headline: string; body: string; source: string };
const LEADS: Lead[] = [
  {
    num: 1, place: "JIUQUAN, CHINA", field: "SPACE", time: "00:18 UTC", tag: "CONFIRMED",
    headline: "Shenzhou-24 lifts off with first foreign astronaut",
    body: "A Long March-2F rose from Jiuquan carrying Pakistan's Muhammad Zeeshan Ali beside Tang Hongbo and Wu Yi - the 41st crewed Chinese mission, bound for Tiangong.",
    source: "Xinhua / CMSA", art: "rocket",
  },
  {
    num: 2, place: "FLINDERS ISLAND, TASMANIA", field: "BUSHFIRE", time: "00:14 UTC", tag: "OFFICIAL",
    headline: "Flinders Island fire: 'too late to leave'",
    body: "Tasmania Fire Service put Killiecrankie, Leeka and Mount Tanner under an emergency warning and told residents and tourists to shelter in place.",
    source: "Tas Fire Service / ABC", art: "fire",
  },
  {
    num: 3, place: "WASHINGTON, USA", field: "ECONOMY", time: "13:30 UTC", tag: "DUE TODAY",
    headline: "Thanksgiving-eve data pile lands at 13:30 UTC",
    body: "Q3 GDP second estimate (seen ~3.4% annualised), October PCE inflation, durable goods and jobless claims all land at 13:30 UTC, a day early for the holiday.",
    source: "BEA / Labor Dept", art: "chart",
  },
];
const SMALLS: Small[] = [
  { num: 4, place: "CANBERRA, AUSTRALIA", field: "ECONOMY", headline: "Australia's October CPI jumps to 4.9%", body: "ABS: prices rose 4.9% in the year to October, up from 4.3%; trimmed mean 3.8%, hotter than the 4.8% forecast.", source: "ABS" },
  { num: 5, place: "CANBERRA, AUSTRALIA", field: "DIPLOMACY", headline: "Solomons signs treaty with Australia", body: "PMs Wale and Albanese sign the Australia-Solomon Islands Treaty in Canberra as Honiara's China pact lapses.", source: "PM's office / Reuters" },
  { num: 6, place: "SEOUL, SOUTH KOREA", field: "DEFENCE", headline: "Seoul scrambles jets as Russian planes near", body: "F-15Ks scrambled after Russian warplanes approached; a brief air-raid alert sounded on island areas.", source: "TWZ / Yonhap" },
  { num: 7, place: "HODEIDAH, YEMEN", field: "CONFLICT", headline: "Coalition warns civilians to leave Hodeidah port", body: "The Saudi-led coalition tells civilians to evacuate the Red Sea port after Houthi threats to hit Saudi ports.", source: "Jerusalem Post" },
  { num: 8, place: "TOKYO, JAPAN", field: "POLITICS", headline: "Censure threat stalls Takaichi's food-tax bill", body: "Six opposition parties agree to file a censure motion against education minister Seki; Diet debate halts.", source: "Nikkei / TBS" },
  { num: 9, place: "ASIA", field: "MARKETS", headline: "AI sell-off hits Asia at the open", body: "Seoul's Kospi falls again after Wall Street; Sydney and Tokyo open lower as technology names lead the retreat.", source: "Yonhap / ABC News" },
  { num: 10, place: "BRUSSELS, BELGIUM", field: "SUMMIT", headline: "EU and Western Balkans leaders meet in Brussels", body: "The summit stresses the region's strategic importance ahead of the 26-27 November European Council.", source: "European Council" },
  { num: 11, place: "GENEVA, SWITZERLAND", field: "CHESS", headline: "Gukesh faces Sindarov in world title Game 2", body: "Defending champion Gukesh plays white against Javokhir Sindarov at 14:00 CET; Game 1 on Tuesday was a draw.", source: "FIDE" },
  { num: 12, place: "MEXICO CITY, MEXICO", field: "RIGHTS", headline: "16 Days of Activism against gender violence", body: "Marches open the UN campaign against gender-based violence, running from today until 10 December.", source: "UN Women" },
];
const ALSO: Array<[number, string, string]> = [
  [13, "Seoul Metro strike averted by wage deal", "Yonhap"],
  [14, "Yongbyon may lift N. Korea uranium output", "38 North"],
  [15, "Taiz misses measles vaccine for 350,000", "Arab News"],
  [16, "EU Parliament to brief on migration, border funds", "EP"],
  [17, "Leaked FIFA files show 96-year World Cup fund plan", "AP"],
  [18, "PSG v Roma in the Champions League", "UEFA"],
  [19, "Fed Beige Book due 14:00 ET", "Federal Reserve"],
  [20, "Trump due to meet NATO chief Rutte", "White House"],
  [21, "Greece holds a nationwide strike", "Unions"],
  [22, "Storms threaten Thanksgiving travel", "US weather"],
  [23, "Astronaut Kutryk welcomes third child in orbit", "SpaceQ"],
  [24, "UN Business and Human Rights Forum closes", "UN"],
  [25, "CAS to rule on AFCON 2025 title dispute", "Court of Arbitration"],
];
const NUMBERS: Array<[string, string]> = [
  ["4.9%", "Australia Oct CPI, y/y"],
  ["41st", "crewed Chinese mission"],
  ["350,000", "children in Taiz, no measles jab"],
  ["16", "days of activism from today"],
  ["3", "Flinders areas under warning"],
  ["201K", "US jobless claims expected"],
];
const TIMELINE: Array<[string, string]> = [
  ["00:18", "Shenzhou up"],
  ["00:30", "AU CPI 4.9%"],
  ["01:00", "Korea jets"],
  ["11:00", "EU briefing"],
  ["13:30", "US data pile"],
  ["14:00", "Chess Game 2"],
  ["19:00", "Beige Book"],
];
const EXCLUDED =
  "COP31 climate summit ends with no fossil-fuel deal - Huawei guilty on 10 of 12 counts in New York trial - White House turkey pardon - Gukesh-Sindarov Game 1 ends in a draw - Houthi drone hits Riyadh tower, 11 hurt - Bank of Korea rate call";
const SOURCES =
  "SOURCES: Xinhua - CMSA - Reuters - ABS - Tas Fire Service - ABC News - BEA - Labor Dept - PM's office - Yonhap - Jerusalem Post - Nikkei - European Parliament - AP - UEFA - UN Women - FIDE. Every story dated Wednesday 25 November 2026 (UTC). Illustrations are drawings.";

// ---------- layout ----------
type Palette = { bg: RGB; panel: RGB; ink: RGB; muted: RGB; line: RGB; red: RGB; navy: RGB; teal: RGB; ochre: RGB; chip: RGB };
const CREAM_PAL: Palette = { bg: PAPER, panel: PAPER_DARK, ink: INK, muted: GREY, line: LIGHT_GREY, red: RED, navy: NAVY, teal: TEAL, ochre: OCHRE, chip: [232, 224, 206] };
const DARK_PAL: Palette = { bg: DARK_BG, panel: DARK_PANEL, ink: DARK_INK, muted: [170, 180, 195], line: DARK_LINE, red: [224, 82, 82], navy: [120, 160, 220], teal: [64, 190, 175], ochre: [240, 170, 60], chip: [38, 62, 100] };
type Variant = { pal: Palette; leadH: number; timeline: string; boldMast: boolean; smallCols: number; headScale: number };
const VARIANTS: Record<string, Variant> = {
  A: { pal: CREAM_PAL, leadH: 250, timeline: "top", boldMast: true, smallCols: 3, headScale: 3 },
  B: { pal: DARK_PAL, leadH: 250, timeline: "top", boldMast: true, smallCols: 3, headScale: 3 },
  C: { pal: CREAM_PAL, leadH: 250, timeline: "bottom", boldMast: true, smallCols: 3, headScale: 3 },
  D: { pal: CREAM_PAL, leadH: 208, timeline: "top", boldMast: false, smallCols: 3, headScale: 2 },
  E: { pal: CREAM_PAL, leadH: 250, timeline: "top", boldMast: true, smallCols: 2, headScale: 3 },
};
const FIELD_COLORS: Record<string, RGB> = {
  SPACE: NAVY, BUSHFIRE: [200, 60, 10], ECONOMY: TEAL, DIPLOMACY: [90, 60, 140],
  DEFENCE: [120, 40, 40], CONFLICT: RED, POLITICS: [140, 90, 10], MARKETS: TEAL,
  SUMMIT: NAVY, CHESS: [60, 60, 60], RIGHTS: [180, 30, 90],
};
function drawTimeline(P: Palette, x: number, y: number, w: number): void {
  drawText(x, y, "THE DAY IN UTC", 1, P.muted, true);
  const barY = y + 16;
  hline(x, barY, w, P.line, 2);
  const n = TIMELINE.length;
  for (let i = 0; i < n; i++) {
    const cx = x + Math.round(((i + 0.5) / n) * w);
    fillCircle(cx, barY + 1, 5, P.red);
    fillCircle(cx, barY + 1, 2, WHITE);
    const label = TIMELINE[i][0] + " " + TIMELINE[i][1];
    drawTextCentered(cx - 62, barY + 10, 124, label, 1, P.ink);
  }
}
function drawLeads(P: Palette, x: number, y: number, w: number, leadH: number, headScale: number): void {
  const gap = 12;
  const colW = Math.floor((w - gap * 2) / 3);
  const headStep = 7 * headScale + 2;
  const maxBody = headScale === 3 ? 3 : 2;
  const artH = leadH - (12 + 3 * headStep + 2 + maxBody * 10 + 4 + 10);
  for (let i = 0; i < 3; i++) {
    const L = LEADS[i];
    const cx0 = x + i * (colW + gap);
    if (L.art === "rocket") drawRocketScene(cx0, y, colW, artH);
    else if (L.art === "fire") drawFireScene(cx0, y, colW, artH);
    else drawChartScene(cx0, y, colW, artH);
    rect(cx0, y, colW, artH, P.ink, 1);
    // Number badge over the art's corner.
    fillRect(cx0, y + artH - 20, 22, 20, P.red);
    drawText(cx0 + 7, y + artH - 16, String(L.num), 1, WHITE, true);
    let ty = y + artH + 8;
    drawText(cx0, ty, L.place + " - " + L.field, 1, FIELD_COLORS[L.field] || P.navy, true);
    ty += 12;
    const headLines = wrapText(L.headline, colW, headScale);
    for (let k = 0; k < Math.min(3, headLines.length); k++) {
      drawText(cx0, ty, headLines[k], headScale, P.ink, true);
      ty += headStep;
    }
    ty += 2;
    const bodyLines = wrapText(L.body, colW, 1);
    for (let k = 0; k < Math.min(maxBody, bodyLines.length); k++) {
      drawText(cx0, ty, bodyLines[k], 1, P.ink);
      ty += 10;
    }
    drawText(cx0, ty + 2, L.tag + "  " + L.source + "  -  " + L.time, 1, P.muted, true);
  }
}
function drawSmalls(P: Palette, x: number, y: number, w: number, cols: number): number {
  const gap = 10;
  const colW = Math.floor((w - gap * (cols - 1)) / cols);
  const rows = Math.ceil(SMALLS.length / cols);
  const rowH = cols === 2 ? 48 : 82;
  for (let i = 0; i < SMALLS.length; i++) {
    const s = SMALLS[i];
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x0 = x + c * (colW + gap);
    const y0 = y + r * (rowH + 6);
    fillRect(x0, y0, colW, 3, FIELD_COLORS[s.field] || P.navy);
    fillRect(x0, y0 + 8, 18, 18, P.ink);
    drawText(x0 + 5, y0 + 12, String(s.num), 1, WHITE, true);
    drawText(x0 + 24, y0 + 8, s.place + " - " + s.field, 1, FIELD_COLORS[s.field] || P.navy, true);
    const headLines = wrapText(s.headline, colW, 2);
    let ty = y0 + 22;
    const maxHead = cols === 2 ? 1 : 2;
    for (let k = 0; k < Math.min(maxHead, headLines.length); k++) {
      drawText(x0, ty, headLines[k], 2, P.ink, true);
      ty += 16;
    }
    if (cols === 3) {
      const bodyLines = wrapText(s.body, colW, 1);
      for (let k = 0; k < Math.min(2, bodyLines.length); k++) {
        drawText(x0, ty, bodyLines[k], 1, P.ink);
        ty += 10;
      }
      drawText(x0, y0 + rowH - 10, s.source, 1, P.muted);
    }
  }
  return rows * (rowH + 6) - 6;
}
function drawBottom(P: Palette, x: number, y: number, w: number, h: number): void {
  const mapW = 330;
  const alsoW = 372;
  const numW = w - mapW - alsoW - 20;
  // Map panel.
  const mx = x;
  const mapH = h - 86;
  drawText(mx, y, "WHERE IT HAPPENED", 1, P.ink, true);
  drawText(mx, y + 12, "pins = story numbers", 1, P.muted);
  drawWorldMap(mx, y + 28, mapW, mapH, P.ink, [90, 110, 90]);
  const pins: Array<[number, number, number]> = [
    [288, 52, 1], [348, 140, 2], [52, 52, 3], [318, 122, 4], [352, 104, 5],
    [312, 56, 6], [232, 92, 7], [342, 44, 8], [208, 48, 10], [214, 56, 11],
  ];
  const mapS = Math.min(mapW / 360, mapH / 170);
  const mox = mx + (mapW - 360 * mapS) / 2;
  const moy = y + 28 + (mapH - 170 * mapS) / 2;
  for (const p of pins) {
    const px0 = Math.round(mox + p[0] * mapS);
    const py0 = Math.round(moy + p[1] * mapS);
    fillCircle(px0, py0, 7, P.red);
    drawText(px0 - 3, py0 - 3, String(p[2]), 1, WHITE, true);
  }
  drawText(mx, y + 28 + mapH + 4, "Asia 6 - Oceania 3 - Europe 6", 1, P.ink);
  drawText(mx, y + 28 + mapH + 16, "Americas 4 - Mid East 2 - Africa 1 - World 3", 1, P.ink);
  // Also-today panel.
  const ax = x + mapW + 10;
  drawText(ax, y, "ALSO ON WEDNESDAY 25 NOVEMBER 2026", 1, P.ink, true);
  drawText(ax, y + 12, "13 more stories", 1, P.muted);
  let ay = y + 30;
  for (const a of ALSO) {
    drawText(ax, ay, String(a[0]), 1, P.red, true);
    const lines = wrapText(a[1] + " - " + a[2], alsoW - 24, 1);
    drawText(ax + 24, ay, lines[0], 1, P.ink);
    if (lines.length > 1) drawText(ax + 24, ay + 9, lines[1], 1, P.muted);
    ay += lines.length > 1 ? 21 : 13;
  }
  // Numbers panel: big number left, label right.
  const nx = ax + alsoW + 10;
  drawText(nx, y, "THE DAY IN NUMBERS", 1, P.ink, true);
  let ny = y + 26;
  const rowStep = Math.floor((h - 30) / NUMBERS.length);
  for (const n of NUMBERS) {
    const bigW = textWidth(n[0], 3);
    drawText(nx, ny, n[0], 3, P.red, true);
    const lab = wrapText(n[1], numW - bigW - 10, 1);
    drawText(nx + bigW + 8, ny + 1, lab[0], 1, P.ink);
    if (lab.length > 1) drawText(nx + bigW + 8, ny + 11, lab[1], 1, P.ink);
    ny += rowStep;
    if (ny < y + h - 6) hline(nx, ny - 5, numW, P.line, 1);
  }
}
function render(variantName: string): void {
  const V = VARIANTS[variantName] || VARIANTS.A;
  const P = V.pal;
  fill(P.bg);
  const M = 20;
  const CW = W - 2 * M;
  let y = 14;
  // Kicker row.
  drawText(M, y, "THE WORLD IN ONE DAY", 2, P.ink, true);
  drawTextCentered(M, y, CW, "25 STORIES  -  7 REGIONS  -  ONE DAY", 2, P.red, true);
  const right = "EDITION 01:05 UTC";
  drawText(M + CW - textWidth(right, 1), y + 4, right, 1, P.muted);
  y += 30;
  hline(M, y, CW, P.ink, 3);
  hline(M, y + 5, CW, P.ink, 1);
  y += 10;
  // Masthead.
  drawTextCentered(M, y, CW, "Wednesday 25 November 2026", 6, P.ink, V.boldMast);
  y += 48;
  // Red standfirst.
  drawTextCentered(M, y, CW, "AI sell-off hits Asia  /  Censure threat in Tokyo  /  Flinders fire emergency", 2, P.red);
  y += 26;
  hline(M, y, CW, P.ink, 1);
  y += 8;
  if (V.timeline === "top") {
    drawTimeline(P, M, y, CW);
    y += 44;
  }
  const leadsY = y;
  drawLeads(P, M, leadsY, CW, V.leadH, V.headScale);
  y = leadsY + V.leadH + 10;
  hline(M, y, CW, P.ink, 1);
  y += 8;
  const smallH = drawSmalls(P, M, y, CW, V.smallCols);
  y += smallH + 10;
  hline(M, y, CW, P.ink, 1);
  y += 8;
  if (V.timeline === "bottom") {
    drawTimeline(P, M, y, CW);
    y += 44;
    hline(M, y, CW, P.ink, 1);
    y += 8;
  }
  const bottomY = y;
  const bottomH = H - 12 - 74 - bottomY;
  drawBottom(P, M, bottomY, CW, bottomH);
  y = bottomY + bottomH + 8;
  // Date check footer.
  fillRect(M, y, CW, 2, P.red);
  drawText(M, y + 7, "DATE CHECK - LEFT OUT BECAUSE THEY HAPPENED ON 24 NOVEMBER:", 1, P.red, true);
  const exLines = wrapText(EXCLUDED, CW, 1);
  let ey = y + 19;
  for (let i = 0; i < exLines.length; i++) {
    drawText(M, ey, exLines[i], 1, P.ink);
    ey += 10;
  }
  const srcLines = wrapText(SOURCES, CW, 1);
  let sy = ey + 4;
  for (const l of srcLines) {
    drawText(M, sy, l, 1, P.muted);
    sy += 10;
  }
  hline(M, H - 10, CW, P.ink, 2);
}
function main(): void {
  const variant = process.argv[2] || process.env.MAKEFUN_VARIANT || "B";
  render(variant);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(outDir, { recursive: true });
  const png = encodePNG();
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}
main();
