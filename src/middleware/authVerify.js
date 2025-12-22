const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing token' });
  }

  const token = auth.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role || 'user' // 👈 IMPORTANT
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireUser(req, res, next) {
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'Login required' });
  }
  next();
}

function allowPublic(req, res, next) {
  next(); // read-only routes
}


module.exports = {
  verifyToken,
  requireUser,
  allowPublic
};
