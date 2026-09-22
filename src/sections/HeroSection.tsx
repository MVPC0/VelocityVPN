import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import CountUp from 'react-countup';

// Brand
const CORAL = new THREE.Color('#E85D4E');
const PURPLE = new THREE.Color('#9B6DFF');
const ICE = new THREE.Color('#A3B8D4');

function createGlobePoints(subdivisions: number) {
  const geo = new THREE.IcosahedronGeometry(1, subdivisions);
  const posAttr = geo.attributes.position;
  const count = posAttr.count;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const rnd = new Float32Array(count * 3);
  const cityMask = new Float32Array(count);

  const cityDirs: THREE.Vector3[] = [
    { lat: 40.7, lon: -74.0 },   // New York
    { lat: 34.0, lon: -118.2 },  // Los Angeles
    { lat: 51.5, lon: -0.1 },    // London
    { lat: 50.1, lon: 8.7 },     // Frankfurt
    { lat: 52.4, lon: 4.9 },     // Amsterdam
    { lat: 35.7, lon: 139.7 },   // Tokyo
    { lat: 1.3, lon: 103.8 },    // Singapore
    { lat: -33.9, lon: 151.2 },  // Sydney
    { lat: -23.5, lon: -46.6 },  // Sao Paulo
    { lat: 25.2, lon: 55.3 },    // Dubai
  ].map(({ lat, lon }) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
    );
  });

  const tmp = new THREE.Vector3();
  const colorTemp = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;

    positions[i * 3] = nx;
    positions[i * 3 + 1] = ny;
    positions[i * 3 + 2] = nz;

    tmp.set(nx, ny, nz);
    let nearest = 1;
    for (const dir of cityDirs) {
      const d = tmp.distanceTo(dir);
      if (d < nearest) nearest = d;
    }
    const isHub = nearest < 0.12;
    cityMask[i] = isHub ? 1 : 0;

    if (isHub) {
      colorTemp.copy(CORAL).lerp(PURPLE, Math.random() * 0.45);
      colors[i * 3] = colorTemp.r;
      colors[i * 3 + 1] = colorTemp.g;
      colors[i * 3 + 2] = colorTemp.b;
      sizes[i] = 1.35 + Math.random() * 0.55;
    } else {
      const band = Math.abs(ny);
      colorTemp.copy(ICE).lerp(PURPLE, band * 0.25);
      colorTemp.multiplyScalar(0.55 + Math.random() * 0.4);
      colors[i * 3] = colorTemp.r;
      colors[i * 3 + 1] = colorTemp.g;
      colors[i * 3 + 2] = colorTemp.b;
      sizes[i] = 0.45 + Math.random() * 0.7;
    }

    rnd[i * 3] = Math.random();
    rnd[i * 3 + 1] = Math.random();
    rnd[i * 3 + 2] = Math.random();
  }

  geo.dispose();
  return { positions, colors, sizes, rnd, cityMask, cityDirs };
}

