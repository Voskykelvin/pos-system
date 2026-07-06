'use strict';

const { Tenant } = require('../models');

function plainSettings(tenant) {
  if (!tenant) return {};
  const settings = typeof tenant.get === 'function' ? tenant.get('settings') : tenant.settings;
  return settings && typeof settings === 'object' ? settings : {};
}

function prefixedEnv(section, envKey) {
  const prefix = section?.envPrefix ? String(section.envPrefix).trim() : '';
  if (!prefix) return undefined;
  return process.env[`${prefix}_${envKey}`];
}

function configValue(section, field, envKey, fallback = undefined) {
  if (section && section[field] !== undefined && section[field] !== null && section[field] !== '') {
    return section[field];
  }
  return prefixedEnv(section, envKey) ?? process.env[envKey] ?? fallback;
}

async function loadTenant(tenantOrId) {
  if (!tenantOrId) return null;
  if (typeof tenantOrId === 'object') return tenantOrId;
  return Tenant.findByPk(tenantOrId, {
    attributes: ['id', 'name', 'slug', 'currency', 'country', 'plan', 'status', 'settings']
  });
}

async function resolveTenantConfig(tenantOrId) {
  const tenant = await loadTenant(tenantOrId);
  const settings = plainSettings(tenant);
  const business = settings.business || {};
  const mpesa = settings.mpesa || {};
  const etims = settings.etims || {};
  const sms = settings.sms || {};

  return {
    tenant,
    business: {
      name: configValue(business, 'name', 'BUSINESS_NAME', tenant?.name || 'Jijenge POS'),
      kraPin: configValue(business, 'kraPin', 'BUSINESS_KRA_PIN', null),
      receiptPolicy: configValue(business, 'receiptPolicy', 'BUSINESS_RECEIPT_POLICY', ''),
      receiptFooter: configValue(business, 'receiptFooter', 'BUSINESS_RECEIPT_FOOTER', ''),
      currency: configValue(business, 'currency', 'BUSINESS_CURRENCY', tenant?.currency || 'KES'),
      country: configValue(business, 'country', 'BUSINESS_COUNTRY', tenant?.country || 'KE'),
      timeZone: configValue(business, 'timeZone', 'BUSINESS_TIME_ZONE', 'Africa/Nairobi')
    },
    mpesa: {
      env: configValue(mpesa, 'env', 'MPESA_ENV', 'sandbox'),
      consumerKey: configValue(mpesa, 'consumerKey', 'MPESA_CONSUMER_KEY', null),
      consumerSecret: configValue(mpesa, 'consumerSecret', 'MPESA_CONSUMER_SECRET', null),
      shortcode: configValue(mpesa, 'shortcode', 'MPESA_SHORTCODE', null),
      passkey: configValue(mpesa, 'passkey', 'MPESA_PASSKEY', null),
      callbackUrl: configValue(mpesa, 'callbackUrl', 'MPESA_CALLBACK_URL', null)
    },
    etims: {
      status: configValue(etims, 'status', 'ETIMS_STATUS', 'not_configured'),
      env: configValue(etims, 'env', 'ETIMS_ENV', 'sandbox'),
      baseUrl: configValue(etims, 'baseUrl', 'ETIMS_BASE_URL', null),
      apiKey: configValue(etims, 'apiKey', 'ETIMS_API_KEY', null),
      deviceSerial: configValue(etims, 'deviceSerial', 'ETIMS_DEVICE_SERIAL', null)
    },
    sms: {
      username: configValue(sms, 'username', 'AFRICASTALKING_USERNAME', 'sandbox'),
      apiKey: configValue(sms, 'apiKey', 'AFRICASTALKING_API_KEY', null),
      senderId: configValue(sms, 'senderId', 'AFRICASTALKING_SENDER_ID', '')
    }
  };
}

module.exports = { resolveTenantConfig };
