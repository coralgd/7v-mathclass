import { auth, db, signOut, doc, getDoc } from './firebase.js';

const KNOWN_ROLES = ['user', 'moderator', 'elder'];

const getClientIp = async () => {
  try {
    const resp = await fetch('https://api.ipify.org?format=json');
    const data = await resp.json();
    return data.ip || 'unknown';
  } catch {
    return 'unknown';
  }
};

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const getClientDeviceId = async () => {
  try {
    const parts = [
      navigator.userAgent || 'na',
      navigator.language || 'na',
      navigator.platform || 'na',
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'na',
      `${window.screen?.width || 0}x${window.screen?.height || 0}`,
      `${window.screen?.colorDepth || 0}`,
      `${navigator.hardwareConcurrency || 0}`,
    ];
    const raw = parts.join('|');
    const enc = new TextEncoder().encode(raw);
    const hash = await crypto.subtle.digest('SHA-256', enc);
    return toHex(hash);
  } catch {
    return 'unknown-device';
  }
};

const isIpBlocked = async (ip) => {
  if (!ip || ip === 'unknown') return false;
  try {
    const snap = await getDoc(doc(db, 'blocked_ips', ip));
    return snap.exists() && snap.data().blocked === true;
  } catch {
    return false;
  }
};

const isDeviceBlocked = async (deviceId) => {
  if (!deviceId || deviceId === 'unknown-device') return false;
  try {
    const snap = await getDoc(doc(db, 'blocked_devices', deviceId));
    return snap.exists() && snap.data().blocked === true;
  } catch {
    return false;
  }
};

export const enforcePageAccess = async (user, config = {}) => {
  const { requireVerified = false, allowedRoles = null } = config;

  if (!user) {
    return { ok: false, reason: 'unauthorized' };
  }

  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    return { ok: false, reason: 'profile_missing' };
  }

  const data = userSnap.data();
  const role = data.role || 'user';
  const clientIp = await getClientIp();
  const clientDeviceId = await getClientDeviceId();
  const profileIp = data.lastIp || data.createdIp || 'unknown';
  const profileDeviceId = data.lastDeviceId || data.createdDeviceId || 'unknown-device';
  const blockedByClientIp = await isIpBlocked(clientIp);
  const blockedByProfileIp = await isIpBlocked(profileIp);
  const blockedByClientDevice = await isDeviceBlocked(clientDeviceId);
  const blockedByProfileDevice = await isDeviceBlocked(profileDeviceId);
  const blockedForever = data.blockedForever || blockedByClientIp || blockedByProfileIp || blockedByClientDevice || blockedByProfileDevice;

  if (blockedForever) {
    await signOut(auth);
    return { ok: false, reason: 'blocked_forever' };
  }

  if (!KNOWN_ROLES.includes(role)) {
    return { ok: false, reason: 'invalid_role', data };
  }

  if (requireVerified && !data.verified) {
    return { ok: false, reason: 'not_verified', data };
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return { ok: false, reason: 'role_denied', data };
  }

  return { ok: true, data, role, clientIp, profileIp, clientDeviceId, profileDeviceId, userRef };
};
