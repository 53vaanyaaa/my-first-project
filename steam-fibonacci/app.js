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
    const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
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
  /* ---------- процедурные текстуры (рисуются кодом, без файлов) ---------- */
  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function toTex(c, srgb) {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
  }
  // карта нормалей (рельеф) из карты высот: светлое = выпуклое
  function normalFrom(hc, strength) {
    const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
    const c = mkCanvas(w, h), x = c.getContext('2d'), out = x.createImageData(w, h);
    const H = (i, j) => src[(((j + h) % h) * w + ((i + w) % w)) * 4] / 255;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const dx = (H(i + 1, j) - H(i - 1, j)) * strength, dy = (H(i, j + 1) - H(i, j - 1)) * strength;
      const l = Math.hypot(dx, dy, 1), k = (j * w + i) * 4;
      out.data[k] = (-dx / l * 0.5 + 0.5) * 255; out.data[k + 1] = (dy / l * 0.5 + 0.5) * 255; out.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[k + 3] = 255;
    }
    x.putImageData(out, 0, 0);
    return toTex(c, false);
  }
  // прожилки лепестка/листа: веер линий от основания (низ холста) к кончику (верх)
  function veins(x, w, h, n, style, lw, midrib) {
    x.strokeStyle = style; x.lineCap = 'round';
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n - 0.5, sx = w / 2 + f * w * 0.12, ex = w / 2 + f * w * 0.95;
      x.lineWidth = lw * (1 - Math.abs(f)); x.beginPath(); x.moveTo(sx, h);
      x.bezierCurveTo(sx + f * w * 0.3, h * 0.6, ex, h * 0.35, ex * 0.9 + w * 0.05, h * 0.06); x.stroke();
    }
    if (midrib) { x.lineWidth = lw * 2.2; x.beginPath(); x.moveTo(w / 2, h); x.lineTo(w / 2, h * 0.04); x.stroke(); }
  }
  function speckle(x, w, h, n, style, r) { x.fillStyle = style; for (let i = 0; i < n; i++) { x.beginPath(); x.arc(rnd(i * 3.1) * w, rnd(i * 7.7) * h, r * (0.4 + rnd(i * 1.3)), 0, 7); x.fill(); } }

  const TEXC = {};
  function T(kind) {
    if (TEXC[kind]) return TEXC[kind];
    let map, hc, str = 3;
    if (kind === 'sunPetal') {
      map = mkCanvas(256, 512); const x = map.getContext('2d');
      const g = x.createLinearGradient(0, 512, 0, 0); g.addColorStop(0, '#a84400'); g.addColorStop(0.25, '#e67e00'); g.addColorStop(0.7, '#ffae00'); g.addColorStop(1, '#ffc414');
      x.fillStyle = g; x.fillRect(0, 0, 256, 512);
      veins(x, 256, 512, 11, 'rgba(160,80,0,0.35)', 3, false);
      speckle(x, 256, 512, 400, 'rgba(255,240,180,0.08)', 2);
      hc = mkCanvas(256, 512); const y = hc.getContext('2d'); y.fillStyle = '#fff'; y.fillRect(0, 0, 256, 512); veins(y, 256, 512, 11, 'rgba(0,0,0,0.7)', 5, false);
    } else if (kind === 'rose') {
      map = mkCanvas(256, 512); const x = map.getContext('2d');
      const g = x.createLinearGradient(0, 512, 0, 0); g.addColorStop(0, '#140003'); g.addColorStop(0.3, '#4a020c'); g.addColorStop(0.75, '#820818'); g.addColorStop(1, '#9e1024');
      x.fillStyle = g; x.fillRect(0, 0, 256, 512);
      const e = x.createLinearGradient(0, 0, 256, 0); e.addColorStop(0, 'rgba(255,60,80,0.14)'); e.addColorStop(0.5, 'rgba(0,0,0,0.15)'); e.addColorStop(1, 'rgba(255,60,80,0.14)');
      x.fillStyle = e; x.fillRect(0, 0, 256, 512);
      veins(x, 256, 512, 9, 'rgba(40,0,8,0.12)', 2, false);
      speckle(x, 256, 512, 1500, 'rgba(255,120,140,0.04)', 1.2);   // «бархат»
      hc = mkCanvas(256, 512); const y = hc.getContext('2d'); y.fillStyle = '#fff'; y.fillRect(0, 0, 256, 512); veins(y, 256, 512, 9, 'rgba(0,0,0,0.3)', 3, false); str = 1.2;
    } else if (kind === 'leaf') {
      map = mkCanvas(256, 512); const x = map.getContext('2d');
      const g = x.createLinearGradient(0, 512, 0, 0); g.addColorStop(0, '#2b5a1c'); g.addColorStop(0.5, '#3f7d2a'); g.addColorStop(1, '#4f8f34');
      x.fillStyle = g; x.fillRect(0, 0, 256, 512);
      veins(x, 256, 512, 14, 'rgba(170,220,120,0.35)', 2.5, true);
      hc = mkCanvas(256, 512); const y = hc.getContext('2d'); y.fillStyle = '#777'; y.fillRect(0, 0, 256, 512); veins(y, 256, 512, 14, 'rgba(255,255,255,0.9)', 4, true);
    } else if (kind === 'wood') {          // серая детализация: оттенок задаёт цвет чешуйки
      map = mkCanvas(512, 512); const x = map.getContext('2d'); x.fillStyle = '#e6e6e6'; x.fillRect(0, 0, 512, 512);
      hc = mkCanvas(512, 512); const y = hc.getContext('2d'); y.fillStyle = '#888'; y.fillRect(0, 0, 512, 512);
      for (let k = 0; k < 90; k++) {
        const yy = rnd(k) * 512, a = 3 + rnd(k + 9) * 6, f = 0.01 + rnd(k + 4) * 0.02, dark = 120 + rnd(k + 2) * 90;
        x.strokeStyle = 'rgba(' + [dark, dark * 0.95, dark * 0.9].map(Math.round) + ',0.55)'; x.lineWidth = 1 + rnd(k + 5) * 3;
        y.strokeStyle = 'rgba(0,0,0,0.5)'; y.lineWidth = x.lineWidth;
        [x, y].forEach(cx => { cx.beginPath(); for (let i = 0; i <= 512; i += 8) { const v = yy + Math.sin(i * f + k) * a; i ? cx.lineTo(i, v) : cx.moveTo(i, v); } cx.stroke(); });
      }
      speckle(x, 512, 512, 900, 'rgba(90,70,50,0.12)', 2);
    } else if (kind === 'skin') {
      map = mkCanvas(512, 512); const x = map.getContext('2d'); x.fillStyle = '#f4f4f4'; x.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 160; i++) { const r = 20 + rnd(i) * 60, g = x.createRadialGradient(rnd(i * 2) * 512, rnd(i * 5) * 512, 0, rnd(i * 2) * 512, rnd(i * 5) * 512, r); g.addColorStop(0, rnd(i * 9) > 0.5 ? 'rgba(220,120,110,0.07)' : 'rgba(255,230,210,0.07)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 512, 512); }
      speckle(x, 512, 512, 1200, 'rgba(160,100,90,0.06)', 1.3);
      hc = mkCanvas(512, 512); const y = hc.getContext('2d'); y.fillStyle = '#fff'; y.fillRect(0, 0, 512, 512); speckle(y, 512, 512, 2600, 'rgba(0,0,0,0.35)', 1.2); str = 1.5;
    } else if (kind === 'shell') {          // раковина: кремовая с «языками пламени», к устью полосы исчезают
      map = mkCanvas(2048, 256); const x = map.getContext('2d');
      const g = x.createLinearGradient(0, 0, 2048, 0); g.addColorStop(0, '#e9dcc6'); g.addColorStop(1, '#f7efe2'); x.fillStyle = g; x.fillRect(0, 0, 2048, 256);
      for (let k = 0; k < 22; k++) {
        const cx = Math.pow((k + 0.5) / 22, 0.8) * 2048, fade = Math.min(1, Math.max(0, (2010 - cx) / 160));
        if (fade <= 0) continue;
        x.fillStyle = 'rgba(150,62,22,' + (0.85 * fade).toFixed(3) + ')'; x.beginPath();
        const wd = 28 + rnd(k) * 20;
        for (let yy = 0; yy <= 256; yy += 8) x.lineTo(cx + Math.sin(yy * 0.05 + k) * 16 + (yy - 128) * 0.25, yy);
        for (let yy = 256; yy >= 0; yy -= 8) x.lineTo(cx + wd * (0.5 + 0.5 * Math.sin(yy * 0.02 + k * 2)) + Math.sin(yy * 0.05 + k) * 16 + (yy - 128) * 0.25, yy);
        x.fill();
      }
      for (let i = 0; i < 2048; i += 6) { x.fillStyle = 'rgba(120,90,60,' + (0.03 + rnd(i) * 0.05).toFixed(3) + ')'; x.fillRect(i, 0, 1, 256); }   // линии роста
      hc = mkCanvas(1024, 128); const y = hc.getContext('2d'); y.fillStyle = '#888'; y.fillRect(0, 0, 1024, 128);
      for (let i = 0; i < 1024; i += 3) { y.fillStyle = 'rgba(255,255,255,' + (0.1 + rnd(i) * 0.25).toFixed(3) + ')'; y.fillRect(i, 0, 1, 128); } str = 1.2;
    } else if (kind === 'nacre') {          // перламутр: пастельные переливы
      map = mkCanvas(512, 512); const x = map.getContext('2d'); x.fillStyle = '#efe7df'; x.fillRect(0, 0, 512, 512);
      for (let k = 0; k < 40; k++) {
        x.strokeStyle = 'hsla(' + Math.round(rnd(k) * 360) + ',55%,82%,0.22)'; x.lineWidth = 6 + rnd(k + 3) * 18;
        x.beginPath(); const yy = rnd(k + 7) * 512; for (let i = 0; i <= 512; i += 16) { const v = yy + Math.sin(i * 0.02 + k) * 22; i ? x.lineTo(i, v) : x.moveTo(i, v); } x.stroke();
      }
    }
    TEXC[kind] = { map: toTex(map, true), normal: hc ? normalFrom(hc, str) : null };
    return TEXC[kind];
  }
  const texMatCache = {};
  function texMat(kind, tint, rough, double, extra) {
    const key = kind + tint + rough + double + JSON.stringify(extra || {});
    if (texMatCache[key]) return texMatCache[key];
    const t = T(kind), P = extra && extra.clearcoat ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const m = new P(Object.assign({ map: t.map, color: tint, roughness: rough, metalness: 0, side: double ? THREE.DoubleSide : THREE.FrontSide }, extra || {}));
    if (t.normal) { m.normalMap = t.normal; m.normalScale = new THREE.Vector2(0.7, 0.7); }
    return (texMatCache[key] = m);
  }

  /* ---------- «кинематограф» для сайта: тональная кривая, студийные отражения, тени ---------- */
  const srgb2lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  function linearize(root) {   // цвета задаются в sRGB; при sRGB-выводе их надо перевести в линейные
    const seen = new Set();
    root.traverse(o => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach(m => { if (seen.has(m)) return; seen.add(m); if (m.color) m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear(); if (m.map) m.map.encoding = THREE.sRGBEncoding; m.needsUpdate = true; });
      if (o.isInstancedMesh && o.instanceColor && !seen.has(o.instanceColor)) { seen.add(o.instanceColor); const a = o.instanceColor.array; for (let i = 0; i < a.length; i++) a[i] = srgb2lin(a[i]); o.instanceColor.needsUpdate = true; }
      if (o.isMesh && !o.isInstancedMesh && o.material && !o.material.depthTest === false) {}
    });
  }
  function setupCinematic(renderer, scene) {
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // студия: небо-градиент + тёплый софтбокс + холодный контровой
    const env = new THREE.Scene(), geo = new THREE.SphereGeometry(10, 32, 16), cols = [], p = geo.attributes.position;
    const top = new THREE.Color('#8fa8d8'), mid = new THREE.Color('#e8dcc8'), bot = new THREE.Color('#2a221c'), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 10; if (y > 0) c.copy(mid).lerp(top, y); else c.copy(mid).lerp(bot, -y); cols.push(c.r * 0.32, c.g * 0.32, c.b * 0.32); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    env.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })));
    const box = (w, h, col, pos) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(pos[0], pos[1], pos[2]); m.lookAt(0, 0, 0); env.add(m); };
    box(5, 4, new THREE.Color(3.2, 2.9, 2.5), [-4, 6, 5]);
    box(3, 6, new THREE.Color(1.2, 1.5, 2.2), [6, 3, -5]);
    box(8, 2, new THREE.Color(0.9, 0.9, 0.9), [0, 9, 0]);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.035).texture;
  }
  function addShadowRig(parent) {   // ключевой свет с мягкой тенью + «ловец тени» на столе
    const key = new THREE.DirectionalLight(0xfff0dc, 1.6);
    key.position.set(-1.2, 2.6, 1.8); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    Object.assign(key.shadow.camera, { left: -1, right: 1, top: 1.6, bottom: -0.6, near: 0.1, far: 8 });
    const tgt = new THREE.Object3D(); parent.add(tgt); key.target = tgt; parent.add(key);
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: 0.38 }));
    catcher.rotation.x = -Math.PI / 2; catcher.position.y = 0.001; catcher.receiveShadow = true; parent.add(catcher);
  }
  function enableShadows(root) {
    root.traverse(o => { if (o.isMesh) { const onTop = o.material && o.material.depthTest === false; o.castShadow = !onTop && !o.isSprite; o.receiveShadow = !onTop; } });
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
      g.attributes.uv.setXY(i, x / wid + 0.5, t);
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
    const seeds = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 5), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.05 }), N);
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
    // золотой рисунок на корзинке (центр спирали = центр цветка)
    const ovS = goldenOverlay(0.56, true); ovS.position.y = 0.075; head.add(ovS);

    // зелёная «корзинка» и обёртка из 21 чашелистика
    const back = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.012, R * 0.55, 0.07, 48), pbr('#4d722b', 0.75));
    back.position.y = -0.04; head.add(back);
    const bract = bladeGeo(0.1, 0.05, 0.06, 0.004, 0.45);
    for (let i = 0; i < 21; i++) {
      const a = (i / 21) * Math.PI * 2 + 0.1, m = new THREE.Mesh(bract, texMat('leaf', '#a8c890', 0.75, true));
      m.position.set(Math.cos(a) * (R - 0.03), -0.06, Math.sin(a) * (R - 0.03)); m.rotation.y = -a; head.add(m);
    }
    // лепестки: 34 + 21 (числа Фибоначчи), изогнутые, с разными оттенками
    const pA = bladeGeo(0.165, 0.056, 0.04, 0.007), pB = bladeGeo(0.15, 0.052, 0.055, 0.006);
    const petal = (geo, a, rr, y, i) => {
      const hex = '#' + new THREE.Color().setHSL(0.1 + Math.floor(rnd(i) * 5) / 4 * 0.03, 0.55, 0.8 + Math.floor(rnd(i + 99) * 5) / 4 * 0.15).getHexString();
      const m = new THREE.Mesh(geo, texMat('sunPetal', hex, 0.55, true));
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
      g.add(new THREE.Mesh(leaf, texMat('leaf', '#ffffff', 0.62, true))); root.add(g);
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
    const wt = T('wood'), body = new THREE.InstancedMesh(sph, new THREE.MeshStandardMaterial({ roughness: 0.85, map: wt.map, normalMap: wt.normal }), N);
    const apo = new THREE.InstancedMesh(sph, new THREE.MeshStandardMaterial({ roughness: 0.78, map: wt.map, normalMap: wt.normal }), N);
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
    // золотой рисунок спереди шишки
    const ovC = goldenOverlay(0.46, false); ovC.rotation.x = Math.PI / 2; ovC.position.set(0, Y0 + H * 0.45, Rm * 0.95); root.add(ovC);

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
      const pos = [], colr = [], idx = [], uvs = [], tmp = new THREE.Color();
      for (let i = 0; i <= NU; i++) {
        const u = uStart + (uEnd - uStart) * i / NU, rr = cen(u)[2] * scale;
        for (let j = 0; j <= NV; j++) {
          const v = Math.PI + Math.PI * j / NV;
          const w = pt(u, rr * Math.cos(v), rr * hh * Math.sin(v)); pos.push(w.x, w.y, w.z); uvs.push(i / NU, j / NV);
          if (colorFn) { colorFn(u, v, tmp); colr.push(tmp.r, tmp.g, tmp.b); }
        }
      }
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(idx); g.computeVertexNormals(); return g;
    }
    // снаружи: кремовая раковина с «тигровыми» полосами, к устью полосы исчезают
    const cream = new THREE.Color('#f4ead8'), stripe = new THREE.Color('#a24a1c');
    const outer = sweep(1, null);
    const shell = new THREE.Group();
    shell.add(new THREE.Mesh(outer, texMat('shell', '#ffffff', 0.3, true, { clearcoat: 0.8, clearcoatRoughness: 0.12 })));
    const nacre = texMat('nacre', '#ffffff', 0.14, true, { metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05 });
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
    shell.add(new THREE.Mesh(sg, texMat('nacre', '#e2d4c4', 0.18, true, { metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 })));
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

  /* ---------- «Золотой рисунок»: квадраты Фибоначчи + золотая спираль (как у наутилуса) ---------- */
  // Плоский рисунок в плоскости XZ (y = 0). width — ширина по длинной стороне.
  // centerOnPole: true — центр спирали в начале координат; иначе — центр прямоугольника.
  function goldenOverlay(width, centerOnPole, show) {
    const SHOW = show || 7, lay = goldenLayout(14), P = lay.pole;
    let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
    for (let k = 0; k < SHOW; k++) { const b = lay.sq[k]; bx0 = Math.min(bx0, b.x0); bx1 = Math.max(bx1, b.x1); by0 = Math.min(by0, b.y0); by1 = Math.max(by1, b.y1); }
    const S = width / Math.max(bx1 - bx0, by1 - by0);
    const ox = centerOnPole ? P[0] : (bx0 + bx1) / 2, oy = centerOnPole ? P[1] : (by0 + by1) / 2;
    const toW = (x, y) => V((x - ox) * S, 0, -(y - oy) * S);
    const g = new THREE.Group(), th = Math.max(0.0035, width * 0.009);
    for (let k = 0; k < SHOW; k++) {
      const b = lay.sq[k];
      g.add(polyline([toW(b.x0, b.y0), toW(b.x1, b.y0), toW(b.x1, b.y1), toW(b.x0, b.y1)], '#ffd54a', th * 0.65, true, true));
      const ap = []; for (let i = 0; i <= 24; i++) { const a = b.a0 + (b.a1 - b.a0) * i / 24; ap.push(toW(b.cx + b.s * Math.cos(a), b.cy + b.s * Math.sin(a))); }
      g.add(tube(ap, '#ff4d6d', th, true));
    }
    return g;
  }

  /* ---------- 4. РОЗА ---------- */
  function buildRose() {
    const root = new THREE.Group();
    const head = new THREE.Group(); head.position.set(0, 0.52, 0); head.rotation.x = 0.35; root.add(head);
    // Лепестки по золотому углу 137.5°: внутренние маленькие и сомкнутые, внешние большие и раскрытые
    const N = 34;
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1), a = i * GA;
      const len = 0.07 + 0.17 * Math.pow(f, 0.8), wid = len * (0.95 + 0.25 * f);
      const geo = bladeGeo(len, wid, -0.02 + 0.07 * f * f, wid * (0.42 - 0.22 * f), 0.72);
      const hex = '#' + new THREE.Color().setHSL(0, 0.3, 0.6 + 0.4 * Math.round(f * 5) / 5).getHexString();
      const m = new THREE.Mesh(geo, texMat('rose', hex, 0.72, true));
      const o = new THREE.Group(); o.rotation.set(0, -a, 1.35 - 1.05 * Math.pow(f, 0.7), 'YZX');
      m.position.x = 0.01 + 0.04 * f; o.add(m); o.position.y = -0.02 * f; head.add(o);
    }
    // чашелистики, стебель, листья
    const sep = bladeGeo(0.13, 0.04, 0.09, 0.004, 0.4);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, o = new THREE.Group(); o.rotation.set(0, -a, -0.25, 'YZX'); o.position.y = -0.04; o.add(new THREE.Mesh(sep, texMat('leaf', '#9ab889', 0.75, true))); head.add(o); }
    const recept = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), pbr('#3d6b26', 0.75)); recept.position.y = -0.05; head.add(recept);
    const stemPts = [V(0, 0, 0), V(-0.015, 0.18, 0.01), V(0.01, 0.36, -0.01), V(0, 0.48, -0.02)];
    root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stemPts), 24, 0.013, 8, false), pbr('#3e6e28', 0.7)));
    const leaf = bladeGeo(0.12, 0.075, 0.03, 0.008, 0.45);
    [[0.17, 0.4], [0.3, Math.PI + 0.3]].forEach(([h, ry]) => { const g = new THREE.Group(); g.position.set(0, h, 0); g.rotation.set(0, ry, 0.5); g.add(new THREE.Mesh(leaf, texMat('leaf', '#d8e8d0', 0.6, true))); root.add(g); });
    // золотой рисунок поверх цветка (центр спирали = центр розы)
    const ov = goldenOverlay(0.5, true); ov.position.y = 0.09; head.add(ov);
    const list = [];
    const top = makeLabel('Роза\nзолотое сечение φ', { fs: 48, h: 0.055 }); top.position.set(0, 1.0, 0); root.add(top); list.push(top);
    root.userData.labelList = list;
    return root;
  }

  /* ---------- 5. РУКА ---------- */
  function buildHand() {
    const root = new THREE.Group();
    const skin = texMat('skin', '#e0a98a', 0.5, false, { clearcoat: 0.12, clearcoatRoughness: 0.5 }), nail = new THREE.MeshPhysicalMaterial({ color: '#f1cfc2', roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.1 });
    skin.normalScale = new THREE.Vector2(0.35, 0.35);
    const hand = new THREE.Group(); hand.position.set(0, 0.06, 0); root.add(hand);
    // ладонь и запястье
    const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), skin); palm.scale.set(0.17, 0.2, 0.06); palm.position.y = 0.32; hand.add(palm);
    [[0.075, 0.25, 0.012, 0.08, 0.11, 0.045], [-0.08, 0.27, 0.01, 0.065, 0.12, 0.042]].forEach(([px, py, pz, sx, sy, sz]) => { const mm = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), skin); mm.scale.set(sx, sy, sz); mm.position.set(px, py, pz); hand.add(mm); });
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.11, 0.24, 32), skin); wrist.scale.z = 0.55; wrist.position.y = 0.1; hand.add(wrist);
    const sph = new THREE.SphereGeometry(1, 24, 16);
    // палец: фаланги длиной d, d·φ, d·φ² — каждая следующая в φ раз длиннее
    function finger(x, y, d, r, splay, curl) {
      let g = new THREE.Group(); g.position.set(x, y, 0); g.rotation.z = splay; hand.add(g);
      const lens = [d * PHI * PHI, d * PHI, d];
      lens.forEach((L, k) => {
        const rr = r * (1 - 0.1 * k);
        const j = new THREE.Mesh(sph, skin); j.scale.setScalar(rr * 1.05); g.add(j);
        const c = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.92, rr, L, 20), skin); c.position.y = L / 2; g.add(c);
        const n = new THREE.Group(); n.position.y = L; n.rotation.x = curl; g.add(n); g = n;
        if (k === 2) { const tip = new THREE.Mesh(sph, skin); tip.scale.setScalar(rr * 0.92); g.add(tip);
          const nl = new THREE.Mesh(sph, nail); nl.scale.set(rr * 0.75, rr * 0.9, rr * 0.25); nl.position.set(0, -rr * 0.6, -rr * 0.75); g.add(nl); }
      });
    }
    finger(-0.11, 0.48, 0.042, 0.026, 0.12, -0.12);   // мизинец
    finger(-0.04, 0.51, 0.052, 0.029, 0.03, -0.1);    // безымянный
    finger(0.035, 0.52, 0.056, 0.03, -0.02, -0.1);    // средний
    finger(0.11, 0.5, 0.052, 0.029, -0.1, -0.1);      // указательный
    // большой палец
    (function () {
      let g = new THREE.Group(); g.position.set(0.15, 0.24, 0.01); g.rotation.set(0, 0, -0.85); hand.add(g);
      [0.09, 0.065, 0.045].forEach((L, k) => {
        const rr = 0.034 * (1 - 0.08 * k), j = new THREE.Mesh(sph, skin); j.scale.setScalar(rr); g.add(j);
        const c = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.92, rr, L, 12), skin); c.position.y = L / 2; g.add(c);
        const n = new THREE.Group(); n.position.y = L; n.rotation.z = 0.2; g.add(n); g = n;
        if (k === 2) { const tip = new THREE.Mesh(sph, skin); tip.scale.setScalar(rr * 0.9); g.add(tip); }
      });
    })();
    // золотой рисунок: вертикально, поверх ладони и пальцев
    const ov = goldenOverlay(0.5, false); ov.rotation.x = Math.PI / 2; ov.position.set(0.0, 0.55, 0.08); hand.add(ov);
    const list = [];
    const top = makeLabel('Рука\nзолотое сечение φ', { fs: 48, h: 0.055 }); top.position.set(0, 1.12, 0); root.add(top); list.push(top);
    root.userData.labelList = list;
    return root;
  }

  /* ---------- компонент сцены ---------- */
  const INFO = [
    { icon: '🌻', name: 'Подсолнух', html: '' },
    { icon: '🌲', name: 'Шишка', html: '' },
    { icon: '🐚', name: 'Наутилус', html: '' },
    { icon: '🌹', name: 'Роза', html: '' },
    { icon: '✋', name: 'Рука', html: '' }
  ];

  window.FIBMODELS = { builders: [buildSunflower, buildCone, buildNautilus, buildRose, buildHand], INFO: INFO, linearize: linearize, setupCinematic: setupCinematic, addShadowRig: addShadowRig, enableShadows: enableShadows };

  AFRAME.registerComponent('fib-app', {
    init: function () {
      this.inAR = this.el.parentNode && this.el.parentNode.tagName === 'A-MARKER';
      this.models = [buildSunflower(), buildCone(), buildNautilus(), buildRose(), buildHand()];
      this.spin = new THREE.Group();              // вращается вокруг вертикали
      this.pitch = new THREE.Group();             // наклон пальцем
      this.pitch.add(this.spin);
      this.models.forEach(m => { m.visible = false; this.spin.add(m); });
      this.el.object3D.add(this.pitch);
      this.models.forEach(m => { linearize(m); enableShadows(m); });
      addShadowRig(this.el.object3D);
      const sceneEl = this.el.sceneEl, go = () => setupCinematic(sceneEl.renderer, sceneEl.object3D);
      if (sceneEl.renderer) go(); else sceneEl.addEventListener('renderstart', go, { once: true });
      const sc = document.createElement('canvas'); sc.width = sc.height = 128;
      const sx = sc.getContext('2d'), gr = sx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(0,0,0,0.3)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
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
      if (!this.inAR) { this.pit = [0.45, 0.2, 0.95, 0.55, 0.05][i]; this.userDrag = false; }
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
