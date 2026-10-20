// Gera os ícones PNG do PWA sem dependências (sol + onda sobre fundo petróleo).
// Uso: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
};

function png(size) {
  const bg = [14, 31, 61];
  const sun = [255, 199, 44];
  const wave = [224, 64, 42];
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let px = bg;
      if ((u - 0.5) ** 2 + (v - 0.46) ** 2 < 0.2 ** 2) px = sun;
      const waveLine = 0.7 + 0.04 * Math.sin(u * Math.PI * 6);
      if (v > waveLine) px = wave;
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = px[0];
      raw[o + 1] = px[1];
      raw[o + 2] = px[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Imagem de compartilhamento 1200x630: tinta navy, sol e onda. Sem texto (o título vai nas tags Open Graph).
function ogPng() {
  const W = 1200;
  const H = 630;
  const bg = [14, 31, 61];
  const sun = [255, 199, 44];
  const wave = [224, 64, 42];
  const slot = [255, 255, 255];
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      let px = bg;
      if ((x - 420) ** 2 + (y - 270) ** 2 < 150 ** 2) px = sun;
      for (let i = 0; i < 3; i++) {
        const cx = 760 + i * 120;
        if ((x - cx) ** 2 + (y - 270) ** 2 < 44 ** 2) px = i < 2 ? sun : slot;
      }
      if (y > 470 + 18 * Math.sin(x / 55)) px = wave;
      const o = y * (W * 3 + 1) + 1 + x * 3;
      raw[o] = px[0];
      raw[o + 1] = px[1];
      raw[o + 2] = px[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/og.png', import.meta.url), ogPng());
for (const size of [192, 512]) {
  writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), png(size));
}
console.log('Ícones gerados em public/');
