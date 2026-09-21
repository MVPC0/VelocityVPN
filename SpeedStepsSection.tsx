import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  { num: '01', title: 'Open dashboard', desc: 'This site is a manager, not a tunnel. Nothing is encrypted until you import a config into the WireGuard app.', icon: '🖥️' },
  { num: '02', title: 'Pick a region', desc: 'Eighteen city labels for tests and templates. They are not Velocity-owned VPN servers.', icon: '🌐' },
  { num: '03', title: 'Add a provider', desc: 'Paste endpoint, public key, and private key from Proton, Windscribe, Mullvad, or any WireGuard host.', icon: '🔑' },
  { num: '04', title: 'Download .conf', desc: 'Generate a Curve25519 keypair and an import-ready WireGuard file. Endpoint must be a real provider address.', icon: '📄' },
  { num: '05', title: 'Import WireGuard', desc: 'Open the official WireGuard app on your device. This website cannot hide your IP by itself.', icon: '🛡️' },
  { num: '06', title: 'Check latency', desc: 'Browser timing to a public site in that city. Not ICMP. Not a game-server ping. A rough region hint.', icon: '📶' },
  { num: '07', title: 'Track games', desc: 'Steam player counts when the public API answers. Fortnite is an estimate. Heat-map vibes are a model, not live lobbies.', icon: '🎮' },
  { num: '08', title: 'Play', desc: 'Your ping, DDoS protection, and kill switch come from the provider and the WireGuard app — not from this dashboard.', icon: '🏆' },
];

