/* =====================================================================
   Ambience: chimney smoke, gulls over the harbour, a boat in the bay,
   flags on the castle. Cheap, animated, and all low-fidelity.
   ===================================================================== */

// soft sprites with per-particle size and alpha, fogged like everything else
function puffMaterial(tex, color) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, color: { value: new THREE.Color(color) }, ph: { value: 400 } }]),
    vertexShader: `attribute float size; attribute float alpha; varying float vA; uniform float ph;
      #include <fog_pars_vertex>
      void main() { vA = alpha; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * ph * projectionMatrix[1][1] * 0.5 / -mvPosition.z; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    // screen-door transparency: the fade is an ordered dither, so smoke stays crisp pixels like everything else
    fragmentShader: `uniform sampler2D map; uniform vec3 color; varying float vA;
      #include <fog_pars_fragment>
      void main() { vec4 t = texture2D(map, gl_PointCoord); if (t.a < 0.5) discard; gl_FragColor = vec4(color * t.rgb, vA);
      #include <fog_fragment>
      }`,
    transparent: true, depthWrite: false, fog: true,
  });
}

// chimney smoke: sources [{x, y, z, dark}]; each chimney breathes a slow column that leans with the wind
function makeSmoke(area, sources, rng) {
  const PER = 12; const n = sources.length * PER; if (!n) return;
  const pos = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('size', new THREE.BufferAttribute(size, 1)); geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const mat = puffMaterial(TEX.smoke, 0xd8d6d0); mat.uniforms.map.value = TEX.smoke;
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; area.scene.add(pts);
  const life = sources.map(() => rng.range(7, 11)); const phase = []; for (let i = 0; i < n; i++) phase.push(rng.next());
  const wind = [0.55, -0.35];
  area.smoke = { mat, sources };
  area.anim.push((dt, t) => {
    const tint = G.tint; mat.uniforms.color.value.setRGB(0.74 * tint.r + 0.08, 0.7 * tint.g + 0.08, 0.66 * tint.b + 0.08); // warm grey
    mat.uniforms.ph.value = renderer ? renderer.getDrawingBufferSize(_smokeV).y : 400;
    for (let s = 0; s < sources.length; s++) {
      const S = sources[s], L = life[s];
      for (let k = 0; k < PER; k++) {
        const i = s * PER + k; const a = ((t / L) + phase[i]) % 1; // 0 → 1 over a puff's life
        const rise = a * (S.dark ? 22 : 17), drift = a * a * 15;
        pos[i * 3] = S.x + wind[0] * drift + Math.sin(t * 0.7 + i) * 0.4 * a; pos[i * 3 + 1] = S.y + rise; pos[i * 3 + 2] = S.z + wind[1] * drift;
        size[i] = (S.dark ? 1.6 : 1.2) + a * (S.dark ? 5 : 3.8);
        alpha[i] = (S.dark ? 0.4 : 0.3) * Math.min(1, a * 5) * (1 - a) * (0.85 + 0.15 * Math.sin(i * 1.7));
      }
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.size.needsUpdate = true; geo.attributes.alpha.needsUpdate = true;
  });
}
const _smokeV = new THREE.Vector2();

// gulls wheeling over a centre point
function makeGulls(area, cx, cz, n, rng, spread = 60, alt = 14) {
  const pos = new Float32Array(n * 3); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mats = [TEX.gull1, TEX.gull2].map(map => new THREE.PointsMaterial({ map, size: 2.6, sizeAttenuation: true, transparent: true, alphaTest: 0.5, depthWrite: true, fog: true }));
  const pts = new THREE.Points(geo, mats[0]); pts.frustumCulled = false; area.scene.add(pts);
  const g = []; for (let i = 0; i < n; i++) g.push({ r: rng.range(12, spread), h: alt + rng.range(0, 20), w: rng.range(0.12, 0.3) * (rng.chance(0.5) ? 1 : -1), a: rng.range(0, 6.3), ox: rng.range(-spread, spread) * 0.5, oz: rng.range(-spread, spread) * 0.3 });
  area.anim.push((dt, t) => {
    for (let i = 0; i < n; i++) { const q = g[i]; const a = q.a + t * q.w; pos[i * 3] = cx + q.ox + Math.cos(a) * q.r; pos[i * 3 + 1] = q.h + Math.sin(t * 0.8 + i) * 1.5; pos[i * 3 + 2] = cz + q.oz + Math.sin(a) * q.r * 0.7; }
    geo.attributes.position.needsUpdate = true; pts.material = mats[Math.floor(t * 4) % 2];
  });
}

// a small cog under sail, beating around the bay on a long loop
function makeBoat(area, mats, path, speed = 3.2) {
  const gb = new GB();
  gb.box(-1.6, -0.4, -5, 1.6, 1.2, 5, { side: 'woodDark', top: 'wood' }, 2, 2);
  gb.box(-1.1, 1.2, 2.5, 1.1, 2.4, 5, { side: 'woodDark', top: 'wood' }, 2, 2);
  gb.box(-0.12, 1.2, -0.6, 0.12, 11, -0.36, 'woodDark', 1, 1);
  gb.quad('sail', [-3.2, 3.2, -0.3], [1, 0, 0], [0, 1, 0], 6.4, 7, 3, 3, { double: true });
  const boat = gb.build(mats); boat.children.forEach(m => { m.matrixAutoUpdate = true; }); area.scene.add(boat);
  const P = resamplePath(smoothPath(path.concat([path[0]]), 3), 4); let L = 0; const acc = [0];
  for (let i = 1; i < P.length; i++) { L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); acc.push(L); }
  area.anim.push((dt, t) => {
    const d = (t * speed) % L; let i = 1; while (i < acc.length - 1 && acc[i] < d) i++;
    const k = (d - acc[i - 1]) / (acc[i] - acc[i - 1] || 1); const [ax, az] = P[i - 1], [bx, bz] = P[i];
    boat.position.set(lerp(ax, bx, k), SEA + Math.sin(t * 1.3) * 0.12, lerp(az, bz, k));
    boat.rotation.set(Math.sin(t * 0.9) * 0.04, Math.atan2(bx - ax, bz - az), Math.sin(t * 1.1) * 0.05);
  });
  return boat;
}

// a flag that ripples: pole in the static geometry, cloth animated here
function makeFlag(area, tex, x, y, z, ang, w = 2.6, h = 1.5) {
  const geo = new THREE.PlaneGeometry(w, h, 8, 1); geo.translate(w / 2, 0, 0);
  const base = geo.attributes.position.array.slice();
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: true }); mat.userData.base = new THREE.Color(1, 1, 1); area.tintMats.push(mat);
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ang; area.scene.add(m);
  const ph = x * 0.37 + z * 0.11;
  area.anim.push((dt, t) => {
    const p = geo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) { const u = base[i] / w; p[i + 2] = Math.sin(t * 4.2 + u * 5 + ph) * 0.22 * u; p[i + 1] = base[i + 1] - u * u * 0.15; }
    geo.attributes.position.needsUpdate = true;
  });
  return m;
}
