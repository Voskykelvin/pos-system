/**
 * Lightweight, dependency-free request body validation middleware.
 *
 * Usage:
 *   const { validate } = require('../middleware/validate');
 *   router.post('/checkout', authenticate, validate(checkoutSchema), checkout);
 *
 * Schema field descriptors:
 *   type        : 'string' | 'number' | 'boolean' | 'array' | 'object'
 *   required    : boolean (default true)
 *   minLength   : number  (strings)
 *   maxLength   : number  (strings)
 *   min         : number  (numbers)
 *   max         : number  (numbers)
 *   enum        : array   (allowed values)
 *   items       : schema  (array item schema - validates every element)
 *   nonEmpty    : boolean (arrays must have >= 1 element)
 */

function typeOf(value) {
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Validate a single value against a field descriptor.
 * Returns an array of error strings (empty = valid).
 */
function validateField(key, value, descriptor) {
  const errors = [];
  const { type, required = true, minLength, maxLength, min, max, enumValues, items, nonEmpty } = descriptor;
  const missing = value === undefined || value === null || value === '';

  if (missing) {
    if (required) errors.push(`${key} is required`);
    return errors; // no further checks if missing
  }

  const actual = typeOf(value);

  if (type && actual !== type) {
    // Special case: accept numeric strings for 'number' fields.
    // express.json() preserves JSON types, but clients often send amounts
    // as strings (e.g. from Number.toFixed()). Coerce and re-validate.
    if (type === 'number' && actual === 'string' && value.trim() !== '') {
      const coerced = Number(value);
      if (!Number.isFinite(coerced)) {
        errors.push(`${key} must be a valid number (got "${value}")`);
        return errors;
      }
      // Replace the value reference for downstream range checks
      // by re-calling ourselves with the coerced value.
      return validateField(key, coerced, descriptor);
    }
    errors.push(`${key} must be a ${type} (got ${actual})`);
    return errors; // type mismatch - skip deeper checks
  }

  if (type === 'string') {
    const str = String(value);
    if (minLength !== undefined && str.length < minLength) {
      errors.push(`${key} must be at least ${minLength} characters`);
    }
    if (maxLength !== undefined && str.length > maxLength) {
      errors.push(`${key} must be at most ${maxLength} characters`);
    }
  }

  if (type === 'number') {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      errors.push(`${key} must be a finite number`);
    } else {
      if (min !== undefined && num < min) errors.push(`${key} must be >= ${min}`);
      if (max !== undefined && num > max) errors.push(`${key} must be <= ${max}`);
    }
  }

  if (enumValues && !enumValues.includes(value)) {
    errors.push(`${key} must be one of: ${enumValues.join(', ')}`);
  }

  if (type === 'array') {
    if (nonEmpty && value.length === 0) {
      errors.push(`${key} must not be empty`);
    }
    if (items && Array.isArray(value)) {
      value.forEach((element, index) => {
        Object.entries(items).forEach(([subKey, subDescriptor]) => {
          const subErrors = validateField(
            `${key}[${index}].${subKey}`,
            element?.[subKey],
            subDescriptor
          );
          errors.push(...subErrors);
        });
      });
    }
  }

  return errors;
}

/**
 * Build an Express middleware from a schema object.
 * @param {Record<string, object>} schema
 */
function validate(schema) {
  return (req, res, next) => {
    const body = req.body || {};
    const allErrors = [];

    for (const [key, descriptor] of Object.entries(schema)) {
      const errors = validateField(key, body[key], descriptor);
      allErrors.push(...errors);
    }

    if (allErrors.length > 0) {
      return res.status(400).json({
        error: allErrors[0], // primary message, compatible with existing error format
        fields: allErrors    // detailed list for clients that want it
      });
    }

    return next();
  };
}

// -- Reusable schemas ----------------------------------------------------------