function createFaceTexture(step: typeof steps[0]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#0A0A0F';
  ctx.fillRect(0, 0, 512, 512);

  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, 496, 496);

  // Step number
  ctx.fillStyle = '#E85D4E';
  ctx.font = '400 48px "JetBrains Mono", monospace';
  ctx.fillText(step.num, 32, 72);

  // Icon
  ctx.font = '128px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(step.icon, 256, 240);
  ctx.textAlign = 'left';

  // Step title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '400 32px Archivo, sans-serif';
  ctx.fillText(step.title, 32, 420);

  // Coral accent line at bottom
  ctx.fillStyle = '#E85D4E';
  ctx.fillRect(32, 448, 80, 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

const SpeedStepsSection: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const cubeGroupRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const textures = useMemo(() => steps.map(createFaceTexture), []);

  const initScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 5;

    const group = new THREE.Group();
    scene.add(group);
    cubeGroupRef.current = group;

    // Create 8 cubes in 2x2x2 grid
    const geometry = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const allMaterials: THREE.MeshStandardMaterial[] = [];

    for (let i = 0; i < 8; i++) {
      const cubeMaterials = [
        new THREE.MeshStandardMaterial({ map: textures[i % 8], roughness: 0.3, metalness: 0.1 }),
        new THREE.MeshStandardMaterial({ map: textures[(i + 1) % 8], roughness: 0.3, metalness: 0.1 }),
        new THREE.MeshStandardMaterial({ map: textures[(i + 2) % 8], roughness: 0.3, metalness: 0.1 }),
        new THREE.MeshStandardMaterial({ map: textures[(i + 3) % 8], roughness: 0.3, metalness: 0.1 }),
        new THREE.MeshStandardMaterial({ map: textures[(i + 4) % 8], roughness: 0.3, metalness: 0.1 }),
        new THREE.MeshStandardMaterial({ map: textures[(i + 5) % 8], roughness: 0.3, metalness: 0.1 }),
      ];
      allMaterials.push(...cubeMaterials);

      const cube = new THREE.Mesh(geometry, cubeMaterials);
      const x = (i % 2) * 2.2 - 1.1;
      const y = (Math.floor(i / 2) % 2) * 2.2 - 1.1;
      const z = Math.floor(i / 4) * 2.2 - 1.1;
      cube.position.set(x, y, z);
      cube.userData = { index: i, baseX: x, baseY: y, baseZ: z };
      group.add(cube);
    }

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(3, 5, 5);
    scene.add(dirLight);
    const pointLight = new THREE.PointLight(0xE85D4E, 0.3, 20);
    pointLight.position.set(-2, -2, 3);
    scene.add(pointLight);

    // Resize handler
    const handleResize = () => {
      const container = canvas.parentElement;
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Render loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      geometry.dispose();
      allMaterials.forEach((m: THREE.MeshStandardMaterial) => {
        m.map?.dispose();
        m.dispose();
      });
      renderer.dispose();
    };
  }, [textures]);

  useEffect(() => {
    const cleanup = initScene();
    return cleanup;
  }, [initScene]);

  useEffect(() => {
    const section = sectionRef.current;
    const group = cubeGroupRef.current;
    if (!section || !group) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        onUpdate: (self) => {
          const stepIndex = Math.min(Math.floor(self.progress * 8), 7);
          setActiveStep(stepIndex);
        },
      },
    });

    tl.to(group.rotation, {
      y: Math.PI * 4,
      x: 0.3,
      ease: 'none',
    });

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <section
      id="speed-steps"
      ref={sectionRef}
      className="relative w-full"
      style={{ height: '800vh' }}
    >
      <div className="sticky top-0 w-full h-[100dvh] flex">
        {/* Three.js Canvas */}
        <div className="w-full md:w-[60%] h-full relative">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
          />
        </div>

        {/* Content Panel */}
        <div
          className="hidden md:flex w-[40%] h-full flex-col justify-center px-12 lg:px-16 relative"
          style={{
            background: 'linear-gradient(to right, transparent, rgba(5, 5, 7, 0.95) 20%)',
          }}
        >
          {/* Progress indicator */}
          <div className="absolute left-6 top-1/2 -translate-y-1/2 w-0.5 h-[200px] bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
            <div
              className="w-full bg-[#E85D4E] transition-all duration-300 ease-out rounded-full"
              style={{ height: `${((activeStep + 1) / 8) * 100}%` }}
            />
          </div>

          {/* Step Content */}
          <div className="relative min-h-[300px]">
            {steps.map((step, i) => (
              <div
                key={step.num}
                className={`absolute inset-0 transition-all duration-300 ${
                  i === activeStep
                    ? 'opacity-100 translate-x-0'
                    : i < activeStep
                    ? 'opacity-0 -translate-x-8'
                    : 'opacity-0 translate-x-8'
                }`}
              >
                <div className="font-['JetBrains_Mono'] text-[#E85D4E] text-5xl">
                  {step.num}
                </div>
                <h3
                  className="font-['Archivo'] text-white mt-4"
                  style={{
                    fontSize: 'clamp(36px, 4vw, 64px)',
                    letterSpacing: '-0.04em',
                    lineHeight: 1.0,
                  }}
                >
                  {step.title}
                </h3>
                <p className="mt-6 text-[#D1D5DB] text-lg leading-relaxed max-w-[420px]">
                  {step.desc}
                </p>
                <div className="mt-8 text-5xl">{step.icon}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Content Overlay */}
        <div className="md:hidden absolute bottom-16 left-0 right-0 px-6">
          <div className="bg-[rgba(5,5,7,0.85)] backdrop-blur-md rounded-2xl border border-[rgba(255,255,255,0.08)] p-6">
            {steps.map((step, i) => (
              <div
                key={step.num}
                className={`transition-all duration-300 ${
                  i === activeStep ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-['JetBrains_Mono'] text-[#E85D4E] text-2xl">{step.num}</span>
                  <span className="text-3xl">{step.icon}</span>
                </div>
                <h3 className="font-['Archivo'] text-white text-2xl tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2 text-[#D1D5DB] text-sm leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile step indicator */}
        <div className="md:hidden absolute bottom-6 left-0 right-0 flex justify-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === activeStep ? 'bg-[#E85D4E] scale-125' : 'bg-[rgba(255,255,255,0.2)]'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default SpeedStepsSection;
