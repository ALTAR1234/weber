// Animated background scenes, drawn live on a canvas behind the app and tinted
// with the background colours. Soft scenes render at low resolution and are
// blurred by CSS (cheap); crisp scenes render at screen resolution.

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
const rand = (a, b) => a + Math.random() * (b - a);

function hexToRgba(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(136,136,136,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

export const SCENES = {
  aurora: {
    name: 'Aurora',
    soft: true,
    preview: 'linear-gradient(160deg,#0b1026,#1d5c63 40%,#7b2ff7 70%,#0b1026)',
    draw(g, t, w, h, c) {
      g.fillStyle = '#05060d';
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      c.forEach((col, i) => {
        g.beginPath();
        const base = h * (0.3 + i * 0.13);
        g.moveTo(0, h);
        for (let x = 0; x <= w; x += 4) {
          const y = base + Math.sin(x * 0.012 + t * (0.35 + i * 0.1) + i) * h * 0.12 + Math.sin(x * 0.031 - t * 0.5) * h * 0.04;
          g.lineTo(x, y);
        }
        g.lineTo(w, h);
        const grad = g.createLinearGradient(0, base - h * 0.2, 0, h);
        grad.addColorStop(0, hexToRgba(col, 0));
        grad.addColorStop(0.25, hexToRgba(col, 0.55));
        grad.addColorStop(1, hexToRgba(col, 0));
        g.fillStyle = grad;
        g.fill();
      });
      g.globalCompositeOperation = 'source-over';
    },
  },
  waves: {
    name: 'Waves',
    soft: true,
    preview: 'linear-gradient(180deg,#0d1b2a,#1b4965 55%,#62b6cb)',
    draw(g, t, w, h, c) {
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#070912');
      sky.addColorStop(1, hexToRgba(c[0], 0.5));
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.moveTo(0, h);
        const base = h * (0.5 + i * 0.12);
        for (let x = 0; x <= w; x += 4) g.lineTo(x, base + Math.sin(x * (0.008 + i * 0.003) + t * (0.6 + i * 0.25)) * h * 0.05);
        g.lineTo(w, h);
        g.fillStyle = hexToRgba(c[i % c.length], 0.35 + i * 0.12);
        g.fill();
      }
    },
  },
  bokeh: {
    name: 'Bokeh',
    soft: true,
    preview: 'radial-gradient(circle at 30% 40%,#ff9a8b55 0 18%,transparent 19%),radial-gradient(circle at 70% 60%,#7f7fd555 0 22%,transparent 23%),#0e0b16',
    init(w, h) {
      this.dots = Array.from({ length: 34 }, () => ({ x: rand(0, w), y: rand(0, h), r: rand(h * 0.03, h * 0.12), s: rand(0.1, 0.4), p: rand(0, 6) }));
    },
    draw(g, t, w, h, c) {
      g.fillStyle = '#08070d';
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      this.dots.forEach((d, i) => {
        d.y -= d.s;
        if (d.y < -d.r) d.y = h + d.r;
        const x = d.x + Math.sin(t * 0.4 + d.p) * 12;
        const rg = g.createRadialGradient(x, d.y, 0, x, d.y, d.r);
        rg.addColorStop(0, hexToRgba(c[i % c.length], 0.45));
        rg.addColorStop(1, hexToRgba(c[i % c.length], 0));
        g.fillStyle = rg;
        g.beginPath();
        g.arc(x, d.y, d.r, 0, Math.PI * 2);
        g.fill();
      });
      g.globalCompositeOperation = 'source-over';
    },
  },
  stars: {
    name: 'Starfield',
    soft: false,
    preview: 'radial-gradient(1px 1px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 70% 60%,#fff,transparent),radial-gradient(2px 2px at 45% 80%,#fff,transparent),linear-gradient(#020212,#0b0b2a)',
    init(w, h) {
      this.stars = Array.from({ length: 420 }, () => ({ x: rand(0, w), y: rand(0, h), z: rand(0.2, 1), p: rand(0, 6) }));
      this.shoot = null;
    },
    draw(g, t, w, h, c) {
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#020210');
      sky.addColorStop(1, hexToRgba(c[0], 0.22));
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      for (const s of this.stars) {
        s.x -= s.z * 0.15;
        if (s.x < 0) s.x = w;
        g.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * s.z * 1.5 + s.p)) * s.z;
        g.fillStyle = '#fff';
        g.fillRect(s.x, s.y, s.z * 1.8, s.z * 1.8);
      }
      g.globalAlpha = 1;
      if (!this.shoot && Math.random() < 0.004) this.shoot = { x: rand(w * 0.3, w), y: rand(0, h * 0.4), life: 1 };
      if (this.shoot) {
        const s = this.shoot;
        const grad = g.createLinearGradient(s.x, s.y, s.x + 160, s.y - 60);
        grad.addColorStop(0, `rgba(255,255,255,${s.life})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.strokeStyle = grad;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(s.x, s.y);
        g.lineTo(s.x + 160, s.y - 60);
        g.stroke();
        s.x -= 14;
        s.y += 5;
        s.life -= 0.02;
        if (s.life <= 0) this.shoot = null;
      }
    },
  },
  rain: {
    name: 'Neon Rain',
    soft: false,
    preview: 'repeating-linear-gradient(100deg,transparent 0 14px,#ff4fd855 14px 15px),linear-gradient(#07040f,#140a24)',
    init(w, h) {
      this.drops = Array.from({ length: 220 }, () => ({ x: rand(0, w), y: rand(0, h), l: rand(10, 36), v: rand(6, 14), i: Math.floor(rand(0, 4)) }));
    },
    draw(g, t, w, h, c) {
      g.fillStyle = 'rgba(6,4,14,0.35)';
      g.fillRect(0, 0, w, h);
      g.lineWidth = 1.4;
      for (const d of this.drops) {
        g.strokeStyle = hexToRgba(c[d.i % c.length], 0.75);
        g.beginPath();
        g.moveTo(d.x, d.y);
        g.lineTo(d.x - d.l * 0.25, d.y + d.l);
        g.stroke();
        d.y += d.v;
        d.x -= d.v * 0.25;
        if (d.y > h) {
          d.y = -d.l;
          d.x = rand(0, w * 1.2);
        }
      }
    },
  },
  grid: {
    name: 'Retro Grid',
    soft: false,
    preview: 'linear-gradient(transparent 55%,#ff2bd633 56%),radial-gradient(circle at 50% 52%,#ffb347 0 16%,transparent 17%),linear-gradient(#12002a,#3a0548 55%,#0a0014 56%)',
    draw(g, t, w, h, c) {
      const horizon = h * 0.55;
      const sky = g.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, '#0c0020');
      sky.addColorStop(1, hexToRgba(c[0], 0.6));
      g.fillStyle = sky;
      g.fillRect(0, 0, w, horizon);
      g.fillStyle = '#07000f';
      g.fillRect(0, horizon, w, h - horizon);
      // sun
      const sunR = h * 0.18;
      const sun = g.createLinearGradient(0, horizon - sunR * 2, 0, horizon);
      sun.addColorStop(0, '#ffd56b');
      sun.addColorStop(1, '#ff3d9a');
      g.fillStyle = sun;
      g.beginPath();
      g.arc(w / 2, horizon, sunR, Math.PI, 0);
      g.fill();
      g.fillStyle = '#0c0020';
      for (let i = 0; i < 6; i++) g.fillRect(w / 2 - sunR, horizon - sunR * 0.12 * (i + 1) - i * 3, sunR * 2, 2 + i);
      // grid
      g.strokeStyle = hexToRgba(c[1] ?? '#ff2bd6', 0.8);
      g.lineWidth = 1.2;
      const speed = (t * 0.6) % 1;
      for (let i = 0; i < 18; i++) {
        const z = (i + speed) / 18;
        const y = horizon + Math.pow(z, 2.2) * (h - horizon);
        g.globalAlpha = z;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
      g.globalAlpha = 0.8;
      for (let i = -20; i <= 20; i++) {
        g.beginPath();
        g.moveTo(w / 2 + i * 20, horizon);
        g.lineTo(w / 2 + i * w * 0.12, h);
        g.stroke();
      }
      g.globalAlpha = 1;
    },
  },
};

let canvas = null;
let raf = 0;
let sceneId = null;

export function startScene(id) {
  const scene = SCENES[id];
  if (!scene) return stopScene();
  if (sceneId === id && canvas?.isConnected) return;
  stopScene();
  sceneId = id;
  canvas = document.createElement('canvas');
  canvas.className = 'bd-scene' + (scene.soft ? ' soft' : '');
  document.getElementById('wall').prepend(canvas);
  const g = canvas.getContext('2d');
  const scale = scene.soft ? 0.25 : Math.min(devicePixelRatio, 1.5);
  let w = 0;
  let h = 0;
  const resize = () => {
    w = canvas.width = Math.round(innerWidth * scale);
    h = canvas.height = Math.round(innerHeight * scale);
    scene.init?.(w, h);
  };
  resize();
  canvas._resize = resize;
  addEventListener('resize', resize);
  let colors = [];
  let lastColors = 0;
  const start = performance.now();
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    if (now - lastColors > 1000) {
      colors = ['--art-1', '--art-2', '--art-3', '--art-4'].map(css);
      lastColors = now;
    }
    const still = document.documentElement.classList.contains('no-motion');
    scene.draw(g, still ? 0 : (now - start) / 1000, w, h, colors);
  };
  raf = requestAnimationFrame(frame);
}

export function stopScene() {
  cancelAnimationFrame(raf);
  if (canvas) {
    removeEventListener('resize', canvas._resize);
    canvas.remove();
  }
  canvas = null;
  sceneId = null;
}
