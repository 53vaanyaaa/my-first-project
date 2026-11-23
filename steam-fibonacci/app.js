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
    const LS = window.FIB_LABEL_SCALE || 1;
    const fs = (o.fs || 46) * LS, worldH = o.h || 0.05;
    const lines = String(text).split('\n');
    const c = document.createElement('canvas');
    let ctx = c.getContext('2d');
    const font = '700 ' + fs + 'px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.font = font;
    const tw = Math.max.apply(null, lines.map(l => ctx.measureText(l).width));
    const plain = o.bg === false;
    const px = (plain ? 10 : 26) * LS, py = (plain ? 6 : 16) * LS, lh = fs * 1.25;
    c.width = Math.ceil(tw + px * 2);
    c.height = Math.ceil(lh * lines.length + py * 2);
    ctx = c.getContext('2d');
    ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (!plain) {
      const r = 22 * LS, w = c.width - 4, h = c.height - 4;
      ctx.beginPath();
      ctx.moveTo(2 + r, 2); ctx.arcTo(2 + w, 2, 2 + w, 2 + h, r); ctx.arcTo(2 + w, 2 + h, 2, 2 + h, r);
      ctx.arcTo(2, 2 + h, 2, 2, r); ctx.arcTo(2, 2, 2 + w, 2, r); ctx.closePath();
      ctx.fillStyle = o.bg || 'rgba(8,16,36,0.82)'; ctx.fill();
      ctx.lineWidth = 4 * LS; ctx.strokeStyle = o.border || '#ffd54a'; ctx.stroke();
    }
    ctx.fillStyle = o.color || '#ffffff';
    if (plain) { ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 8; }
    lines.forEach((l, i) => ctx.fillText(l, c.width / 2, py + lh * (i + 0.5)));
    const tex = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true }));
    const k = worldH * LS / lh;
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

  /* ---------- общие формы и материалы ---------- */
  const rnd = i => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  const matCache = {};
  function pbr(hex, rough, metal, double) {
    const k = hex + '|' + rough + '|' + (metal || 0) + '|' + (double ? 1 : 0);
    if (!matCache[k]) matCache[k] = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal || 0, side: double ? THREE.DoubleSide : THREE.FrontSide });
    return matCache[k];
  }
  // Лепесток / лист: заострённый эллипс вдоль +X, изогнут вниз (droop) и «лодочкой» (cup)
  function bladeGeo(len, wid, droop, cup, belly) {
    const k = belly == null ? 0.6 : belly, s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(wid * 0.55, len * 0.12, wid * 0.62, len * k, 0, len);
    s.bezierCurveTo(-wid * 0.62, len * k, -wid * 0.55, len * 0.12, 0, 0);
    const g = new THREE.ShapeGeometry(s, 14), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), t = y / len, w = x / (wid * 0.5);
      p.setXYZ(i, y, -droop * t * t + cup * w * w * Math.sin(Math.PI * Math.min(1, t * 1.05)), x);
    }
    g.computeVertexNormals();
    return g;
  }

  /* ---------- 1. ПОДСОЛНУХ ---------- */
  function buildSunflower() {
    const root = new THREE.Group();
    const head = new THREE.Group();
    head.position.set(0, 0.5, 0);
    head.rotation.x = 0.5;                      // наклон «лицом» к зрителю
    root.add(head);

    // Семена по формуле Фогеля: радиус ~ √n, поворот n·137.5°. 610 — число Фибоначчи
    const N = 610, R = 0.34, c = R / Math.sqrt(N);
    const seeds = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05 }), N);
    const o = new THREE.Object3D(), col = new THREE.Color(), pos = [];
    const cG1 = new THREE.Color('#8a9a34'), cG2 = new THREE.Color('#55601e'), cS1 = new THREE.Color('#24160c'), cS2 = new THREE.Color('#4a2c16'), cF = new THREE.Color('#d0901e');
    for (let n = 0; n < N; n++) {
      const r = c * Math.sqrt(n + 0.5), a = n * GA, f = r / R;
      const x = r * Math.cos(a), z = r * Math.sin(a), y = 0.04 * (1 - f * f);   // выпуклая «корзинка»
      const hi34 = n % 34 === 0, hi55 = n % 55 === 0, hi = hi34 || hi55;
      const s = (0.0095 + 0.0068 * f) * (hi ? 1.3 : 1);
      o.position.set(x, y + (hi ? 0.008 : 0), z);
      o.rotation.set(0, -a, 0);
      o.scale.set(s * 1.35, s * 0.62, s * 0.85);   // зёрнышко вытянуто к краю
      o.updateMatrix(); seeds.setMatrixAt(n, o.matrix);
      if (hi34) col.set('#ff3b30'); else if (hi55) col.set('#18d4ff');
      else if (f < 0.14) col.copy(cG1).lerp(cG2, f / 0.14);                   // зелёные бутоны в центре
      else if (f < 0.8) col.copy(cS1).lerp(cS2, (f - 0.14) / 0.66).offsetHSL(0, 0, (rnd(n) - 0.5) * 0.05);
      else col.copy(cS2).lerp(cF, (f - 0.8) / 0.2);                            // раскрытые цветочки по краю
      seeds.setColorAt(n, col);
      pos.push([x, z, y]);
    }
    head.add(seeds);

    // зелёная «корзинка» и обёртка из 21 чашелистика
    const back = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.012, R * 0.55, 0.07, 48), pbr('#4d722b', 0.75));
    back.position.y = -0.04; head.add(back);
    const bract = bladeGeo(0.1, 0.05, 0.06, 0.004, 0.45);
    for (let i = 0; i < 21; i++) {
      const a = (i / 21) * Math.PI * 2 + 0.1, m = new THREE.Mesh(bract, pbr('#3d6a22', 0.8, 0, true));
      m.position.set(Math.cos(a) * (R - 0.03), -0.06, Math.sin(a) * (R - 0.03)); m.rotation.y = -a; head.add(m);
    }
    // лепестки: 34 + 21 (числа Фибоначчи), изогнутые, с разными оттенками
    const pA = bladeGeo(0.165, 0.056, 0.04, 0.007), pB = bladeGeo(0.15, 0.052, 0.055, 0.006);
    const petal = (geo, a, rr, y, i) => {
      const hex = '#' + new THREE.Color().setHSL(0.112 + rnd(i) * 0.022, 0.95, 0.5 + rnd(i + 99) * 0.07).getHexString();
      const m = new THREE.Mesh(geo, pbr(hex, 0.55, 0, true));
      m.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr); m.rotation.y = -a + (rnd(i + 7) - 0.5) * 0.08; head.add(m);
    };
    for (let i = 0; i < 34; i++) petal(pA, (i / 34) * Math.PI * 2, R - 0.012, 0.0, i);
    for (let i = 0; i < 21; i++) petal(pB, ((i + 0.5) / 21) * Math.PI * 2, R - 0.02, -0.014, 200 + i);

    // изогнутый стебель и два листа
    const stemPts = [V(0, 0, 0), V(0.012, 0.16, -0.008), V(-0.006, 0.33, -0.02), V(0, 0.46, -0.035)];
    root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stemPts), 24, 0.021, 10, false), pbr('#4f7d2a', 0.7)));
    const leaf = bladeGeo(0.21, 0.13, 0.07, 0.012, 0.42);
    [[0.15, 0], [0.27, Math.PI]].forEach(([h, ry], i) => {
      const g = new THREE.Group(); g.position.set(0, h, -0.01); g.rotation.set(0, ry + 0.3 * (i ? -1 : 1), 0.45);
      g.add(new THREE.Mesh(leaf, pbr('#3c7428', 0.7, 0, true))); root.add(g);
    });

    const list = [];
    const lbl = (t, p, op) => { const s = makeLabel(t, op); s.position.copy(p); head.add(s); list.push(s); return s; };
    const hl = (n) => V(pos[n][0], 0.12, pos[n][1]);
    const top = makeLabel('Подсолнух\nзолотое сечение φ', { fs: 48, h: 0.055 }); top.position.set(0, 1.12, 0); root.add(top); list.push(top);
    root.userData.labelList = list;
    return root;
  }

  /* ---------- 2. ШИШКА ---------- */
  function buildCone() {
    const root = new THREE.Group();
    const N = 89, H = 0.82, Rm = 0.27, Y0 = 0.07;       // 89 — число Фибоначчи
    const prof = t => Rm * Math.pow(1 - Math.pow(Math.min(1, Math.max(0, t)), 1.6), 0.55);
    // накопленная площадь поверхности — чтобы чешуйки лежали с одинаковой плотностью
    const M = 800, cum = [0];
    for (let i = 1; i <= M; i++) {
      const rho = prof((i - 0.5) / M), dr = prof(i / M) - prof((i - 1) / M);
      cum.push(cum[i - 1] + 2 * Math.PI * rho * Math.hypot(H / M, dr));
    }
    const total = cum[M], side = Math.sqrt(total / N);
    const tAt = f => { const target = f * total; let i = 1; while (i < M && cum[i] < target) i++; return (i - 1 + (target - cum[i - 1]) / (cum[i] - cum[i - 1])) / M; };

    // сердцевина и черенок
    const lp = []; for (let i = 0; i <= 30; i++) { const t = i / 30; lp.push(new THREE.Vector2(prof(t) * 0.78 + 0.001, Y0 + H * t)); }
    root.add(new THREE.Mesh(new THREE.LatheGeometry(lp, 24), pbr('#22130a', 0.9)));
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.04, 0.1, 10), pbr('#5b3a1e', 0.85)); stalk.position.y = 0.03; root.add(stalk);

    // чешуйка = деревянная пластина + ромбовидный кончик (апофиз) + тёмный «пупок»
    const sph = new THREE.SphereGeometry(1, 10, 7);
    const body = new THREE.InstancedMesh(sph, new THREE.MeshStandardMaterial({ roughness: 0.85 }), N);
    const apo = new THREE.InstancedMesh(sph, new THREE.MeshStandardMaterial({ roughness: 0.8 }), N);
    const umbo = new THREE.InstancedMesh(sph, new THREE.MeshStandardMaterial({ roughness: 0.9 }), N);
    const P = new THREE.Object3D(), m4 = new THREE.Matrix4(), m5 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), col = new THREE.Color();
    const put = (im, n, off, sc) => { m4.compose(off, q0, sc); m5.multiplyMatrices(P.matrix, m4); im.setMatrixAt(n, m5); };
    const marks = {};
    const wood1 = new THREE.Color('#8f5d33'), wood2 = new THREE.Color('#b0916e');
    for (let n = 0; n < N; n++) {
      const t = tAt((n + 0.5) / N), a = n * GA, rho = prof(t);
      const tt = Math.min(0.97, Math.max(0.02, t));
      const slope = Math.atan(-(prof(tt + 0.01) - prof(tt - 0.01)) / (0.02 * H));
      P.position.set(rho * Math.cos(a), Y0 + H * t, rho * Math.sin(a));
      P.rotation.set(0, -a, slope * 0.85 + 0.3, 'YZX'); P.updateMatrix();
      const s = side * (0.78 + 0.32 * Math.min(1, rho / Rm));
      put(body, n, V(0, 0, 0), V(0.26 * s, 0.85 * s, 0.62 * s));
      put(apo, n, V(0.15 * s, 0.42 * s, 0), V(0.2 * s, 0.33 * s, 0.52 * s));
      put(umbo, n, V(0.33 * s, 0.45 * s, 0), V(0.055 * s, 0.055 * s, 0.055 * s));
      col.set('#4a2a14').offsetHSL(0, 0, (rnd(n) - 0.5) * 0.05); body.setColorAt(n, col);
      if (n % 8 === 0) col.set('#ff8a00'); else if (n % 13 === 0) col.set('#18d4ff');
      else col.copy(wood1).lerp(wood2, rnd(n + 31) * 0.7);
      apo.setColorAt(n, col);
      col.set('#2b180b'); umbo.setColorAt(n, col);
      const tip = V(0.4 * s, 0.45 * s, 0).applyMatrix4(P.matrix);
      if (n === 8 * Math.floor((N - 1) / 8)) marks.pa = tip;
      if (n === 13 * Math.floor((N - 1) / 13)) marks.pb = tip;
    }
    root.add(body); root.add(apo); root.add(umbo);

    const list = [];
    const lbl = (t, p, op) => { const s = makeLabel(t, op); s.position.copy(p); root.add(s); list.push(s); return s; };
    lbl('Шишка\nзолотое сечение φ', V(0, 1.12, 0), { fs: 48, h: 0.055 });
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
    const S = 0.03;
    const P = lay.pole;
    const toW = (x, y, h) => V((x - P[0]) * S, h * S, -(y - P[1]) * S);
    // золотая спираль r = r0·φ^(2θ/π), проходящая через углы квадратов
    const A = lay.sq[SHOW - 1], aStart = [A.cx + A.s * Math.cos(A.a0), A.cy + A.s * Math.sin(A.a0)];
    const rA = Math.hypot(aStart[0] - P[0], aStart[1] - P[1]), thA = Math.atan2(aStart[1] - P[1], aStart[0] - P[0]);
    const rOf = th => rA * Math.pow(PHI, 2 * (th - thA) / Math.PI);
    const uEnd = thA + Math.PI / 2, rEnd = rOf(uEnd);
    const uStart = thA + (Math.PI / 2) * Math.log(0.06 / rA) / Math.log(PHI);
    const NU = 300, NV = 16, rho = 0.72, hh = 0.9, IN = 0.9;
    const cen = u => { const r = rOf(u); return [P[0] + r * Math.cos(u), P[1] + r * Math.sin(u), r * rho]; };
    // точка сечения трубки: off — смещение по радиусу, hg — по высоте (в клетках)
    const pt = (u, off, hg) => { const c = cen(u); return toW(c[0] + off * Math.cos(u), c[1] + off * Math.sin(u), hg); };

    // РАЗРЕЗ раковины (как на фото в учебниках): нижняя половина + перламутр внутри + перегородки камер
    function sweep(scale, colorFn) {
      const pos = [], colr = [], idx = [], tmp = new THREE.Color();
      for (let i = 0; i <= NU; i++) {
        const u = uStart + (uEnd - uStart) * i / NU, rr = cen(u)[2] * scale;
        for (let j = 0; j <= NV; j++) {
          const v = Math.PI + Math.PI * j / NV;
          const w = pt(u, rr * Math.cos(v), rr * hh * Math.sin(v)); pos.push(w.x, w.y, w.z);
          if (colorFn) { colorFn(u, v, tmp); colr.push(tmp.r, tmp.g, tmp.b); }
        }
      }
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
      g.setIndex(idx); g.computeVertexNormals(); return g;
    }
    // снаружи: кремовая раковина с «тигровыми» полосами, к устью полосы исчезают
    const cream = new THREE.Color('#f4ead8'), stripe = new THREE.Color('#a24a1c');
    const outer = sweep(1, (u, v, out) => {
      const fade = Math.min(1, Math.max(0, (uEnd - 0.12 * Math.PI - u) / (0.8 * Math.PI)));
      const st = Math.sin(u * 5.5 + 1.7 * Math.sin(v - Math.PI)) > 0.15 ? 1 : 0;
      out.copy(cream).lerp(stripe, st * fade * 0.92);
    });
    const shell = new THREE.Group();
    shell.add(new THREE.Mesh(outer, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.02, side: THREE.DoubleSide })));
    const nacre = new THREE.MeshStandardMaterial({ color: '#ece2d6', roughness: 0.16, metalness: 0.35, side: THREE.DoubleSide });
    shell.add(new THREE.Mesh(sweep(IN, null), nacre));
    // срез стенки (кольцо между внешней и внутренней поверхностью) в плоскости разреза
    const rim = [], rimIdx = [];
    [-1, 1].forEach(e => {
      const base = rim.length / 3;
      for (let i = 0; i <= NU; i++) {
        const u = uStart + (uEnd - uStart) * i / NU, rr = cen(u)[2];
        const a = pt(u, e * rr, 0), b = pt(u, e * rr * IN, 0); rim.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
      for (let i = 0; i < NU; i++) { const a = base + i * 2; rimIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    });
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rim, 3)); rg.setIndex(rimIdx); rg.computeVertexNormals();
    shell.add(new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: '#faf5ee', roughness: 0.3, side: THREE.DoubleSide })));
    // перегородки камер (вогнутые «тарелочки») — 12 камер на оборот, жилая камера у устья пустая
    const sp = [], sIdx = [], uLive = uEnd - 0.55 * Math.PI;
    for (let u = uStart + 0.3; u < uLive; u += Math.PI / 6) {
      const rr = cen(u)[2] * IN, c0 = cen(u), back = 0.35 * rr;
      const ctr = toW(c0[0] + back * Math.sin(u), c0[1] - back * Math.cos(u), -rr * hh * 0.35);
      const base = sp.length / 3; sp.push(ctr.x, ctr.y, ctr.z);
      for (let j = 0; j <= 12; j++) { const v = Math.PI + Math.PI * j / 12, w = pt(u, rr * Math.cos(v), rr * hh * Math.sin(v)); sp.push(w.x, w.y, w.z); }
      for (let j = 0; j < 12; j++) sIdx.push(base, base + 1 + j, base + 2 + j);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setIndex(sIdx); sg.computeVertexNormals();
    shell.add(new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: '#d9c7b2', roughness: 0.22, metalness: 0.3, side: THREE.DoubleSide })));
    // сифон — трубочка, соединяющая камеры
    const sip = []; for (let u = uStart + 0.3; u < uLive; u += 0.15) { const c0 = cen(u); sip.push(toW(c0[0], c0[1], -c0[2] * 0.12)); }
    if (sip.length > 3) shell.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sip), sip.length * 2, 0.0025, 6, false), pbr('#b98a5c', 0.5)));

    // Наложение: квадраты Фибоначчи + золотая спираль (в плоскости разреза)
    const Y = 0.15;
    const over = new THREE.Group(), list = [];
    for (let k = 0; k < SHOW; k++) {
      const b = lay.sq[k];
      over.add(polyline([toW(b.x0, b.y0, Y), toW(b.x1, b.y0, Y), toW(b.x1, b.y1, Y), toW(b.x0, b.y1, Y)], '#ffd54a', 0.0035, true, true));
      const ap = []; for (let i = 0; i <= 24; i++) { const a = b.a0 + (b.a1 - b.a0) * i / 24; ap.push(toW(b.cx + b.s * Math.cos(a), b.cy + b.s * Math.sin(a), Y)); }
      over.add(tube(ap, '#ff4d6d', 0.0055, true));
      // числа на квадратах убраны — видна только золотая спираль
    }
    const maxH = rEnd * rho * hh * S;
    const group = new THREE.Group(); group.add(shell); group.add(over);
    let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
    for (let k = 0; k < SHOW; k++) { const b = lay.sq[k]; bx0 = Math.min(bx0, b.x0); bx1 = Math.max(bx1, b.x1); by0 = Math.min(by0, b.y0); by1 = Math.max(by1, b.y1); }
    group.position.set(-((bx0 + bx1) / 2 - P[0]) * S, maxH + 0.005, ((by0 + by1) / 2 - P[1]) * S);
    root.add(group);
    const top = makeLabel('Наутилус\nзолотое сечение φ', { fs: 48, h: 0.055 }); top.position.set(0, 0.98, 0); root.add(top); list.push(top);
    root.userData.labelList = list;
    return root;
  }

  /* ---------- компонент сцены ---------- */
  const INFO = [
    { icon: '🌻', name: 'Подсолнух', html: '' },
    { icon: '🌲', name: 'Шишка', html: '' },
    { icon: '🐚', name: 'Наутилус', html: '' }
  ];

  window.FIBMODELS = { builders: [buildSunflower, buildCone, buildNautilus], INFO: INFO };

  AFRAME.registerComponent('fib-app', {
    init: function () {
      this.inAR = this.el.parentNode && this.el.parentNode.tagName === 'A-MARKER';
      this.models = [buildSunflower(), buildCone(), buildNautilus()];
      this.spin = new THREE.Group();              // вращается вокруг вертикали
      this.pitch = new THREE.Group();             // наклон пальцем
      this.pitch.add(this.spin);
      this.models.forEach(m => { m.visible = false; this.spin.add(m); });
      this.el.object3D.add(this.pitch);
      const sc = document.createElement('canvas'); sc.width = sc.height = 128;
      const sx = sc.getContext('2d'), gr = sx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      sx.fillStyle = gr; sx.fillRect(0, 0, 128, 128);
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; this.pitch.add(shadow);
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
      if (info) info.innerHTML = '<h2>' + INFO[i].icon + ' ' + INFO[i].name + '</h2>';
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
