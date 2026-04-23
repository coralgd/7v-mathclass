import { db, doc, getDoc } from './firebase.js';

let cachedIp = null;

const getClientIp = async () => {
  if (cachedIp) return cachedIp;

  try {
    const resp = await fetch('https://api.ipify.org?format=json');
    const data = await resp.json();
    cachedIp = data.ip || 'unknown';
    return cachedIp;
  } catch {
    cachedIp = 'unknown';
    return cachedIp;
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

const getUserState = async (uid) => {
  if (!uid) return { exists: false, data: null };

  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? { exists: true, data: snap.data() } : { exists: false, data: null };
  } catch {
    return { exists: false, data: null };
  }
};

const checkPageAccess = async (
  user,
  {
    requireVerified = false,
    allowedRoles = null,
    allowUnverifiedOnly = false,
  } = {},
) => {
  const ip = await getClientIp();

  if (await isIpBlocked(ip)) {
    return { ok: false, reason: 'blocked_ip', ip };
  }

  if (!user) {
    return { ok: false, reason: 'no_auth', ip };
  }

  const { exists, data } = await getUserState(user.uid);
  if (!exists) {
    return { ok: false, reason: 'no_profile', ip };
  }

  if (data.blockedForever) {
    return { ok: false, reason: 'blocked_account', ip, userData: data };
  }

  if (allowUnverifiedOnly && data.verified) {
    return { ok: false, reason: 'already_verified', ip, userData: data };
  }

  if (requireVerified && !data.verified) {
    return { ok: false, reason: 'need_verification', ip, userData: data };
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length) {
    const role = data.role || 'user';
    if (!allowedRoles.includes(role)) {
      return { ok: false, reason: 'role_denied', ip, userData: data };
    }
  }

  return { ok: true, ip, userData: data };
};

const redirectByRole = (role) => {
  if (role === 'elder') return 'elder.html';
  if (role === 'moderator') return 'moderator.html';
  return 'main.html';
};

export { getClientIp, isIpBlocked, getUserState, checkPageAccess, redirectByRole };
