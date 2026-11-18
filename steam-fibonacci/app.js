/* STEAM: Фибоначчи и золотое сечение в природе — три 3D-модели для AR.
 * Все модели строятся процедурно (без внешних файлов), числа считаются по формулам. */
(function () {
  'use strict';
  const THREE = AFRAME.THREE;
  const PHI = (1 + Math.sqrt(5)) / 2;          // 1.6180339…
  const GA = (2 * Math.PI) / (PHI * PHI);      // золотой угол, 137.5° в радианах

  /* ---------- вспомогательные функции ---------- */

  // Текстовая табличка (спрайт) — поддерживает кириллицу и всегда видна поверх модели
  function makeLabel(text, o) {
    o = o || {};
    const fs = o.fs || 46, worldH = o.h || 0.05;
    const lines = String(text).split('\n');
    const c = document.createElement('canvas');
    let ctx = c.getContext('2d');
    const font = '700 ' + fs + 'px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.font = font;
    const tw = Math.max.apply(null, lines.map(l => ctx.measureText(l).width));
    const plain = o.bg === false;
    const px = plain ? 10 : 26, py = plain ? 6 : 16, lh = fs * 1.25;
    c.width = Math.ceil(tw + px * 2);
    c.height = Math.ceil(lh * lines.length + py * 2);
    ctx = c.getContext('2d');
    ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (!plain) {
      const r = 22, w = c.width - 4, h = c.height - 4;
      ctx.beginPath();
      ctx.moveTo(2 + r, 2); ctx.arcTo(2 + w, 2, 2 + w, 2 + h, r); ctx.arcTo(2 + w, 2 + h, 2, 2 + h, r);
      ctx.arcTo(2, 2 + h, 2, 2, r); ctx.arcTo(2, 2, 2 + w, 2, r); ctx.closePath();
      ctx.fillStyle = o.bg || 'rgba(8,16,36,0.82)'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = o.border || '#ffd54a'; ctx.stroke();
    }
    ctx.fillStyle = o.color || '#ffffff';
    if (plain) { ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 8; }
    lines.forEach((l, i) => ctx.fillText(l, c.width / 2, py + lh * (i + 0.5)));
    const tex = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true }));
    const k = worldH / lh;
    sp.scale.set(c.width * k, c.height * k, 1);
    sp.renderOrder = 1000;
    sp.userData.isLabel = true;
    return sp;
  }

  // Отрезок-цилиндр между двумя точками (виден на телефоне, в отличие от линии в 1 пиксель)
  function seg(a, b, color, r, onTop) {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6, 1),
      new THREE.MeshBasicMaterial({ color: color, depthTest: !onTop, transparent: true }));
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    if (onTop) m.renderOrder = 500;
    return m;
  }
  function polyline(points, color, r, onTop, closed) {
    const g = new THREE.Group();
    for (let i = 0; i < points.length - 1; i++) g.add(seg(points[i], points[i + 1], color, r, onTop));
    if (closed) g.add(seg(points[points.length - 1], points[0], color, r, onTop));
    return g;
  }
  function tube(points, color, r, onTop) {
    const curve = new THREE.CatmullRomCurve3(points);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 2, r, 6, false),
      new THREE.MeshBasicMaterial({ color: color, depthTest: !onTop, transparent: true }));
    if (onTop) m.renderOrder = 500;
    return m;
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const std = (hex, rough) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough == null ? 0.7 : rough, metalness: 0.0 });

  /* ---------- 1. ПОДСОЛНУХ ---------- */
  function buildSunflower() {
    const root = new THREE.Group();
    const head = new THREE.Group();
    head.position.set(0, 0.5, 0);
    head.rotation.x = 0.5;                      // наклон «лицом» к зрителю
    root.add(head);

    const N = 610, R = 0.36, c = R / Math.sqrt(N);   // 610 — число Фибоначчи
    const seeds = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.65 }), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    const cA = new THREE.Color('#3b2412'), cB = new THREE.Color('#8a6a2b');
    const pos = [];
    for (let n = 0; n < N; n++) {
      const r = c * Math.sqrt(n + 0.5), a = n * GA;   // формула Фогеля: радиус ~ √n, поворот n·137.5°
      const x = r * Math.cos(a), z = r * Math.sin(a);
      const hi34 = n % 34 === 0, hi55 = n % 55 === 0;
      const s = (0.0105 + 0.0075 * (r / R)) * (hi34 || hi55 ? 1.35 : 1);
      m4.compose(V(x, (hi34 || hi55 ? 0.012 : 0), z), q, V(s, s * 0.55, s));
      seeds.setMatrixAt(n, m4);
      if (hi34) col.set('#ff3b30'); else if (hi55) col.set('#18d4ff');
      else col.copy(cA).lerp(cB, Math.min(1, (r / R) * 1.1));
      seeds.setColorAt(n, col);
      pos.push([x, z]);
    }
    head.add(seeds);

    const back = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.012, R * 0.65, 0.05, 48), std('#4b6b2c'));
    back.position.y = -0.03; head.add(back);
    const pm = std('#ffc107', 0.55), pg = new THREE.SphereGeometry(1, 10, 6);
    for (let i = 0; i < 34; i++) {                      // 34 лепестка — число Фибоначчи
      const a = (i / 34) * Math.PI * 2, p = new THREE.Mesh(pg, pm);
      p.scale.set(0.115, 0.01, 0.034);
      p.position.set(Math.cos(a) * (R + 0.075), -0.012, Math.sin(a) * (R + 0.075));
      p.rotation.y = -a; head.add(p);
    }
    // золотой угол: две линии от центра и дуга 137.5°
    const arc = []; for (let i = 0; i <= 30; i++) { const a = GA * i / 30; arc.push(V(Math.cos(a) * 0.24, 0.035, Math.sin(a) * 0.24)); }
    head.add(tube(arc, '#ffffff', 0.006, true));
    head.add(seg(V(0, 0.035, 0), V(0.4, 0.035, 0), '#ffffff', 0.004, true));
    head.add(seg(V(0, 0.035, 0), V(Math.cos(GA) * 0.4, 0.035, Math.sin(GA) * 0.4), '#ffffff', 0.004, true));

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.5, 10), std('#3f7d2a'));
    stem.position.y = 0.25; root.add(stem);
    [-1, 1].forEach(s => { const l = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), std('#4e9a34')); l.scale.set(0.13, 0.012, 0.05); l.position.set(s * 0.12, 0.17 + (s > 0 ? 0.07 : 0), 0); l.rotation.z = s * 0.5; root.add(l); });

    const labels = new THREE.Group(); root.add(labels);
    const L = (t, p, o) => { const s = makeLabel(t, o); s.position.copy(p); labels.add(s); return s; };
    const hl = (n) => V(pos[n][0], 0.1, pos[n][1]);
    // позиции подписей считаем в системе головы (она наклонена), поэтому кладём их в head
    const lbl = (t, p, o) => { const s = makeLabel(t, o); s.position.copy(p); head.add(s); labels.userData.list = (labels.userData.list || []).concat(s); return s; };
    lbl('137,5°', V(Math.cos(GA / 2) * 0.33, 0.1, Math.sin(GA / 2) * 0.33), { fs: 56, h: 0.06, border: '#ffffff' });
    lbl('34', hl(34 * 17), { fs: 56, h: 0.06, border: '#ff3b30', color: '#ff8a80' });
    lbl('55', hl(55 * 11), { fs: 56, h: 0.06, border: '#18d4ff', color: '#8be9ff' });
    lbl('610 семян', V(0, 0.28, -0.47), { fs: 46, h: 0.05 });
    const top = makeLabel('Подсолнух\n55 : 34 = 1,618 = φ', { fs: 48, h: 0.055 }); top.position.set(0, 1.12, 0); root.add(top);
    labels.userData.list.push(top);
    root.userData.labelList = labels.userData.list;
    return root;
  }

  /* ---------- 2. ШИШКА ---------- */
  function buildCone() {
    const root = new THREE.Group();
    const N = 89, H = 0.82, Rm = 0.27, Y0 = 0.07;       // 144 — число Фибоначчи
    const prof = t => Rm * Math.pow(1 - Math.pow(Math.min(1, Math.max(0, t)), 1.6), 0.55);
    // накопленная площадь поверхности — чтобы чешуйки лежали с одинаковой плотностью
    const M = 800, cum = [0];
    for (let i = 1; i <= M; i++) {
      const rho = prof((i - 0.5) / M), dr = prof(i / M) - prof((i - 1) / M);
      cum.push(cum[i - 1] + 2 * Math.PI * rho * Math.hypot(H / M, dr));
    }
    const total = cum[M], side = Math.sqrt(total / N);
    const tAt = f => { const target = f * total; let i = 1; while (i < M && cum[i] < target) i++; return (i - 1 + (target - cum[i - 1]) / (cum[i] - cum[i - 1])) / M; };

    // сердцевина
    const lp = []; for (let i = 0; i <= 30; i++) { const t = i / 30; lp.push(new THREE.Vector2(prof(t) * 0.8 + 0.001, Y0 + H * t)); }
    root.add(new THREE.Mesh(new THREE.LatheGeometry(lp, 24), std('#2a170a')));
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.1, 10), std('#5a3a1c')); stalk.position.y = 0.03; root.add(stalk);

    const sc = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.75 }), N);
    const o = new THREE.Object3D(), col = new THREE.Color();
    const marks = {};
    for (let n = 0; n < N; n++) {
      const t = tAt((n + 0.5) / N), a = n * GA, rho = prof(t);
      const tt = Math.min(0.97, Math.max(0.02, t));
      const slope = Math.atan(-(prof(tt + 0.01) - prof(tt - 0.01)) / (0.02 * H));  // угол наклона нормали
      o.position.set(rho * Math.cos(a), Y0 + H * t, rho * Math.sin(a));
      o.rotation.set(0, -a, slope * 0.9 + 0.12, 'YZX');
      const k = side * (0.55 + 0.45 * Math.min(1, rho / Rm + 0.25));
      o.scale.set(0.3 * side, 0.82 * side, 0.68 * k / side * side);
      o.updateMatrix(); sc.setMatrixAt(n, o.matrix);
      if (n % 8 === 0) { col.set('#ff8a00'); marks.a = n; }
      else if (n % 13 === 0) { col.set('#18d4ff'); marks.b = n; }
      else col.set('#7a4a22').offsetHSL(0, 0, (Math.sin(n * 12.9898) * 0.5) * 0.08);
      sc.setColorAt(n, col);
      if (n === 8 * Math.floor((N - 1) / 8)) marks.pa = o.position.clone();
      if (n === 13 * Math.floor((N - 1) / 13)) marks.pb = o.position.clone();
    }
    root.add(sc);

    const list = [];
    const lbl = (t, p, op) => { const s = makeLabel(t, op); s.position.copy(p); root.add(s); list.push(s); return s; };
    lbl('8', marks.pa.clone().add(V(0.09, 0.05, 0)), { fs: 56, h: 0.06, border: '#ff8a00', color: '#ffc27a' });
    lbl('13', marks.pb.clone().add(V(-0.1, 0.05, 0)), { fs: 56, h: 0.06, border: '#18d4ff', color: '#8be9ff' });
    lbl('89 чешуек', V(0, 0.0, 0.34), { fs: 44, h: 0.05 });
    lbl('Шишка\n13 : 8 = 1,625 ≈ φ', V(0, 1.12, 0), { fs: 48, h: 0.055 });
    root.userData.labelList = list;
    return root;
  }

  /* ---------- 3. НАУТИЛУС ---------- */
  // Раскладка квадратов Фибоначчи (1,1,2,3,5,8,13…) и дуг золотой спирали
  function goldenLayout(K) {
    const F = [1, 1]; while (F.length < K) F.push(F[F.length - 1] + F[F.length - 2]);
    const R = { x0: 0, x1: 1, y0: 0, y1: 1 };
    const sq = [{ x0: 0, x1: 1, y0: 0, y1: 1, s: 1, cx: 1, cy: 1, a0: Math.PI, a1: 1.5 * Math.PI }];
    const rects = [Object.assign({}, R)];
    const dirs = ['right', 'top', 'left', 'bottom'];
    for (let k = 1; k < K; k++) {
      const s = F[k], d = dirs[(k - 1) % 4]; let b, cx, cy, a0, a1;
      if (d === 'right') { b = { x0: R.x1, x1: R.x1 + s, y0: R.y0, y1: R.y1 }; cx = R.x1; cy = R.y1; a0 = 1.5 * Math.PI; a1 = 2 * Math.PI; R.x1 += s; }
      else if (d === 'top') { b = { x0: R.x0, x1: R.x1, y0: R.y1, y1: R.y1 + s }; cx = R.x0; cy = R.y1; a0 = 0; a1 = Math.PI / 2; R.y1 += s; }
      else if (d === 'left') { b = { x0: R.x0 - s, x1: R.x0, y0: R.y0, y1: R.y1 }; cx = R.x0; cy = R.y0; a0 = Math.PI / 2; a1 = Math.PI; R.x0 -= s; }
      else { b = { x0: R.x0, x1: R.x1, y0: R.y0 - s, y1: R.y0 }; cx = R.x1; cy = R.y0; a0 = Math.PI; a1 = 1.5 * Math.PI; R.y0 -= s; }
      b.s = s; b.cx = cx; b.cy = cy; b.a0 = a0; b.a1 = a1; sq.push(b); rects.push(Object.assign({}, R));
    }
    // полюс спирали — неподвижная точка подобия «прямоугольник k → k+1» (поворот 90° и рост в φ)
    const cen = r => [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
    const k1 = K - 2, c1 = cen(rects[k1]), c2 = cen(rects[k1 + 1]);
    // z' = a z + b, a = i·φ ;  z* = b / (1 − a)
    const ar = 0, ai = PHI;
    const br = c2[0] - (ar * c1[0] - ai * c1[1]), bi = c2[1] - (ar * c1[1] + ai * c1[0]);
    const dr = 1 - ar, di = -ai, den = dr * dr + di * di;
    const pole = [(br * dr + bi * di) / den, (bi * dr - br * di) / den];
    return { sq: sq, pole: pole, F: F };
  }

  function buildNautilus() {
    const root = new THREE.Group();
    const K = 14, lay = goldenLayout(K), SHOW = 7;       // рисуем 7 квадратов: 1 1 2 3 5 8 13
    const S = 0.034;
    const P = lay.pole;
    const toW = (x, y, h) => V((x - P[0]) * S, h * S, -(y - P[1]) * S);
    // золотая спираль r = r0·φ^(2θ/π), проходящая через углы квадратов
    const A = lay.sq[SHOW - 1], aStart = [A.cx + A.s * Math.cos(A.a0), A.cy + A.s * Math.sin(A.a0)];
    const rA = Math.hypot(aStart[0] - P[0], aStart[1] - P[1]), thA = Math.atan2(aStart[1] - P[1], aStart[0] - P[0]);
    const rOf = th => rA * Math.pow(PHI, 2 * (th - thA) / Math.PI);

    // Раковина: трубка, сечение растёт вдоль спирали
    const uEnd = thA + Math.PI / 2, rEnd = rOf(uEnd);
    const uStart = thA + (Math.PI / 2) * Math.log(0.06 / rA) / Math.log(PHI);
    const NU = 420, NV = 28, rho = 0.5, hh = 0.9;
    const pos = [], colr = [], idx = [], c1 = new THREE.Color('#f6ecd9'), c2 = new THREE.Color('#c0651f'), tmp = new THREE.Color();
    let maxH = 0;
    for (let i = 0; i <= NU; i++) {
      const u = uStart + (uEnd - uStart) * i / NU, r = rOf(u), rr = r * rho;
      const cx = P[0] + r * Math.cos(u), cy = P[1] + r * Math.sin(u);
      for (let j = 0; j <= NV; j++) {
        const v = (j / NV) * Math.PI * 2;
        const off = rr * Math.cos(v), hgt = rr * hh * Math.sin(v);
        const px = cx + off * Math.cos(u), py = cy + off * Math.sin(u);
        const w = toW(px, py, hgt); pos.push(w.x, w.y, w.z); maxH = Math.max(maxH, hgt * S);
        const stripe = hgt > 0 && Math.sin(u * 7.5 + Math.sin(v) * 1.2) > 0.2;
        tmp.copy(c1); if (stripe) tmp.lerp(c2, 0.85 * Math.min(1, Math.sin(v) * 2));
        colr.push(tmp.r, tmp.g, tmp.b);
      }
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const shell = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, side: THREE.DoubleSide }));
    const body = new THREE.Group(); body.add(shell);
    // перегородки между камерами
    const lp = [];
    for (let i = 4; i < NU; i += 9) {
      const u = uStart + (uEnd - uStart) * i / NU, r = rOf(u), rr = r * rho, cx = P[0] + r * Math.cos(u), cy = P[1] + r * Math.sin(u);
      for (let j = 0; j < NV; j++) for (const jj of [j, j + 1]) {
        const v = (jj / NV) * Math.PI * 2;
        const w = toW(cx + rr * Math.cos(v) * Math.cos(u), cy + rr * Math.cos(v) * Math.sin(u), rr * hh * Math.sin(v));
        lp.push(w.x, w.y * 1.003, w.z);
      }
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    body.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#5b3a1a', transparent: true, opacity: 0.55 })));

    // Наложение: квадраты Фибоначчи + золотая спираль (рисуем поверх раковины)
    const Y = 0;
    const over = new THREE.Group(), list = [];
    for (let k = 0; k < SHOW; k++) {
      const b = lay.sq[k];
      over.add(polyline([toW(b.x0, b.y0, Y), toW(b.x1, b.y0, Y), toW(b.x1, b.y1, Y), toW(b.x0, b.y1, Y)], '#ffd54a', 0.0035, true, true));
      const ap = []; for (let i = 0; i <= 24; i++) { const a = b.a0 + (b.a1 - b.a0) * i / 24; ap.push(toW(b.cx + b.s * Math.cos(a), b.cy + b.s * Math.sin(a), Y)); }
      over.add(tube(ap, '#ff4d6d', 0.0055, true));
      const t = makeLabel(String(lay.F[k]), { fs: 64, h: 0.075, bg: false, color: '#ffe082' });
      t.position.copy(toW((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, Y)); over.add(t); list.push(t);
    }
    const group = new THREE.Group(); group.add(body); group.add(over);
    // центрируем прямоугольник из квадратов над маркером
    let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
    for (let k = 0; k < SHOW; k++) { const b = lay.sq[k]; bx0 = Math.min(bx0, b.x0); bx1 = Math.max(bx1, b.x1); by0 = Math.min(by0, b.y0); by1 = Math.max(by1, b.y1); }
    group.position.set(-((bx0 + bx1) / 2 - P[0]) * S, maxH + 0.005, ((by0 + by1) / 2 - P[1]) * S);
    root.add(group);
    const top = makeLabel('Наутилус\n13 : 8 = 1,625 ≈ φ', { fs: 48, h: 0.055 }); top.position.set(0, 1.0, 0); root.add(top); list.push(top);
    const spiralNote = makeLabel('1 · 1 · 2 · 3 · 5 · 8 · 13', { fs: 44, h: 0.05 }); spiralNote.position.set(0, 0.88, 0); root.add(spiralNote); list.push(spiralNote);
    root.userData.labelList = list;
    root.userData.noSpin = false;
    return root;
  }

  /* ---------- компонент сцены ---------- */
  const INFO = [
    { icon: '🌻', name: 'Подсолнух', html:
      '<b>Золотой угол 137,5°</b> — каждое новое семечко поворачивается на него (360° ÷ φ²). ' +
      'Так семена укладываются без пустот и образуют спирали: <b style="color:#ff6b61">34</b> в одну сторону и <b style="color:#4fe0ff">55</b> в другую.<br>' +
      '<b>34 и 55 — соседние числа Фибоначчи.</b> 55 ÷ 34 = 1,6176 ≈ φ = 1,618…' },
    { icon: '🌲', name: 'Шишка', html:
      'Чешуйки тоже повёрнуты на золотой угол. Видно две системы спиралей: <b style="color:#ffa63d">8</b> и <b style="color:#4fe0ff">13</b> — соседние числа Фибоначчи.<br>' +
      '13 ÷ 8 = 1,625 ≈ φ. Всего 89 чешуек — тоже число Фибоначчи.' },
    { icon: '🐚', name: 'Наутилус', html:
      'Жёлтые квадраты со сторонами <b>1, 1, 2, 3, 5, 8, 13</b> (числа Фибоначчи) складываются в золотой прямоугольник. ' +
      'Красная спираль через их углы растёт в φ раз за каждую четверть оборота.<br>' +
      '13 ÷ 8 = 1,625 ≈ φ. <i>Настоящая раковина растёт чуть медленнее — это приближение.</i>' }
  ];

  AFRAME.registerComponent('fib-app', {
    init: function () {
      this.inAR = this.el.parentNode && this.el.parentNode.tagName === 'A-MARKER';
      this.models = [buildSunflower(), buildCone(), buildNautilus()];
      this.spin = new THREE.Group();              // вращается вокруг вертикали
      this.pitch = new THREE.Group();             // наклон пальцем
      this.pitch.add(this.spin);
      this.models.forEach(m => { m.visible = false; this.spin.add(m); });
      this.el.object3D.add(this.pitch);
      this.cur = -1; this.auto = true; this.labelsOn = true; this.yaw = 0; this.pit = 0;
      window.FIB = this;
      this.show(0);
      this.bindDrag();
    },
    show: function (i) {
      this.cur = i;
      if (!this.inAR) { this.pit = [0.45, 0.2, 0.95][i]; this.userDrag = false; }
      this.models.forEach((m, k) => m.visible = k === i);
      this.setLabels(this.labelsOn);
      document.querySelectorAll('.tab').forEach((b, k) => b.classList.toggle('on', k === i));
      const info = document.getElementById('info');
      if (info) info.innerHTML = '<h2>' + INFO[i].icon + ' ' + INFO[i].name + '</h2><p>' + INFO[i].html + '</p>';
    },
    setLabels: function (on) {
      this.labelsOn = on;
      this.models.forEach(m => (m.userData.labelList || []).forEach(s => s.visible = on));
    },
    bindDrag: function () {
      let down = false, lx = 0, ly = 0;
      const cv = document.body;
      cv.addEventListener('pointerdown', e => { if (e.target.closest('.ui')) return; down = true; lx = e.clientX; ly = e.clientY; });
      window.addEventListener('pointerup', () => down = false);
      window.addEventListener('pointermove', e => {
        if (!down) return;
        this.yaw += (e.clientX - lx) * 0.01; this.pit = Math.max(-0.6, Math.min(0.9, this.pit + (e.clientY - ly) * 0.006));
        lx = e.clientX; ly = e.clientY; this.userDrag = true;
      });
    },
    tick: function (t, dt) {
      if (this.auto && !this.userDrag) this.yaw += dt * 0.0003;
      this.spin.rotation.y = this.yaw; this.pitch.rotation.x = this.pit;
    }
  });
})();
