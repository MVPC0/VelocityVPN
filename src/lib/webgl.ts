import * as THREE from 'three';

let support: boolean | null = null;

/** Whether this browser can create a WebGL context at all (WebGL disabled, blocklisted GPU, etc.). */
export function webglSupported(): boolean {
  if (support !== null) return support;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    support = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    support = false;
  }
  return support;
}

/**
 * THREE.WebGLRenderer that returns null instead of throwing when WebGL is
 * unavailable, so decorative 3D never takes the rest of the page down.
 */
export function createWebGLRenderer(params: THREE.WebGLRendererParameters): THREE.WebGLRenderer | null {
  if (!webglSupported()) return null;
  try {
    return new THREE.WebGLRenderer(params);
  } catch (e) {
    console.warn('WebGL unavailable, skipping 3D:', e);
    return null;
  }
}
