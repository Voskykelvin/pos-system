'use strict';

const { Op } = require('sequelize');
const { Branch, Tenant, User } = require('../models');
const { hashPassword } = require('../utils/passwords');
const { getPlan, getPlanLimit } = require('../utils/planCatalog');
const { logAudit } = require('../services/auditLogger');

const STAFF_ROLES = new Set(['admin', 'manager', 'cashier']);

function toPlain(model) {
  return typeof model?.get === 'function' ? model.get({ plain: true }) : model;
}

function cleanString(value, max = 255) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, max);
}

function cleanEmail(value) {
  const email = cleanString(value, 255);
  return email ? email.toLowerCase() : null;
}

function cleanPhone(value) {
  return cleanString(value, 50);
}

function publicSettings(settings = {}) {
  const business = settings.business || {};
  const billing = settings.billing || {};
  const mpesa = settings.mpesa || {};
  const etims = settings.etims || {};
  const sms = settings.sms || {};

  return {
    business: {
      name: business.name || '',
      kraPin: business.kraPin || '',
      timeZone: business.timeZone || 'Africa/Nairobi',
      receiptPolicy: business.receiptPolicy || '',
      receiptFooter: business.receiptFooter || '',
      currency: business.currency || '',
      country: business.country || ''
    },
    billing: {
      subscriptionPaymentMethod: billing.subscriptionPaymentMethod || 'not_set',
      status: billing.status || 'active',
      billingContactName: billing.billingContactName || '',
      billingContactEmail: billing.billingContactEmail || '',
      billingPhone: billing.billingPhone || '',
      billingReference: billing.billingReference || ''
    },
    mpesa: {
      mode: mpesa.mode || 'manual',
      env: mpesa.env || 'sandbox',
      shortcode: mpesa.shortcode || '',
      tillNumber: mpesa.tillNumber || '',
      paybillNumber: mpesa.paybillNumber || '',
      accountNumber: mpesa.accountNumber || '',
      callbackUrl: mpesa.callbackUrl || '',
      envPrefix: mpesa.envPrefix || '',
      hasConsumerKey: Boolean(mpesa.consumerKey),
      hasConsumerSecret: Boolean(mpesa.consumerSecret),
      hasPasskey: Boolean(mpesa.passkey)
    },
    etims: {
      status: etims.status || 'not_configured',
      env: etims.env || 'sandbox',
      baseUrl: etims.baseUrl || '',
      deviceSerial: etims.deviceSerial || '',
      envPrefix: etims.envPrefix || '',
      hasApiKey: Boolean(etims.apiKey)
    },
    sms: {
      senderId: sms.senderId || '',
      envPrefix: sms.envPrefix || '',
      hasApiKey: Boolean(sms.apiKey)
    }
  };
}

function publicTenant(tenant) {
  const plain = toPlain(tenant);
  return {
    id: plain.id,
    name: plain.name,
    slug: plain.slug,
    currency: plain.currency,
    country: plain.country,
    plan: plain.plan,
    status: plain.status,
    settings: publicSettings(plain.settings)
  };
}

