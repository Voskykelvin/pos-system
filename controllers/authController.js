const { User } = require('../models');
const { createAuthToken } = require('../utils/authToken');
const { verifyPassword } = require('../utils/passwords');

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    tenantId: user.tenantId || null
  };
}

async function login(req, res) {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'identifier and password are required' });
  }

  try {
    const normalized = identifier.trim().toLowerCase();
    const users = await User.findAll({
      where: { isActive: true }
    });
    const user = users.find(
      (candidate) =>
        candidate.email?.toLowerCase() === normalized ||
        candidate.phone === identifier.trim()
    );

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid login details' });
    }

    return res.json({
      token: createAuthToken(user),
      user: publicUser(user)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = { login, me };
