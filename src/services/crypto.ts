/**
 * Cryptographic & Security Service (AES-256-GCM + PBKDF2)
 * Meets requirement #12 for high security personal document vaults
 */

const PBKDF2_ITERATIONS = 100000;

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function hashPassword(password: string, providedSalt?: string): Promise<{ hash: string; salt: string }> {
  const enc = new TextEncoder();
  const saltBytes = providedSalt
    ? new Uint8Array(base64ToBuffer(providedSalt))
    : window.crypto.getRandomValues(new Uint8Array(16));

  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKeyBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    256
  );

  const hash = bufferToBase64(derivedKeyBits);
  const salt = bufferToBase64(saltBytes.buffer);

  return { hash, salt };
}

export async function verifyPassword(password: string, expectedHash: string, salt: string): Promise<boolean> {
  try {
    const { hash } = await hashPassword(password, salt);
    return hash === expectedHash;
  } catch {
    return false;
  }
}

/**
 * AES-256-GCM encryption with derived key
 */
export async function encryptData(plainText: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const encryptedContent = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    aesKey,
    enc.encode(plainText)
  );

  const payload = {
    v: 1,
    algo: 'AES-256-GCM',
    salt: bufferToBase64(salt.buffer),
    iv: bufferToBase64(iv.buffer),
    data: bufferToBase64(encryptedContent),
  };

  return JSON.stringify(payload);
}

/**
 * AES-256-GCM decryption
 */
export async function decryptData(cipherJson: string, password: string): Promise<string> {
  const payload = JSON.parse(cipherJson);
  const salt = new Uint8Array(base64ToBuffer(payload.salt));
  const iv = new Uint8Array(base64ToBuffer(payload.iv));
  const encryptedBytes = base64ToBuffer(payload.data);

  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decryptedBytes = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    aesKey,
    encryptedBytes
  );

  return new TextDecoder().decode(decryptedBytes);
}

/**
 * Device identity helpers for audit trail and sync
 */
export function getDeviceId(): string {
  let id = localStorage.getItem('mostamsakati_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    localStorage.setItem('mostamsakati_device_id', id);
  }
  return id;
}

export function getDeviceName(): string {
  let name = localStorage.getItem('mostamsakati_device_name');
  if (!name) {
    name = 'حاسوب مستمسكاتي الرئيسي (Windows)';
    localStorage.setItem('mostamsakati_device_name', name);
  }
  return name;
}
