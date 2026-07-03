const { User } = require('../models');
const { verifyAuthToken } = require('../utils/authToken');

async function authenticate(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const [, token] = header.match(/^Bearer\s+(.+)$/i) || [];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const payload = verifyAuthToken(token);
    const user = await User.findByPk(payload.sub);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User is inactive or missing' });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role
    };

    return next();
  } catch (err) {
    return res.status(401).json({ error: err.message });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    return next();
  };
}

module.exports = { authenticate, requireRoles };
