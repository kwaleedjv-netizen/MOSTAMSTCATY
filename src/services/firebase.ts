import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { getDeviceId, getDeviceName } from './crypto';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  const serialized = JSON.stringify(errInfo);
  console.error('Firestore Error:', serialized);
  throw new Error(serialized);
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

// === Types ===

export interface NetworkIpInfo {
  ip: string;
  ipHash: string;
  detectedAt: string;
  isOffline?: boolean;
}

export type IpGateReason = 'signin' | 'new_ip' | 'ip_changed' | 'new_device' | 'revoked' | null;

export interface UserProfileRecord {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  requireEmailOnNewIp: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TrustedIpRecord {
  ownerUid: string;
  ipHash: string;
  ipLabel: string;
  deviceId: string;
  deviceName: string;
  userAgent: string;
  verifiedEmail: string;
  trusted: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserDeviceRecord {
  ownerUid: string;
  id: string;
  name: string;
  platform: string;
  lastIpLabel: string;
  lastIpHash: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LocalVerifiedIpCache {
  ipHash: string;
  ip: string;
  email: string;
  verifiedAt: string;
}

export function sanitizeFirestoreId(raw: string, fallbackPrefix = 'id'): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  if (cleaned.length > 0) return cleaned;
  return `${fallbackPrefix}_${Date.now()}`;
}

export function detectDevicePlatform(): string {
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'Android / هاتف أو لوحي';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS / Apple';
  if (/Windows/i.test(ua)) return 'Windows / سطح المكتب';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS / سطح المكتب';
  if (/Linux/i.test(ua)) return 'Linux / ويب';
  return 'متصفح ويب';
}

export function getLocalVerifiedIpKey(uid: string): string {
  return `mostamsakati_verified_ip_${sanitizeFirestoreId(uid)}`;
}

export function getLocalVerifiedIpCache(uid: string): LocalVerifiedIpCache | null {
  try {
    const raw = localStorage.getItem(getLocalVerifiedIpKey(uid));
    if (!raw) return null;
    return JSON.parse(raw) as LocalVerifiedIpCache;
  } catch {
    return null;
  }
}

export function setLocalVerifiedIpCache(uid: string, info: NetworkIpInfo, email: string): void {
  const payload: LocalVerifiedIpCache = {
    ipHash: sanitizeFirestoreId(info.ipHash),
    ip: info.ip,
    email,
    verifiedAt: new Date().toISOString(),
  };
  localStorage.setItem(getLocalVerifiedIpKey(uid), JSON.stringify(payload));
}

export function clearLocalVerifiedIpCache(uid: string): void {
  localStorage.removeItem(getLocalVerifiedIpKey(uid));
}

async function computeClientIpHash(ip: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(`mostamsakati_ip_v1:${ip}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return ip;
}

export async function detectCurrentNetworkIp(): Promise<NetworkIpInfo> {
  if (!navigator.onLine) {
    return {
      ip: 'غير متصل',
      ipHash: 'offline_mode',
      detectedAt: new Date().toISOString(),
      isOffline: true,
    };
  }

  try {
    const res = await fetch('/api/network/ip', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data && data.ip && data.ipHash) {
        return {
          ip: String(data.ip).slice(0, 64),
          ipHash: sanitizeFirestoreId(String(data.ipHash), 'ip'),
          detectedAt: String(data.detectedAt || new Date().toISOString()),
          isOffline: false,
        };
      }
    }
  } catch {
    // Try Cloudflare edge trace fallback below
  }

  try {
    const traceRes = await fetch('/cdn-cgi/trace', { cache: 'no-store' });
    if (traceRes.ok) {
      const text = await traceRes.text();
      const match = text.match(/^ip=([^\r\n]+)/m);
      if (match && match[1]) {
        const ip = match[1].trim().slice(0, 64);
        const hash = await computeClientIpHash(ip);
        return {
          ip,
          ipHash: sanitizeFirestoreId(hash, 'ip'),
          detectedAt: new Date().toISOString(),
          isOffline: false,
        };
      }
    }
  } catch {
    // Fallback below if network temporarily unreachable
  }

  return {
    ip: 'غير معروف',
    ipHash: 'offline_mode',
    detectedAt: new Date().toISOString(),
    isOffline: true,
  };
}

export async function signInWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  if (!result.user.email || !result.user.emailVerified) {
    await signOut(auth);
    throw new Error('يجب أن يكون حساب Google مفعّلاً ببريد إلكتروني موثق');
  }
  return result.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  if (!result.user.emailVerified) {
    try {
      await sendEmailVerification(result.user);
    } catch {
      // Ignore rate-limit errors when resending verification link
    }
    await signOut(auth);
    throw new Error('تم إرسال رابط تأكيد إلى بريدك الإلكتروني. يرجى تأكيد البريد ثم تسجيل الدخول.');
  }
  return result.user;
}

export async function registerWithEmail(email: string, password: string): Promise<void> {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
  try {
    await sendEmailVerification(result.user);
  } finally {
    await signOut(auth);
  }
}

export async function signOutFromGoogle(): Promise<void> {
  const currentUid = auth.currentUser?.uid;
  if (currentUid) {
    clearLocalVerifiedIpCache(currentUid);
  }
  await signOut(auth);
}

export async function ensureUserProfile(user: User): Promise<UserProfileRecord> {
  const uid = sanitizeFirestoreId(user.uid);
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  const email = (user.email || 'user@example.com').slice(0, 200);
  const displayName = (user.displayName || email.split('@')[0] || 'مستخدم مستمسكاتي').slice(0, 120);
  const photoURL = user.photoURL && user.photoURL.length <= 500 ? user.photoURL : undefined;

  if (!snap.exists()) {
    const newProfile: Record<string, unknown> = {
      uid,
      email,
      displayName,
      requireEmailOnNewIp: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (photoURL) {
      newProfile.photoURL = photoURL;
    }

    try {
      await setDoc(ref, newProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }

    return {
      uid,
      email,
      displayName,
      photoURL,
      requireEmailOnNewIp: true,
    };
  }

  const existing = snap.data() as UserProfileRecord;
  if (
    existing.email !== email ||
    existing.displayName !== displayName ||
    (photoURL && existing.photoURL !== photoURL)
  ) {
    const patch: Record<string, unknown> = {
      email,
      displayName,
      updatedAt: serverTimestamp(),
    };
    if (photoURL) {
      patch.photoURL = photoURL;
    }
    try {
      await updateDoc(ref, patch);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  return {
    uid,
    email,
    displayName,
    photoURL: photoURL || existing.photoURL,
    requireEmailOnNewIp: existing.requireEmailOnNewIp ?? true,
  };
}

export async function registerTrustedIpAndDevice(
  user: User,
  ipInfo: NetworkIpInfo,
  customDeviceName?: string
): Promise<void> {
  const uid = sanitizeFirestoreId(user.uid);
  await ensureUserProfile(user);

  const ipHash = sanitizeFirestoreId(ipInfo.ipHash, 'ip');
  const ipLabel = (ipInfo.ip || 'unknown').slice(0, 64) || 'unknown';
  const deviceId = sanitizeFirestoreId(getDeviceId(), 'dev');
  const deviceName = (customDeviceName || getDeviceName() || 'جهاز مستمسكاتي').slice(0, 120);
  const userAgent = (navigator.userAgent || 'web').slice(0, 240);
  const verifiedEmail = (user.email || 'user@example.com').slice(0, 200);
  const platform = detectDevicePlatform().slice(0, 60);

  // 1. Register / Trust IP Address
  const ipPath = `users/${uid}/trustedIps/${ipHash}`;
  const ipRef = doc(db, 'users', uid, 'trustedIps', ipHash);
  let ipSnap;
  try {
    ipSnap = await getDoc(ipRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, ipPath);
  }

  if (!ipSnap.exists()) {
    try {
      await setDoc(ipRef, {
        ownerUid: uid,
        ipHash,
        ipLabel,
        deviceId,
        deviceName,
        userAgent,
        verifiedEmail,
        trusted: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, ipPath);
    }
  } else {
    try {
      await updateDoc(ipRef, {
        deviceId,
        deviceName,
        userAgent,
        verifiedEmail,
        trusted: true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, ipPath);
    }
  }

  // 2. Register / Update Device Entry
  const devPath = `users/${uid}/devices/${deviceId}`;
  const devRef = doc(db, 'users', uid, 'devices', deviceId);
  let devSnap;
  try {
    devSnap = await getDoc(devRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, devPath);
  }

  if (!devSnap.exists()) {
    try {
      await setDoc(devRef, {
        ownerUid: uid,
        id: deviceId,
        name: deviceName,
        platform,
        lastIpLabel: ipLabel,
        lastIpHash: ipHash,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, devPath);
    }
  } else {
    try {
      await updateDoc(devRef, {
        name: deviceName,
        platform,
        lastIpLabel: ipLabel,
        lastIpHash: ipHash,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, devPath);
    }
  }

  setLocalVerifiedIpCache(uid, ipInfo, verifiedEmail);
}

export async function verifyNetworkAccess(
  user: User,
  ipInfo: NetworkIpInfo
): Promise<{
  allowed: boolean;
  reason: IpGateReason;
  profile: UserProfileRecord | null;
}> {
  if (!user.email || !user.emailVerified) {
    return { allowed: false, reason: 'signin', profile: null };
  }

  const uid = sanitizeFirestoreId(user.uid);
  const localCache = getLocalVerifiedIpCache(uid);

  if (ipInfo.isOffline) {
    if (localCache && localCache.email === user.email) {
      return {
        allowed: true,
        reason: null,
        profile: {
          uid,
          email: user.email,
          displayName: user.displayName || user.email,
          photoURL: user.photoURL || undefined,
          requireEmailOnNewIp: true,
        },
      };
    }
    return { allowed: false, reason: 'new_ip', profile: null };
  }

  const userPath = `users/${uid}`;
  let profileSnap;
  try {
    profileSnap = await getDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (!profileSnap.exists()) {
    return { allowed: false, reason: 'new_device', profile: null };
  }

  const profile = profileSnap.data() as UserProfileRecord;
  const ipHash = sanitizeFirestoreId(ipInfo.ipHash, 'ip');
  const deviceId = sanitizeFirestoreId(getDeviceId(), 'dev');

  const devPath = `users/${uid}/devices/${deviceId}`;
  const ipPath = `users/${uid}/trustedIps/${ipHash}`;

  let devSnap;
  let ipSnap;
  try {
    [devSnap, ipSnap] = await Promise.all([
      getDoc(doc(db, 'users', uid, 'devices', deviceId)),
      getDoc(doc(db, 'users', uid, 'trustedIps', ipHash)),
    ]);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${devPath} | ${ipPath}`);
  }

