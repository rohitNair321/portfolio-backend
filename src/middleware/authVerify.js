// middleware/authVerify.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
const PROFILE_OWNER_ID = process.env.PROFILE_OWNER_ID;

/**
 * Verify JWT and attach user
 */
function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  const cookieToken = req.cookies?.token;

  let token = null;

  if (auth && auth.startsWith("Bearer ")) {
    token = auth.split(" ")[1];
  } else if (cookieToken) {
    token = cookieToken;
  }

  if (!token) {
    return res.status(401).json({
      message: "Authorization token required"
    });
  }
  // if (!auth || !auth.startsWith('Bearer ')) {
  //   return res.status(401).json({ message: 'Authorization token required' });
  // }

  // token = auth.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    if (!payload.role) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };

    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

/**
 * ADMIN ONLY middleware
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

/**
 * Public routes (guest)
 */
function allowPublic(req, res, next) {
  let token = null;

  if (req.cookies?.token) {
    token = req.cookies.token;
  }

  const authHeader = req.headers.authorization;

  if (!token && authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!auth || !auth.startsWith('Bearer ')) {
    req.user = {
      id: PROFILE_OWNER_ID,
      role: 'guest'
    };
    return next();
  }

  // 2. If token IS provided, try to verify it
  // const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.sub,
      role: payload.role
    };
    next();
  } catch (err) {
    // If token is expired/invalid, we still allow them as a guest
    req.user = { id: PROFILE_OWNER_ID, role: 'guest' };
    next();
  }
}

function optionalAuth(req, res, next) {
  let token = null;
  let tokenSource = null;

  // 1. Check if token exists in Cookies
  if (req.cookies?.token) {
    token = req.cookies.token;
    tokenSource = 'Cookie';
  }

  // 2. If not in cookies, check the Authorization Header
  const authHeader = req.headers.authorization;
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
    tokenSource = 'Auth-Header';
  }

  // 3. 🚨 No token found at all -> Assign Guest
  if (!token) {
    console.log(`[🔍 optionalAuth] No token found. Downgrading to GUEST. Path: ${req.originalUrl}`);
    req.user = { id: PROFILE_OWNER_ID, role: 'guest' };
    return next();
  }

  // 4. Token found -> Let's verify it
  try {
    const payload = jwt.verify(token, JWT_SECRET);

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role || 'guest'
    };

    console.log(`[✅ optionalAuth] Authenticated as ${req.user.role} via ${tokenSource}. Email: ${req.user.email}`);
    return next();

  } catch (err) {
    // 5. Expired or Invalid token -> Fallback to Guest
    console.warn(`[⚠️ optionalAuth] Token verification failed via ${tokenSource}. Falling back to GUEST. Reason: ${err.message}`);
    req.user = { id: PROFILE_OWNER_ID, role: 'guest' };
    return next();
  }
}

module.exports = {
  verifyToken,
  requireAdmin,
  allowPublic,
  optionalAuth
};
