'use strict';

const { Supplier } = require('../models');
const { logAudit } = require('../services/auditLogger');
const { tenantWhere, withTenant } = require('../utils/tenantScope');

async function list(req, res) {
  try {
    const suppliers = await Supplier.findAll({
      where: tenantWhere(req),
      order: [['name', 'ASC']]
    });
    return res.json(suppliers);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function create(req, res) {
  const { name, email, phone, address, contactPerson, kraPin } = req.body;
  if (!name) return res.status(400).json({ error: 'Supplier name is required' });

  try {
    const supplier = await Supplier.create({
      name: String(name).trim(),
      email: email ? String(email).trim() : null,
      phone: phone ? String(phone).trim() : null,
      address: address ? String(address).trim() : null,
      contactPerson: contactPerson ? String(contactPerson).trim() : null,
      kraPin: kraPin ? String(kraPin).trim() : null,
      ...withTenant(req)
    });

    await logAudit({
      req,
      action: 'supplier.create',
      entityType: 'supplier',
      entityId: supplier.id,
      metadata: { name: supplier.name }
    });

    return res.status(201).json(supplier);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

async function update(req, res) {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    const { name, email, phone, address, contactPerson, kraPin, isActive } = req.body;
    await supplier.update({ name, email, phone, address, contactPerson, kraPin, isActive });

    await logAudit({
      req,
      action: 'supplier.update',
      entityType: 'supplier',
      entityId: supplier.id,
      metadata: { name: supplier.name }
    });

    return res.json(supplier);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

module.exports = { create, list, update };