  if (!devSnap.exists()) {
    return { allowed: false, reason: 'new_device', profile };
  }

  if (!ipSnap.exists()) {
    return { allowed: false, reason: 'new_ip', profile };
  }

  const ipData = ipSnap.data() as TrustedIpRecord;
  if (ipData.trusted !== true) {
    return { allowed: false, reason: 'revoked', profile };
  }

  if (profile.requireEmailOnNewIp) {
    if (!localCache) {
      return { allowed: false, reason: 'new_ip', profile };
    }
    if (localCache.ipHash !== ipHash) {
      return { allowed: false, reason: 'ip_changed', profile };
    }
  }

  return { allowed: true, reason: null, profile };
}

export async function updateRequireEmailOnNewIp(
  uidRaw: string,
  requireEmailOnNewIp: boolean
): Promise<void> {
  const uid = sanitizeFirestoreId(uidRaw);
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      requireEmailOnNewIp,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function revokeTrustedIp(uidRaw: string, ipHashRaw: string): Promise<void> {
  const uid = sanitizeFirestoreId(uidRaw);
  const ipHash = sanitizeFirestoreId(ipHashRaw);
  const path = `users/${uid}/trustedIps/${ipHash}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'trustedIps', ipHash), {
      trusted: false,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeTrustedIp(uidRaw: string, ipHashRaw: string): Promise<void> {
  const uid = sanitizeFirestoreId(uidRaw);
  const ipHash = sanitizeFirestoreId(ipHashRaw);
  const path = `users/${uid}/trustedIps/${ipHash}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'trustedIps', ipHash));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function removeUserDevice(uidRaw: string, deviceIdRaw: string): Promise<void> {
  const uid = sanitizeFirestoreId(uidRaw);
  const deviceId = sanitizeFirestoreId(deviceIdRaw);
  const path = `users/${uid}/devices/${deviceId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'devices', deviceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeCurrentIpTrust(
  uidRaw: string,
  ipHashRaw: string,
  onTrustLost: (reason: 'revoked' | 'new_ip') => void
): Unsubscribe {
  const uid = sanitizeFirestoreId(uidRaw);
  const ipHash = sanitizeFirestoreId(ipHashRaw);
  const path = `users/${uid}/trustedIps/${ipHash}`;

  return onSnapshot(
    doc(db, 'users', uid, 'trustedIps', ipHash),
    (snap) => {
      if (!snap.exists()) {
        clearLocalVerifiedIpCache(uid);
        onTrustLost('new_ip');
        return;
      }
      const data = snap.data() as TrustedIpRecord;
      if (data.trusted !== true) {
        clearLocalVerifiedIpCache(uid);
        onTrustLost('revoked');
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeSecurityInventory(
  uidRaw: string,
  onUpdate: (data: { trustedIps: TrustedIpRecord[]; devices: UserDeviceRecord[] }) => void
): () => void {
  const uid = sanitizeFirestoreId(uidRaw);
  let trustedIps: TrustedIpRecord[] = [];
  let devices: UserDeviceRecord[] = [];

  const emit = () => onUpdate({ trustedIps, devices });

  const unsubIps = onSnapshot(
    query(collection(db, 'users', uid, 'trustedIps'), where('ownerUid', '==', uid)),
    (snap) => {
      trustedIps = snap.docs.map((d) => d.data() as TrustedIpRecord);
      emit();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${uid}/trustedIps`);
    }
  );

  const unsubDevices = onSnapshot(
    query(collection(db, 'users', uid, 'devices'), where('ownerUid', '==', uid)),
    (snap) => {
      devices = snap.docs.map((d) => d.data() as UserDeviceRecord);
      emit();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${uid}/devices`);
    }
  );

  return () => {
    unsubIps();
    unsubDevices();
  };
}
