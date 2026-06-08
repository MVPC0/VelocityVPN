import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import CountUp from 'react-countup';

// Icosahedron subdivision for globe dots
function createIcosahedronPoints(subdivisions: number): {
  positions: Float32Array;
  uvs: Float32Array;
  colors: Float32Array;
  ids: Float32Array;
  sizes: Float32Array;
  rnd: Float32Array;
} {
  const geo = new THREE.IcosahedronGeometry(1, subdivisions);
  const posAttr = geo.attributes.position;
  const count = posAttr.count;

  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const colors = new Float32Array(count * 3);
  const ids = new Float32Array(count);
  const sizes = new Float32Array(count);
  const rnd = new Float32Array(count * 3);

  const iceBlue = new THREE.Color('#A3B8D4');
  const purple = new THREE.Color('#9B6DFF');
  const colorTemp = new THREE.Color();

  // Major city UV regions (approximate) for purple coloring
  const cityRegions = [
    { u: 0.28, v: 0.55, r: 0.08 }, // NY
    { u: 0.52, v: 0.35, r: 0.06 }, // London
    { u: 0.55, v: 0.38, r: 0.06 }, // Frankfurt
    { u: 0.85, v: 0.55, r: 0.08 }, // Tokyo
    { u: 0.78, v: 0.62, r: 0.07 }, // Singapore
    { u: 0.88, v: 0.78, r: 0.07 }, // Sydney
    { u: 0.35, v: 0.78, r: 0.08 }, // Sao Paulo
    { u: 0.62, v: 0.58, r: 0.06 }, // Dubai
  ];

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    // Normalize
    const len = Math.sqrt(x * x + y * y + z * z);
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;

    positions[i * 3] = nx;
    positions[i * 3 + 1] = ny;
    positions[i * 3 + 2] = nz;

    // UV from spherical coordinates
    const u = 0.5 + Math.atan2(nz, nx) / (2 * Math.PI);
    const v = 0.5 - Math.asin(ny) / Math.PI;
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;

    // Color based on proximity to city regions
    let nearCity = false;
    for (const city of cityRegions) {
      const du = u - city.u;
      const dv = v - city.v;
      if (du * du + dv * dv < city.r * city.r) {
        nearCity = true;
        break;
      }
    }

    if (nearCity) {
      colors[i * 3] = purple.r;
      colors[i * 3 + 1] = purple.g;
      colors[i * 3 + 2] = purple.b;
    } else {
      colorTemp.copy(iceBlue);
      colorTemp.multiplyScalar(0.6 + Math.random() * 0.4);
      colors[i * 3] = colorTemp.r;
      colors[i * 3 + 1] = colorTemp.g;
      colors[i * 3 + 2] = colorTemp.b;
    }

    ids[i] = i / count;
    sizes[i] = 0.5 + Math.random() * 0.8;
    rnd[i * 3] = Math.random();
    rnd[i * 3 + 1] = Math.random();
    rnd[i * 3 + 2] = Math.random();
  }

  geo.dispose();
  return { positions, uvs, colors, ids, sizes, rnd };
}

const vertexShader = `
  attribute vec3 a_pos;
  attribute vec2 a_uv;
  attribute vec3 a_color;
  attribute float a_id;
  attribute float a_size;
  attribute vec3 a_rnd;

  uniform float u_time;
  uniform mat4 u_mvp;
  uniform float u_dotSize;
  uniform vec2 u_hover;
  uniform vec4 u_ping;
  uniform float u_rotY;

  varying vec3 v_color;
  varying float v_depth;
  varying vec2 v_uv;

  void main() {
    float cosY = cos(u_rotY);
    float sinY = sin(u_rotY);
    mat3 rY = mat3(cosY, 0.0, sinY, 0.0, 1.0, 0.0, -sinY, 0.0, cosY);
    vec3 pos = rY * a_pos;

    float depth = -(u_mvp * vec4(pos, 1.0)).z;
    float d = smoothstep(0.25, 0.8, depth / 12.0);

    float pulse = 0.9 + 0.1 * sin(u_time * 2.0 + a_rnd.x * 6.28);
    float size = pulse * a_size * u_dotSize * (0.8 + d * 0.5);

    vec3 color = a_color;
    if (u_hover.x >= 0.0) {
      float hoverDist = length(a_uv - u_hover);
      float hoverMask = 1.0 - smoothstep(0.05, 0.15, hoverDist);
      color = mix(color, vec3(1.0), hoverMask * 0.8);
    }

    if (u_ping.z > 0.0) {
      float pingDist = length(a_uv - u_ping.xy);
      float pingRing = 1.0 - smoothstep(u_ping.w * 0.8, u_ping.w, pingDist);
      color += vec3(0.2, 1.0, 0.5) * pingRing * u_ping.z;
    }

    vec4 ndc = u_mvp * vec4(pos, 1.0);
    vec2 screenPos = ndc.xy / ndc.w;

    gl_Position = vec4(screenPos, 0.0, 1.0);
    gl_PointSize = size;
    v_color = color;
    v_depth = d;
    v_uv = a_uv;
  }
`;