function publicBranch(branch) {
  const plain = toPlain(branch);
  return {
    id: plain.id,
    name: plain.name,
    code: plain.code,
    phone: plain.phone,
    address: plain.address,
    city: plain.city,
    isActive: plain.isActive,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
}

function publicStaff(user) {
  const plain = toPlain(user);
  return {
    id: plain.id,
    name: plain.name,
    email: plain.email,
    phone: plain.phone,
    role: plain.role,
    branchId: plain.branchId,
    branch: plain.Branch ? publicBranch(plain.Branch) : null,
    isActive: plain.isActive,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
}

async function getTenantOr404(req, res) {
  if (!req.tenantId) {
    res.status(400).json({ error: 'No store is attached to this account' });
    return null;
  }

  const tenant = await Tenant.findByPk(req.tenantId);
  if (!tenant) {
    res.status(404).json({ error: 'Store not found' });
    return null;
  }
  return tenant;
}

async function activeCount(model, tenantId) {
  return model.count({ where: { tenantId, isActive: true } });
}

async function assertBranchLimit(req, res) {
  const limit = getPlanLimit(req.tenant?.plan, 'branchLimit');
  if (!limit) return true;

  const count = await activeCount(Branch, req.tenantId);
  if (count >= limit) {
    res.status(403).json({
      error: `Your ${req.tenant.plan} plan allows ${limit} active branch${limit === 1 ? '' : 'es'}`
    });
    return false;
  }
  return true;
}

async function assertStaffLimit(req, res) {
  const limit = getPlanLimit(req.tenant?.plan, 'staffLimit');
  if (!limit) return true;

  const count = await activeCount(User, req.tenantId);
  if (count >= limit) {
    res.status(403).json({
      error: `Your ${req.tenant.plan} plan allows ${limit} active staff user${limit === 1 ? '' : 's'}`
    });
    return false;
  }
  return true;
}

async function loadSetup(req, res) {
  try {
    const tenant = await getTenantOr404(req, res);
    if (!tenant) return;

    const [branches, staff] = await Promise.all([
      Branch.findAll({
        where: { tenantId: req.tenantId },
        order: [['isActive', 'DESC'], ['createdAt', 'ASC']]
      }),
      User.findAll({
        where: { tenantId: req.tenantId },
        include: [{ model: Branch, attributes: ['id', 'name', 'code', 'isActive'] }],
        order: [['role', 'ASC'], ['createdAt', 'ASC']]
      })
    ]);

    const activeBranches = branches.filter((branch) => branch.isActive).length;
    const activeStaff = staff.filter((user) => user.isActive).length;
    const settings = publicSettings(tenant.settings || {});
    const plan = getPlan(tenant.plan);

    return res.json({
      tenant: publicTenant(tenant),
      plan,
      limits: {
        branchLimit: plan?.branchLimit ?? null,
        staffLimit: plan?.staffLimit ?? null,
        registerLimit: plan?.registerLimit ?? null
      },
      counts: {
        branches: branches.length,
        activeBranches,
        staff: staff.length,
        activeStaff
      },
      checklist: {
        hasBranch: activeBranches > 0,
        hasExtraStaff: activeStaff > 1,
        hasSubscriptionPaymentMethod: settings.billing.subscriptionPaymentMethod !== 'not_set',
        hasBusinessTaxDetails: Boolean(settings.business.kraPin),
        hasPaymentCollection: settings.mpesa.mode !== 'disabled',
        hasEtimsSetup: settings.etims.status === 'configured' || settings.etims.status === 'pending_activation'
      },
      branches: branches.map(publicBranch),
      staff: staff.map(publicStaff)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function createBranch(req, res) {
  try {
    const tenant = await getTenantOr404(req, res);
    if (!tenant) return;
    const willBeActive = req.body.isActive === undefined ? true : Boolean(req.body.isActive);
    if (willBeActive && !(await assertBranchLimit(req, res))) return;

    const name = cleanString(req.body.name);
    if (!name) {
      return res.status(400).json({ error: 'Branch name is required' });
    }

    const branch = await Branch.create({
      tenantId: req.tenantId,
      name,
      code: cleanString(req.body.code, 50),
      phone: cleanPhone(req.body.phone),
      address: cleanString(req.body.address),
      city: cleanString(req.body.city, 100),
      isActive: willBeActive
    });

    logAudit({
      req,
      action: 'branch.create',
      entityType: 'branch',
      entityId: branch.id,
      metadata: { name: branch.name }
    }).catch(() => {});

    return res.status(201).json(publicBranch(branch));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

async function updateBranch(req, res) {
  try {
    const branch = await Branch.findOne({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!branch) return res.status(404).json({ error: 'Branch not found' });

    const updates = {};
    if (req.body.name !== undefined) {
      const name = cleanString(req.body.name);
      if (!name) return res.status(400).json({ error: 'Branch name is required' });
      updates.name = name;
    }
    if (req.body.code !== undefined) updates.code = cleanString(req.body.code, 50);
    if (req.body.phone !== undefined) updates.phone = cleanPhone(req.body.phone);
    if (req.body.address !== undefined) updates.address = cleanString(req.body.address);
    if (req.body.city !== undefined) updates.city = cleanString(req.body.city, 100);
    if (req.body.isActive !== undefined) {
      const nextActive = Boolean(req.body.isActive);
      if (nextActive && !branch.isActive && !(await assertBranchLimit(req, res))) return;
      updates.isActive = nextActive;
    }

    await branch.update(updates);

    logAudit({
      req,
      action: 'branch.update',
      entityType: 'branch',
      entityId: branch.id,
      metadata: { name: branch.name, updates: Object.keys(updates) }
    }).catch(() => {});

    return res.json(publicBranch(branch));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

async function validateBranch(req, branchId) {
  if (!branchId) return null;
  const branch = await Branch.findOne({ where: { id: branchId, tenantId: req.tenantId, isActive: true } });
  if (!branch) {
    throw Object.assign(new Error('Selected branch is not active or does not belong to this store'), { status: 400 });
  }
  return branch.id;
}

async function createStaff(req, res) {
  try {
    const tenant = await getTenantOr404(req, res);
    if (!tenant) return;
    if (!(await assertStaffLimit(req, res))) return;

    const name = cleanString(req.body.name);
    const email = cleanEmail(req.body.email);
    const phone = cleanPhone(req.body.phone);
    const role = cleanString(req.body.role, 20) || 'cashier';
    const branchId = await validateBranch(req, req.body.branchId || null);

    if (!name) return res.status(400).json({ error: 'Staff name is required' });
    if (!email && !phone) return res.status(400).json({ error: 'Email or phone is required for staff login' });
    if (!STAFF_ROLES.has(role)) return res.status(400).json({ error: 'Unknown staff role' });
    if (!req.body.password) return res.status(400).json({ error: 'Staff password is required' });

    const existing = await User.findOne({
      where: {
        [Op.or]: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : [])
        ]
      }
    });
    if (existing) return res.status(409).json({ error: 'That email or phone is already in use' });

    const user = await User.create({
      tenantId: req.tenantId,
      branchId,
      name,
      email,
      phone,
      role,
      passwordHash: hashPassword(String(req.body.password)),
      isActive: true
    });

    logAudit({
      req,
      action: 'staff.create',
      entityType: 'user',
      entityId: user.id,
      metadata: { name: user.name, role: user.role }
    }).catch(() => {});

    return res.status(201).json(publicStaff(user));
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
}

async function updateStaff(req, res) {
  try {
    const user = await User.findOne({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!user) return res.status(404).json({ error: 'Staff user not found' });

    const updates = {};
    if (req.body.name !== undefined) {
      const name = cleanString(req.body.name);
      if (!name) return res.status(400).json({ error: 'Staff name is required' });
      updates.name = name;
    }
    if (req.body.email !== undefined) updates.email = cleanEmail(req.body.email);
    if (req.body.phone !== undefined) updates.phone = cleanPhone(req.body.phone);
    if (req.body.role !== undefined) {
      const role = cleanString(req.body.role, 20);
      if (!STAFF_ROLES.has(role)) return res.status(400).json({ error: 'Unknown staff role' });
      if (user.id === req.user.id && role !== user.role) {
        return res.status(400).json({ error: 'You cannot change your own role' });
      }
      updates.role = role;
    }
    if (req.body.branchId !== undefined) updates.branchId = await validateBranch(req, req.body.branchId || null);
    if (req.body.isActive !== undefined) {
      if (user.id === req.user.id && req.body.isActive === false) {
        return res.status(400).json({ error: 'You cannot deactivate your own account' });
      }
      const nextActive = Boolean(req.body.isActive);
      if (nextActive && !user.isActive && !(await assertStaffLimit(req, res))) return;
      updates.isActive = nextActive;
    }
    if (req.body.password) {
      updates.passwordHash = hashPassword(String(req.body.password));
    }

    await user.update(updates);
    const refreshed = await User.findByPk(user.id, {
      include: [{ model: Branch, attributes: ['id', 'name', 'code', 'isActive'] }]
    });

    logAudit({
      req,
      action: 'staff.update',
      entityType: 'user',
      entityId: user.id,
      metadata: { name: user.name, updates: Object.keys(updates) }
    }).catch(() => {});

    return res.json(publicStaff(refreshed));
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
}

function mergeSettings(current, body) {
  const next = {
    ...(current || {}),
    business: { ...((current || {}).business || {}) },
    billing: { ...((current || {}).billing || {}) },
    mpesa: { ...((current || {}).mpesa || {}) },
    etims: { ...((current || {}).etims || {}) },
    sms: { ...((current || {}).sms || {}) }
  };

  if (body.business) {
    next.business.name = cleanString(body.business.name) || '';
    next.business.kraPin = cleanString(body.business.kraPin, 50) || '';
    next.business.timeZone = cleanString(body.business.timeZone, 80) || 'Africa/Nairobi';
    next.business.receiptPolicy = cleanString(body.business.receiptPolicy, 255) || '';
    next.business.receiptFooter = cleanString(body.business.receiptFooter, 255) || '';
    next.business.currency = cleanString(body.business.currency, 10) || '';
    next.business.country = cleanString(body.business.country, 10) || '';
  }

  if (body.billing) {
    next.billing.subscriptionPaymentMethod = cleanString(body.billing.subscriptionPaymentMethod, 50) || 'not_set';
    next.billing.status = cleanString(body.billing.status, 50) || 'active';
    next.billing.billingContactName = cleanString(body.billing.billingContactName) || '';
    next.billing.billingContactEmail = cleanEmail(body.billing.billingContactEmail) || '';
    next.billing.billingPhone = cleanPhone(body.billing.billingPhone) || '';
    next.billing.billingReference = cleanString(body.billing.billingReference, 100) || '';
  }

  if (body.mpesa) {
    next.mpesa.mode = cleanString(body.mpesa.mode, 50) || 'manual';
    next.mpesa.env = cleanString(body.mpesa.env, 50) || 'sandbox';
    next.mpesa.shortcode = cleanString(body.mpesa.shortcode, 50) || '';
    next.mpesa.tillNumber = cleanString(body.mpesa.tillNumber, 50) || '';
    next.mpesa.paybillNumber = cleanString(body.mpesa.paybillNumber, 50) || '';
    next.mpesa.accountNumber = cleanString(body.mpesa.accountNumber, 80) || '';
    next.mpesa.callbackUrl = cleanString(body.mpesa.callbackUrl, 500) || '';
    next.mpesa.envPrefix = cleanString(body.mpesa.envPrefix, 80) || '';
  }

  if (body.etims) {
    next.etims.status = cleanString(body.etims.status, 50) || 'not_configured';
    next.etims.env = cleanString(body.etims.env, 50) || 'sandbox';
    next.etims.baseUrl = cleanString(body.etims.baseUrl, 500) || '';
    next.etims.deviceSerial = cleanString(body.etims.deviceSerial, 100) || '';
    next.etims.envPrefix = cleanString(body.etims.envPrefix, 80) || '';
  }

  if (body.sms) {
    next.sms.senderId = cleanString(body.sms.senderId, 50) || '';
    next.sms.envPrefix = cleanString(body.sms.envPrefix, 80) || '';
  }

  return next;
}

async function updateSettings(req, res) {
  try {
    const tenant = await getTenantOr404(req, res);
    if (!tenant) return;

    const settings = mergeSettings(tenant.settings || {}, req.body || {});
    const updates = { settings };

    if (settings.business.name) updates.name = settings.business.name;
    if (settings.business.currency) updates.currency = settings.business.currency.toUpperCase();
    if (settings.business.country) updates.country = settings.business.country.toUpperCase();

    await tenant.update(updates);

    logAudit({
      req,
      action: 'settings.update',
      entityType: 'tenant',
      entityId: tenant.id,
      metadata: { sections: Object.keys(req.body || {}) }
    }).catch(() => {});

    return res.json(publicTenant(tenant));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

module.exports = {
  createBranch,
  createStaff,
  loadSetup,
  updateBranch,
  updateSettings,
  updateStaff
};
