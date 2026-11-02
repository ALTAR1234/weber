// Built-in wallpapers for people with nothing to upload. Each is a small SVG
// scene turned into a data URL, so they're sharp at any size and ship with the
// app (no downloads, no licensing questions).

const svg = (body, defs = '') =>
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${body}</svg>`);

const lin = (id, stops, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;

export const WALLPAPERS = [
  {
    id: 'dunes',
    name: 'Desert Dusk',
    url: svg(
      `<rect width="1600" height="1000" fill="url(#s)"/><circle cx="1080" cy="560" r="150" fill="#ffd9a0" opacity=".9"/>
       <path d="M0 700 C300 600 520 640 800 700 S1300 640 1600 690 V1000 H0Z" fill="#c2603f"/>
       <path d="M0 790 C260 720 560 760 860 820 S1380 760 1600 800 V1000 H0Z" fill="#8f3b2f"/>
       <path d="M0 880 C340 830 700 870 1000 920 S1400 880 1600 900 V1000 H0Z" fill="#5a2228"/>`,
      lin('s', [[0, '#2b1a4a'], [0.55, '#e0607e'], [1, '#ffb27a']])
    ),
  },
  {
    id: 'mountains',
    name: 'Midnight Peaks',
    url: svg(
      `<rect width="1600" height="1000" fill="url(#s)"/><circle cx="1250" cy="230" r="70" fill="#f4f1de"/>
       <path d="M0 720 L260 430 L420 600 L640 340 L900 640 L1120 420 L1360 650 L1600 480 V1000 H0Z" fill="#283e6b"/>
       <path d="M0 820 L220 600 L460 780 L720 540 L980 800 L1240 600 L1600 780 V1000 H0Z" fill="#1a2747"/>
       <path d="M0 920 L300 760 L600 900 L900 780 L1250 920 L1600 820 V1000 H0Z" fill="#0d1428"/>`,
      lin('s', [[0, '#060b1f'], [1, '#3b4f8a']])
    ),
  },
  {
    id: 'blobs',
    name: 'Neon Bloom',
    url: svg(
      `<rect width="1600" height="1000" fill="#0b0716"/><g filter="url(#b)">
       <circle cx="420" cy="380" r="300" fill="#ff3cac"/><circle cx="1150" cy="300" r="320" fill="#784ba0"/>
       <circle cx="900" cy="800" r="300" fill="#2b86c5"/><circle cx="260" cy="860" r="200" fill="#ffb86b"/></g>`,
      '<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="120"/></filter>'
    ),
  },
  {
    id: 'ocean',
    name: 'Deep Ocean',
    url: svg(
      `<rect width="1600" height="1000" fill="url(#s)"/>
       <path d="M0 520 Q200 480 400 520 T800 520 T1200 520 T1600 520 V1000 H0Z" fill="#0f4c75" opacity=".7"/>
       <path d="M0 640 Q200 600 400 640 T800 640 T1200 640 T1600 640 V1000 H0Z" fill="#0b3a5c" opacity=".85"/>
       <path d="M0 780 Q200 740 400 780 T800 780 T1200 780 T1600 780 V1000 H0Z" fill="#072a44"/>`,
      lin('s', [[0, '#bbe1fa'], [0.5, '#3282b8'], [1, '#0f2a44']])
    ),
  },
  {
    id: 'holo',
    name: 'Holographic',
    url: svg(
      `<rect width="1600" height="1000" fill="url(#a)"/><rect width="1600" height="1000" fill="url(#b)" opacity=".7"/>`,
      lin('a', [[0, '#a8edea'], [0.5, '#fed6e3'], [1, '#c3cfe2']], 1, 1) + lin('b', [[0, '#667eea00'], [0.5, '#764ba2'], [1, '#f093fb00']], 1, 0)
    ),
  },
  {
    id: 'forest',
    name: 'Night Forest',
    url: svg(
      `<rect width="1600" height="1000" fill="url(#s)"/>
       ${Array.from({ length: 26 }, (_, i) => {
         const x = i * 64 - 20;
         const hgt = 260 + ((i * 97) % 220);
         return `<path d="M${x} 1000 L${x + 40} ${1000 - hgt} L${x + 80} 1000Z" fill="#0c1f17"/>`;
       }).join('')}
       ${Array.from({ length: 22 }, (_, i) => {
         const x = i * 78 + 10;
         const hgt = 180 + ((i * 61) % 160);
         return `<path d="M${x} 1000 L${x + 46} ${1000 - hgt} L${x + 92} 1000Z" fill="#06120c"/>`;
       }).join('')}`,
      lin('s', [[0, '#0b132b'], [0.6, '#1c3d3a'], [1, '#2f6b4f']])
    ),
  },
  {
    id: 'peach',
    name: 'Peach Glow',
    url: svg(
      `<rect width="1600" height="1000" fill="#ffe8d6"/><g filter="url(#b)"><circle cx="300" cy="200" r="380" fill="#ff9a8b"/>
       <circle cx="1300" cy="300" r="360" fill="#ffd3a5"/><circle cx="800" cy="950" r="420" fill="#fd6585"/></g>`,
      '<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="140"/></filter>'
    ),
  },
  {
    id: 'mono',
    name: 'Graphite',
    url: svg(
      `<rect width="1600" height="1000" fill="url(#s)"/>
       ${Array.from({ length: 40 }, (_, i) => `<line x1="${i * 50 - 400}" y1="1000" x2="${i * 50 + 200}" y2="0" stroke="#ffffff" stroke-opacity=".035" stroke-width="2"/>`).join('')}`,
      lin('s', [[0, '#1c1c1f'], [1, '#050506']], 1, 1)
    ),
  },
];