const fragmentShader = `
  precision mediump float;
  varying vec3 v_color;
  varying float v_depth;
  varying vec2 v_uv;

  uniform float u_time;
  uniform vec2 u_hover;
  uniform vec4 u_ping;

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float dist = length(p);
    float alpha = 1.0 - smoothstep(0.4, 0.5, dist);

    vec3 baseColor = v_color;
    if (u_hover.x >= 0.0) {
      float hoverDist = length(v_uv - u_hover);
      float hoverMask = 1.0 - smoothstep(0.05, 0.15, hoverDist);
      baseColor = mix(baseColor, vec3(1.0), hoverMask);
    }

    float depthFade = 0.3 + v_depth * 0.7;
    float atmosphereGlow = 1.0 - smoothstep(0.3, 0.8, dist);

    if (u_ping.z > 0.0) {
      float pingDist = length(v_uv - u_ping.xy);
      float pingRing = 1.0 - smoothstep(u_ping.w * 0.8, u_ping.w, pingDist);
      baseColor += vec3(0.2, 1.0, 0.5) * pingRing * u_ping.z * 0.8;
    }

    alpha *= depthFade;

    vec4 glow = vec4(baseColor * atmosphereGlow * 0.4, atmosphereGlow * alpha * 0.3);
    vec4 dotCol = vec4(baseColor, alpha);

    gl_FragColor = mix(dotCol, glow, atmosphereGlow);
  }
`;

interface Ping {
  uv: [number, number];
  t: number;
  duration: number;
  intensity: number;
  color: [number, number, number];
}

