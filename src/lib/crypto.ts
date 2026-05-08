/**
 * AES-256-GCM Encryption using the browser's built-in Web Crypto API.
 *
 * The private key is NEVER stored in plaintext.
 * Encryption key is derived from a user password via PBKDF2 (100,000 iterations).
 *
 * Storage format in localStorage:
 * {
 *   encrypted: true,
 *   ciphertext: "<base64>",
 *   iv: "<base64>",
 *   salt: "<base64>",
 *   accountId: "<plaintext — not sensitive>",
 *   network: "<plaintext — not sensitive>"
 * }
 *
 * The accountId and network are NOT sensitive — only the private key is encrypted.
 */

export interface EncryptedStore {
  encrypted: true;
  ciphertext: string; // base64
  iv: string;         // base64 — random 12 bytes per encryption
  salt: string;       // base64 — random 16 bytes per encryption
  accountId: string;  // stored plaintext (not sensitive)
  network: string;    // stored plaintext (not sensitive)
}

export interface PlaintextStore {
  encrypted: false;
  privateKey: string;
  accountId: string;
  network: string;
}

export type StoredCredentials = EncryptedStore | PlaintextStore;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bufferToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ─── Key Derivation ───────────────────────────────────────────────────────────

async function deriveKey(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ─── Encrypt ──────────────────────────────────────────────────────────────────

/**
 * Encrypts a private key string with a password.
 * Returns an EncryptedStore ready to save to localStorage.
 */
export async function encryptPrivateKey(
  privateKey: string,
  password: string,
  accountId: string,
  network: string
): Promise<EncryptedStore> {
  const salt = crypto.getRandomValues(new Uint8Array(16)).buffer;
  const iv   = crypto.getRandomValues(new Uint8Array(12)).buffer;

  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(privateKey)
  );

  return {
    encrypted: true,
    ciphertext: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt),
    accountId,
    network,
  };
}

// ─── Decrypt ──────────────────────────────────────────────────────────────────

/**
 * Decrypts a stored EncryptedStore with the user's password.
 * Returns the plaintext private key, or throws if the password is wrong.
 */
export async function decryptPrivateKey(
  stored: EncryptedStore,
  password: string
): Promise<string> {
  const salt       = base64ToBuffer(stored.salt);
  const iv         = base64ToBuffer(stored.iv);
  const ciphertext = base64ToBuffer(stored.ciphertext);

  const key = await deriveKey(password, salt);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    // AES-GCM throws DOMException on wrong key / tampered data
    throw new Error("Incorrect password — could not decrypt private key");
  }
}

// ─── Strength checker ─────────────────────────────────────────────────────────

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4; // 0=very weak, 4=strong
  label: string;
  color: string; // tailwind text color
  barColor: string; // tailwind bg color
  suggestions: string[];
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const suggestions: string[] = [];
  let score = 0;

  if (password.length >= 8)  score++;
  else suggestions.push("Use at least 8 characters");

  if (password.length >= 14) score++;
  else if (password.length >= 8) suggestions.push("Longer passwords are stronger");

  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  else suggestions.push("Mix upper and lowercase letters");

  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  else suggestions.push("Add numbers and symbols (e.g. ! @ # $)");

  const labels  = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
  const colors  = ["text-red-400", "text-orange-400", "text-amber-400", "text-emerald-400", "text-emerald-300"];
  const barColors = ["bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-400"];

  return {
    score: score as PasswordStrength["score"],
    label: labels[score],
    color: colors[score],
    barColor: barColors[score],
    suggestions,
  };
}
