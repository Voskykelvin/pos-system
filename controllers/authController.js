const { Op } = require('sequelize');
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
    const trimmed = identifier.trim();
    const user = await User.findOne({
      where: {
        isActive: true,
        [Op.or]: [{ email: { [Op.iLike]: trimmed } }, { phone: trimmed }]
      }
    });

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