const HeroSection: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef(Date.now());
  const activePingsRef = useRef<Array<Ping & { radius: number }>>([]);
  const pingQueueRef = useRef<Ping[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const scrollRef = useRef(0);
  const [loaded, setLoaded] = useState(false);

  // Generate ping queue
  useEffect(() => {
    const pings: Ping[] = [];
    const cities = [
      [0.28, 0.55], [0.52, 0.35], [0.55, 0.38], [0.85, 0.55],
      [0.78, 0.62], [0.88, 0.78], [0.35, 0.78], [0.62, 0.58],
    ];
    for (let i = 0; i < 50; i++) {
      const city = cities[Math.floor(Math.random() * cities.length)];
      pings.push({
        uv: [city[0] + (Math.random() - 0.5) * 0.05, city[1] + (Math.random() - 0.5) * 0.05],
        t: 0,
        duration: 3000,
        intensity: 0.5 + Math.random() * 0.5,
        color: [0.2, 1.0, 0.5],
      });
    }
    pingQueueRef.current = pings;
  }, []);

  const initGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 2.8;
    cameraRef.current = camera;

    // Create globe points
    const { positions, uvs, colors, ids, sizes, rnd } = createIcosahedronPoints(4);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('a_uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('a_color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('a_id', new THREE.BufferAttribute(ids, 1));
    geometry.setAttribute('a_size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('a_rnd', new THREE.BufferAttribute(rnd, 3));

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_mvp: { value: new THREE.Matrix4() },
        u_dotSize: { value: 3.0 },
        u_hover: { value: new THREE.Vector2(-1, -1) },
        u_ping: { value: new THREE.Vector4(-1, -1, 0, 0) },
        u_rotY: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    materialRef.current = material;

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    startTimeRef.current = Date.now();

    // Handle resize
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Handle scroll
    const handleScroll = () => {
      scrollRef.current = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Handle mouse
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Fade in
    setTimeout(() => setLoaded(true), 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  useEffect(() => {
    const cleanup = initGL();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const material = materialRef.current;
      if (!renderer || !scene || !camera || !material) return;

      const time = (Date.now() - startTimeRef.current) / 1000;
      material.uniforms.u_time.value = time;

      // Auto rotation + scroll rotation
      const scrollY = scrollRef.current;
      const vh = window.innerHeight;
      const scrollRot = scrollY * 0.0005;
      const autoRot = time * 0.08;
      const totalRot = autoRot + scrollRot;
      material.uniforms.u_rotY.value = totalRot;

      // Mouse parallax with lerp
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      camera.position.x = mouseRef.current.x * 0.15;
      camera.position.y = mouseRef.current.y * 0.1;
      camera.lookAt(0, 0, 0);

      // Update MVP
      const mvp = new THREE.Matrix4();
      mvp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      material.uniforms.u_mvp.value.copy(mvp);

      // Ping system
      if (time % 1.5 < 0.05 && pingQueueRef.current.length > 0) {
        const ping = pingQueueRef.current.shift()!;
        activePingsRef.current.push({ ...ping, t: time, radius: 0 });
        // Recycle pings
        pingQueueRef.current.push(ping);
      }

      // Update active pings
      const activePings = activePingsRef.current;
      for (let i = activePings.length - 1; i >= 0; i--) {
        const p = activePings[i];
        const elapsed = time - p.t;
        const progress = elapsed / p.duration;
        const radius = progress * 0.8;
        const intensity =
          p.intensity *
          (1.0 - THREE.MathUtils.smoothstep(0.0, 0.3, progress)) *
          THREE.MathUtils.smoothstep(1.0, 0.7, progress);

        material.uniforms.u_ping.value.set(p.uv[0], p.uv[1], intensity, radius);

        if (progress >= 1.0) {
          activePings.splice(i, 1);
        }
      }

      if (activePings.length === 0) {
        material.uniforms.u_ping.value.set(-1, -1, 0, 0);
      }

      // Globe scale/opacity based on scroll
      const scrollProgress = Math.min(scrollY / vh, 1);
      const scale = 1 - scrollProgress * 0.2;
      const opacity = 1 - scrollProgress * 0.5;

      renderer.domElement.style.opacity = String(Math.max(opacity, 0.3));
      renderer.domElement.style.transform = `scale(${Math.max(scale, 0.8)})`;

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
      { value: 34, suffix: '', label: 'Global Locations', color: 'text-[#9B6DFF]' },
      { value: 0, suffix: '', label: 'Live Ping Test', color: 'text-[#4ADE80]', isText: true, textValue: 'Real-Time' },
      { value: 0, suffix: '', label: 'Protocol', color: 'text-[#E85D4E]', isText: true, textValue: 'WireGuard' },
      { value: 0, suffix: '', label: 'Security', color: 'text-[#A3B8D4]', isText: true, textValue: 'DDoS Protected' },
    ],
    []
  );

  return (
    <section id="hero" className="relative w-full min-h-[100dvh] overflow-hidden">
      {/* WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className={`fixed top-0 left-0 w-full h-full transition-opacity duration-1000 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ zIndex: 1 }}
      />

      {/* Content Overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[100dvh] px-6">
        <span className="text-eyebrow mb-6">GAMING VPN</span>

        <h1
          className="font-['Archivo'] text-white text-center font-normal"
          style={{
            fontSize: 'clamp(48px, 10vw, 120px)',
            letterSpacing: '-0.06em',
            lineHeight: 0.9,
            textShadow: '0 0 60px rgba(163, 184, 212, 0.15)',
          }}
        >
          Say Goodbye to Lag
        </h1>

        <p
          className="mt-6 text-[#D1D5DB] text-center max-w-[560px]"
          style={{ fontSize: 'clamp(16px, 1.8vw, 20px)', lineHeight: 1.6 }}
        >
          Route-optimized servers in 34 global locations. DDoS protection.
          Live ping testing to find your fastest server.
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

        {/* Stats Row */}
        <div className="absolute bottom-16 left-0 right-0 flex justify-around items-center px-6 max-w-[900px] mx-auto">
          {stats.map((stat, i) => (
            <React.Fragment key={stat.label}>
              {i > 0 && (
                <div className="hidden sm:block w-px h-10 bg-[rgba(255,255,255,0.08)]" />
              )}
              <div className="text-center">
                <div className={`font-['JetBrains_Mono'] text-2xl md:text-3xl ${stat.color}`}>
                  {(stat as any).isText
                    ? (stat as any).textValue
                    : <CountUp end={stat.value} duration={2} decimals={(stat as any).decimals || 0} suffix={stat.suffix} />}
                </div>
                <div className="text-eyebrow mt-1 text-[10px] md:text-xs text-[#6B7280]">
                  {stat.label}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
