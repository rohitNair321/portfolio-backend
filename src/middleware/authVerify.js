// middleware/authVerify.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
const PROFILE_OWNER_ID = process.env.PROFILE_OWNER_ID;

/**
 * Verify JWT and attach user
 */
function verifyToken(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token required' });
  }

  const token = auth.split(' ')[1];

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
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith('Bearer ')) {
    req.user = {
      id: PROFILE_OWNER_ID, 
      role: 'guest'
    };
    return next();
  }

  // 2. If token IS provided, try to verify it
  const token = auth.split(' ')[1];
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

module.exports = {
  verifyToken,
  requireAdmin,
  allowPublic
};
