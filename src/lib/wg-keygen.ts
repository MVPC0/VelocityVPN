// ─── WireGuard Key Generator (Real Curve25519) ───────────────
// Uses tweetnacl for proper Ed25519/Curve25519 key operations
// Produces valid WireGuard configs that import directly into the app

import nacl from "tweetnacl";

// WireGuard uses Curve25519 for key exchange
// Private key: 32 random bytes, clamped
// Public key: X25519 scalar multiplication of base point with private key

export interface WireGuardKeyPair {
  privateKey: string; // Base64, 44 chars
  publicKey: string;  // Base64, 44 chars
}

// Generate a fresh client key pair (for the user's device)
export function generateWireGuardKeyPair(): WireGuardKeyPair {
  const keypair = nacl.box.keyPair();
  return {
    privateKey: bufferToBase64(keypair.secretKey),
    publicKey: bufferToBase64(keypair.publicKey),
  };
}

// Generate just a private key
export function generateWireGuardPrivateKey(): string {
  return bufferToBase64(nacl.randomBytes(32));
}

// Derive public key from private key (for server keys)
export function derivePublicKey(privateKeyBase64: string): string {
  try {
    const privateKey = base64ToBuffer(privateKeyBase64);
    const keypair = nacl.box.keyPair.fromSecretKey(privateKey);
    return bufferToBase64(keypair.publicKey);
  } catch {
    throw new Error("Invalid WireGuard private key");
  }
}

// WireGuard keys are 32 bytes, base64-encoded (44 chars ending in "=")
export const WG_KEY_PATTERN = /^[A-Za-z0-9+/]{43}=$/;

export function isValidWireGuardKey(key: string): boolean {
  return WG_KEY_PATTERN.test(key.trim());
}

// Server public keys must come from the real WireGuard server (`wg show <if> public-key`).
// They are never derived client-side.

// ─── Helpers ──────────────────────────────────────────────────

function bufferToBase64(buf: Uint8Array): string {
  const bin = Array.from(buf, (b) => String.fromCharCode(b)).join("");
  return btoa(bin);
}

function base64ToBuffer(b64: string): Uint8Array {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    buf[i] = bin.charCodeAt(i);
  }
  return buf;
}
