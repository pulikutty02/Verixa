/* =====================================================================
   VERIXA — Hero 3D
   A quiet, premium WebGL centerpiece for the homepage hero: a faceted
   instrument-core wireframe with a slow-drifting particle field, both
   in the site's gold/emerald palette. Mouse parallax only — no auto
   spin that fights for attention, just a live, held-still object.
   Skips entirely on reduced-motion or if three.js fails to load.
   ===================================================================== */
(function () {
  const mount = document.getElementById('hero-3d');
  if (!mount || typeof THREE === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const GOLD = 0xc6a15b;
  const GOLD_BRIGHT = 0xe8cf9a;
  const EMERALD = 0x3f7c67;

  let w = mount.clientWidth || mount.parentElement.clientWidth;
  let h = mount.clientHeight || mount.parentElement.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
  camera.position.set(0, 0, 9);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);
  mount.appendChild(renderer.domElement);

  const rig = new THREE.Group();
  scene.add(rig);

  /* ── faceted instrument core: icosahedron wireframe, offset dual-shell ── */
  const coreGeo = new THREE.IcosahedronGeometry(2.15, 1);
  const coreMat = new THREE.MeshBasicMaterial({
    color: GOLD, wireframe: true, transparent: true, opacity: 0.55,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  rig.add(core);

  const innerGeo = new THREE.IcosahedronGeometry(1.35, 0);
  const innerMat = new THREE.MeshBasicMaterial({
    color: EMERALD, wireframe: true, transparent: true, opacity: 0.35,
  });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  rig.add(inner);

  /* soft core glow point via an additive sprite */
  function glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(232,207,154,0.9)');
    g.addColorStop(1, 'rgba(232,207,154,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(3.2, 3.2, 1);
  rig.add(glow);

  /* ── orbiting particle field ── */
  const COUNT = window.innerWidth < 768 ? 260 : 520;
  const positions = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const r = 3.2 + Math.random() * 3.4;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
    positions[i * 3 + 2] = r * Math.cos(phi);
    sizes[i] = Math.random() * 2 + 0.5;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({
    color: GOLD_BRIGHT, size: 0.035, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* ── interaction: gentle mouse parallax, no forced auto-spin ── */
  let targetRotX = 0, targetRotY = 0;
  let curRotX = 0, curRotY = 0;
  let lastInteract = 0;

  function onPointerMove(e) {
    const rect = mount.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    targetRotY = nx * 0.5;
    targetRotX = ny * 0.3;
    lastInteract = performance.now();
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  let clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // idle drift when the user hasn't touched the pointer recently
    const idle = performance.now() - lastInteract > 1400;
    const driftY = idle ? Math.sin(t * 0.08) * 0.18 : 0;

    curRotX += (targetRotX - curRotX) * 0.04;
    curRotY += (targetRotY + driftY - curRotY) * 0.04;

    rig.rotation.x = curRotX;
    rig.rotation.y = t * 0.05 + curRotY;
    inner.rotation.y = -t * 0.09;
    inner.rotation.x = t * 0.04;

    particles.rotation.y = t * 0.015;
    glow.material.opacity = 0.7 + Math.sin(t * 0.9) * 0.15;

    renderer.render(scene, camera);
  }
  animate();

  requestAnimationFrame(() => mount.classList.add('loaded'));

  function onResize() {
    w = mount.clientWidth || mount.parentElement.clientWidth;
    h = mount.clientHeight || mount.parentElement.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize, { passive: true });
})();