const vertexShader = /* glsl */ `
  precision highp float;

  attribute vec3 color;
  attribute float a_size;
  attribute vec3 a_rnd;
  attribute float a_hub;

  uniform float u_time;
  uniform float u_dotSize;
  uniform vec3 u_hoverDir;
  uniform vec4 u_ping;
  uniform float u_rotY;

  varying vec3 v_color;
  varying float v_depth;
  varying float v_hub;
  varying vec3 v_dir;

  void main() {
    float cosY = cos(u_rotY);
    float sinY = sin(u_rotY);
    mat3 rY = mat3(
      cosY, 0.0, sinY,
      0.0,  1.0, 0.0,
     -sinY, 0.0, cosY
    );
    vec3 pos = rY * position;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float depth = clamp((-mv.z - 1.4) / 2.2, 0.0, 1.0);

    float pulse = 0.88 + 0.12 * sin(u_time * 1.8 + a_rnd.x * 6.28318);
    float hubPulse = a_hub * (0.15 * sin(u_time * 3.2 + a_rnd.y * 6.28318));
    float size = (pulse + hubPulse) * a_size * u_dotSize * (0.55 + depth * 0.7);

    vec3 col = color;
    float hover = 0.0;
    if (length(u_hoverDir) > 0.01) {
      hover = pow(max(dot(normalize(pos), normalize(u_hoverDir)), 0.0), 18.0);
      col = mix(col, vec3(1.0, 0.92, 0.88), hover * 0.85);
      size *= 1.0 + hover * 1.4;
    }

    if (u_ping.w > 0.0) {
      vec3 pingDir = vec3(u_ping.x, u_ping.y, u_ping.z);
      float ang = acos(clamp(dot(normalize(pos), normalize(pingDir)), -1.0, 1.0));
      float ring = 1.0 - smoothstep(u_ping.w * 0.55, u_ping.w, ang);
      col += vec3(0.91, 0.36, 0.31) * ring * 0.85;
      size += ring * 2.0;
    }

    gl_Position = projectionMatrix * mv;
    gl_PointSize = size;
    v_color = col;
    v_depth = depth;
    v_hub = a_hub;
    v_dir = pos;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float u_time;
  uniform vec3 u_hoverDir;
  uniform vec4 u_ping;

  varying vec3 v_color;
  varying float v_depth;
  varying float v_hub;
  varying vec3 v_dir;

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float dist = length(p);
    if (dist > 0.5) discard;

    float core = 1.0 - smoothstep(0.0, 0.22 + v_hub * 0.08, dist);
    float halo = 1.0 - smoothstep(0.18, 0.5, dist);
    float alpha = (core * 0.95 + halo * 0.28) * (0.22 + v_depth * 0.78);

    vec3 col = v_color;
    col += vec3(0.91, 0.36, 0.31) * v_hub * (0.25 + 0.2 * sin(u_time * 3.0));

    if (length(u_hoverDir) > 0.01) {
      float hover = pow(max(dot(normalize(v_dir), normalize(u_hoverDir)), 0.0), 18.0);
      col = mix(col, vec3(1.0), hover * 0.35);
      alpha += hover * 0.2;
    }

    if (u_ping.w > 0.0) {
      vec3 pingDir = vec3(u_ping.x, u_ping.y, u_ping.z);
      float ang = acos(clamp(dot(normalize(v_dir), normalize(pingDir)), -1.0, 1.0));
      float ring = 1.0 - smoothstep(u_ping.w * 0.55, u_ping.w, ang);
      col += vec3(0.91, 0.36, 0.31) * ring * 0.6;
    }

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

const HeroSection: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const globeRef = useRef<THREE.Points | null>(null);
  const cityDirsRef = useRef<THREE.Vector3[]>([]);
  const animFrameRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const pingRef = useRef({ t: 0, dir: new THREE.Vector3(1, 0, 0), i: 0 });
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const scrollRef = useRef(0);
  const [loaded, setLoaded] = useState(false);

  const initGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 2.65);
    cameraRef.current = camera;

    const { positions, colors, sizes, rnd, cityMask, cityDirs } = createGlobePoints(5);
    cityDirsRef.current = cityDirs;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('a_size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('a_rnd', new THREE.BufferAttribute(rnd, 3));
    geometry.setAttribute('a_hub', new THREE.BufferAttribute(cityMask, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_dotSize: { value: 5.2 },
        u_hoverDir: { value: new THREE.Vector3(0, 0, 0) },
        u_ping: { value: new THREE.Vector4(0, 0, 0, 0) },
        u_rotY: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    materialRef.current = material;

    const points = new THREE.Points(geometry, material);
    globeRef.current = points;
    scene.add(points);

    // Soft atmosphere shell - same rotation, matches site coral rim
    const atmosGeo = new THREE.SphereGeometry(1.04, 48, 48);
    const atmosMat = new THREE.MeshBasicMaterial({
      color: 0xE85D4E,
      transparent: true,
      opacity: 0.045,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const atmos = new THREE.Mesh(atmosGeo, atmosMat);
    atmos.name = 'atmos';
    scene.add(atmos);

    const rimGeo = new THREE.SphereGeometry(1.015, 48, 48);
    const rimMat = new THREE.MeshBasicMaterial({
      color: 0x9B6DFF,
      transparent: true,
      opacity: 0.035,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(rimGeo, rimMat));

    startTimeRef.current = Date.now();

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const handleScroll = () => {
      scrollRef.current = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    setTimeout(() => setLoaded(true), 80);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      geometry.dispose();
      material.dispose();
      atmosGeo.dispose();
      atmosMat.dispose();
      rimGeo.dispose();
      rimMat.dispose();
    };
  }, []);

  useEffect(() => {
    const cleanup = initGL();
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const material = materialRef.current;
      if (!renderer || !scene || !camera || !material) return;

      const time = (Date.now() - startTimeRef.current) / 1000;
      material.uniforms.u_time.value = time;

      const scrollY = scrollRef.current;
      const vh = window.innerHeight || 1;
      const autoRot = time * 0.12;
      const scrollRot = scrollY * 0.00045;
      material.uniforms.u_rotY.value = autoRot + scrollRot;

      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.06;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.06;

      camera.position.x = mouseRef.current.x * 0.18;
      camera.position.y = mouseRef.current.y * 0.1;
      camera.position.z = 2.65;
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();

      // Hover highlight on the facing sphere
      ndc.set(mouseRef.current.x, mouseRef.current.y);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.ray.intersectSphere(
        new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1),
        new THREE.Vector3(),
      );
      if (hit) {
        material.uniforms.u_hoverDir.value.copy(hit);
      } else {
        material.uniforms.u_hoverDir.value.set(0, 0, 0);
      }

      // City ping ring, recycled around real hub directions
      const hubs = cityDirsRef.current;
      if (hubs.length) {
        const cycle = 2.4;
        if (time - pingRef.current.t > cycle) {
          pingRef.current.t = time;
          pingRef.current.i = (pingRef.current.i + 1) % hubs.length;
          const rotY = material.uniforms.u_rotY.value as number;
          const src = hubs[pingRef.current.i];
          const cosY = Math.cos(rotY);
          const sinY = Math.sin(rotY);
          pingRef.current.dir.set(
            src.x * cosY + src.z * sinY,
            src.y,
            -src.x * sinY + src.z * cosY,
          );
        }
        const elapsed = time - pingRef.current.t;
        const progress = Math.min(elapsed / 2.1, 1);
        const intensity = Math.sin(progress * Math.PI);
        const radius = 0.08 + progress * 0.42;
        const d = pingRef.current.dir;
        material.uniforms.u_ping.value.set(d.x, d.y, d.z, intensity > 0.02 ? radius : 0);
      }

      const scrollProgress = Math.min(scrollY / vh, 1);
      const scale = 1 - scrollProgress * 0.18;
      const opacity = 1 - scrollProgress * 0.45;
      renderer.domElement.style.opacity = String(Math.max(opacity, 0.28));
      renderer.domElement.style.transform = `scale(${Math.max(scale, 0.82)})`;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      cleanup?.();
      rendererRef.current?.dispose();
      materialRef.current?.dispose();
    };
  }, [initGL]);

  const stats = useMemo(
    () => [
      { value: 18, suffix: '', label: 'City labels', color: 'text-[#9B6DFF]' },
      { value: 0, suffix: '', label: 'Region check', color: 'text-[#4ADE80]', isText: true, textValue: 'Browser timing' },
      { value: 0, suffix: '', label: 'Protocol', color: 'text-[#E85D4E]', isText: true, textValue: 'WireGuard' },
      { value: 0, suffix: '', label: 'Tunnel lives there', color: 'text-[#A3B8D4]', isText: true, textValue: 'Your provider' },
    ],
    [],
  );

  return (
    <section id="hero" className="relative w-full min-h-[100dvh] overflow-hidden">
      <canvas
        ref={canvasRef}
        className={`fixed top-0 left-0 w-full h-full transition-opacity duration-1000 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ zIndex: 1 }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-[100dvh] px-6">
        <span className="text-eyebrow mb-6">DASHBOARD - NOT A CARRIER</span>

        <h1
          className="font-['Archivo'] text-white text-center font-normal"
          style={{
            fontSize: 'clamp(48px, 10vw, 120px)',
            letterSpacing: '-0.06em',
            lineHeight: 0.9,
            textShadow: '0 0 60px rgba(163, 184, 212, 0.15)',
          }}
        >
          Bring Your Own WireGuard
        </h1>

        <p
          className="mt-6 text-[#D1D5DB] text-center max-w-[560px]"
          style={{ fontSize: 'clamp(16px, 1.8vw, 20px)', lineHeight: 1.6 }}
        >
          A free WireGuard dashboard - not a VPN network. Eighteen city labels, config templates,
          and region timing checks. You bring the provider.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-10">
          <a
            href="#/login"
            className="inline-flex items-center justify-center font-medium transition-all duration-300
              px-12 py-5 text-sm uppercase tracking-[0.04em]
              bg-[#E85D4E] text-white rounded-lg hover:bg-[#D44A3C] hover:scale-[1.02] active:scale-[0.98]
              no-underline cursor-pointer"
          >
            Start Gaming Faster
          </a>
          <button
            onClick={() => {
              const el = document.getElementById('speed-steps');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="inline-flex items-center justify-center font-medium transition-all duration-300
              px-12 py-5 text-sm uppercase tracking-[0.04em]
              bg-transparent border border-[rgba(255,255,255,0.2)] text-white rounded-lg
              hover:border-[#E85D4E] hover:text-[#E85D4E]"
          >
            See How It Works
          </button>
        </div>

        <div className="absolute bottom-8 sm:bottom-16 left-0 right-0 px-4 sm:px-6 max-w-[900px] mx-auto">
          <div className="grid grid-cols-4 gap-2 sm:flex sm:justify-around sm:items-center">
            {stats.map((stat, i) => (
              <React.Fragment key={stat.label}>
                {i > 0 && (
                  <div className="hidden sm:block w-px h-8 bg-[rgba(255,255,255,0.08)]" />
                )}
                <div className="text-center">
                  <div className={`font-['JetBrains_Mono'] text-sm sm:text-lg md:text-xl lg:text-2xl ${stat.color} leading-tight`}>
                    {(stat as { isText?: boolean; textValue?: string }).isText
                      ? (stat as { textValue?: string }).textValue
                      : <CountUp end={stat.value} duration={2} suffix={stat.suffix} />}
                  </div>
                  <div className="text-[9px] sm:text-[10px] md:text-xs text-[#6B7280] mt-0.5 leading-tight uppercase tracking-wider">
                    {stat.label}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
