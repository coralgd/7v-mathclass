import { db, doc, getDoc } from './firebase.js';

let cachedIp = null;

const PAGE_RULES = {
  index: {},
  main: { requireVerified: true },
  name: { allowUnverifiedOnly: true },
  moderator: { requireVerified: true, allowedRoles: ['moderator', 'elder'] },
  elder: { requireVerified: true, allowedRoles: ['elder'] },
};

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

const checkPageAccess = async (user, page = 'index') => {
  const policy = PAGE_RULES[page] || {};
  const ip = await getClientIp();

  if (await isIpBlocked(ip)) {
    return { ok: false, reason: 'blocked_ip', ip, page };
  }

  if (!user) {
    return { ok: false, reason: 'no_auth', ip, page };
  }

  const { exists, data } = await getUserState(user.uid);
  if (!exists) {
    return { ok: false, reason: 'no_profile', ip, page };
  }

  if (data.blockedForever) {
    return { ok: false, reason: 'blocked_account', ip, page, userData: data };
  }

  if (policy.allowUnverifiedOnly && data.verified) {
    return { ok: false, reason: 'already_verified', ip, page, userData: data };
  }

  if (policy.requireVerified && !data.verified) {
    return { ok: false, reason: 'need_verification', ip, page, userData: data };
  }

  if (Array.isArray(policy.allowedRoles) && policy.allowedRoles.length) {
    const role = data.role || 'user';
    if (!policy.allowedRoles.includes(role)) {
      return { ok: false, reason: 'role_denied', ip, page, userData: data };
    }
  }

  return { ok: true, ip, page, userData: data };
};

const redirectByRole = (role) => {
  if (role === 'elder') return 'elder.html';
  if (role === 'moderator') return 'moderator.html';
  return 'main.html';
};

export { getClientIp, isIpBlocked, getUserState, checkPageAccess, redirectByRole };