const schemas = {
  login: {
    identifier: { type: 'string', minLength: 1, maxLength: 255 },
    password:   { type: 'string', minLength: 1, maxLength: 1024 }
  },

  checkout: {
    items: {
      type: 'array',
      nonEmpty: true,
      items: {
        productId: { type: 'string', minLength: 1 },
        quantity:  { type: 'number', min: 0.001 }
      }
    },
    payments: {
      type: 'array',
      nonEmpty: true,
      items: {
        method: { type: 'string', enumValues: ['cash', 'mpesa', 'credit', 'card'] },
        amount: { type: 'number', min: 0.01 }
      }
    }
  },

  mpesaStkPush: {
    paymentId: { type: 'string', minLength: 1 },
    phone:     { type: 'string', minLength: 6, maxLength: 30 }
  },

  voidOrder: {
    reason: { type: 'string', required: false, maxLength: 500 }
  },

  refundOrder: {
    reason: { type: 'string', required: false, maxLength: 500 }
  },

  createProduct: {
    sku:          { type: 'string', minLength: 1, maxLength: 100 },
    name:         { type: 'string', minLength: 1, maxLength: 255 },
    sellingPrice: { type: 'number', min: 0 },
    categoryId:   { type: 'string', minLength: 1 },
    costPrice:    { type: 'number', required: false, min: 0 },
    reorderLevel: { type: 'number', required: false, min: 0 },
    stockQuantity:{ type: 'number', required: false, min: 0 },
    barcode:      { type: 'string', required: false, maxLength: 100 },
    unit:         { type: 'string', required: false, maxLength: 50 }
  },

  updateProduct: {
    // All fields optional on update but at least one must be present (checked in controller)
    name:         { type: 'string', required: false, minLength: 1, maxLength: 255 },
    sku:          { type: 'string', required: false, minLength: 1, maxLength: 100 },
    sellingPrice: { type: 'number', required: false, min: 0 },
    costPrice:    { type: 'number', required: false, min: 0 },
    reorderLevel: { type: 'number', required: false, min: 0 },
    barcode:      { type: 'string', required: false, maxLength: 100 },
    unit:         { type: 'string', required: false, maxLength: 50 }
  },

  adjustStock: {
    type:     { type: 'string', enumValues: ['purchase', 'adjustment', 'wastage', 'return'] },
    quantity: { type: 'number' }, // can be negative for wastage; controller validates final balance
    note:     { type: 'string', required: false, maxLength: 500 }
  },

  expense: {
    amount:      { type: 'number', min: 0.01 },
    category:    { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string', required: false, maxLength: 255 }
  },

  customerPayment: {
    amount: { type: 'number', min: 0.01 },
    notes:  { type: 'string', required: false, maxLength: 255 }
  },

  openShift: {
    openingFloat: { type: 'number', required: false, min: 0 },
    note:         { type: 'string', required: false, maxLength: 500 }
  },

  closeShift: {
    cashCounted: { type: 'number', min: 0 },
    note:        { type: 'string', required: false, maxLength: 500 }
  },

  createCategory: {
    name:        { type: 'string', minLength: 1, maxLength: 100 },
    taxCategory: { type: 'string', required: false, enumValues: ['standard', 'zero_rated', 'exempt'] }
  },

  createCustomer: {
    name:   { type: 'string', required: false, maxLength: 255 },
    phone:  { type: 'string', required: false, maxLength: 30 },
    kraPin: { type: 'string', required: false, maxLength: 50 }
  },

  partialRefund: {
    items: {
      type: 'array',
      nonEmpty: true,
      items: {
        orderItemId: { type: 'string', minLength: 1 },
        quantity:    { type: 'number', min: 0.001 }
      }
    },
    reason: { type: 'string', required: false, maxLength: 500 }
  },

  createPromotion: {
    code:  { type: 'string', minLength: 1, maxLength: 50 },
    type:  { type: 'string', enumValues: ['percent', 'fixed'] },
    value: { type: 'number', min: 0.01 },
    description:   { type: 'string', required: false, maxLength: 255 },
    minOrderTotal: { type: 'number', required: false, min: 0 },
    maxUses:       { type: 'number', required: false, min: 0 }
  },

  updatePromotion: {
    description:   { type: 'string', required: false, maxLength: 255 },
    type:          { type: 'string', required: false, enumValues: ['percent', 'fixed'] },
    value:         { type: 'number', required: false, min: 0.01 },
    minOrderTotal: { type: 'number', required: false, min: 0 },
    maxUses:       { type: 'number', required: false, min: 0 },
    startsAt:      { type: 'string', required: false, maxLength: 50 },
    expiresAt:     { type: 'string', required: false, maxLength: 50 },
    isActive:      { type: 'boolean', required: false }
  }
};

module.exports = { validate, schemas };
