const { Op } = require('sequelize');
const { sequelize, Payment, Order, OrderItem, EtimsInvoice, Tenant, MpesaCallbackEvent } = require('../models');
const { initiateStkPush } = require('../utils/mpesa');
const { reverseOrder } = require('../services/orderReversal');
const { tenantWhere } = require('../utils/tenantScope');
const { resolveTenantConfig } = require('../utils/tenantConfig');
const { callbackPayloadHash, validateCallbackAmount } = require('../services/mpesaCallback');
const { logAudit } = require('../services/auditLogger');

/**
 * POST /api/mpesa/stk-push
 * Body: { paymentId, phone }
 *
 * Expects a Payment row already created (e.g. by the checkout controller
 * with method 'mpesa' and status 'pending'). This just triggers the push
 * and records Safaricom's CheckoutRequestID so the callback can match it
 * back to the right payment later.
 */
async function initiate(req, res) {
  const { paymentId, phone } = req.body;

  if (!paymentId || !phone) {
    return res.status(400).json({ error: 'paymentId and phone are required' });
  }

  try {
    const payment = await Payment.findOne({
      where: { id: paymentId },
      include: [{ model: Order, where: tenantWhere(req), include: [{ model: Tenant }] }]
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    if (payment.method !== 'mpesa') {
      return res.status(400).json({ error: 'Payment method is not mpesa' });
    }
    if (payment.status === 'confirmed') {
      return res.status(400).json({ error: 'Payment already confirmed' });
    }

    const response = await initiateStkPush({
      phone,
      amount: payment.amount,
      accountReference: payment.Order.orderNumber,
      transactionDesc: `Payment for order ${payment.Order.orderNumber}`,
      config: (await resolveTenantConfig(payment.Order.Tenant || payment.Order.tenantId)).mpesa
    });

    if (response.ResponseCode !== '0') {
      // Safaricom accepted the HTTP request but flagged the push itself as invalid
      await payment.update({ status: 'failed' });
      return res.status(400).json({
        error: response.ResponseDescription || 'STK push was not accepted'
      });
    }

    await payment.update({
      mpesaCheckoutRequestId: response.CheckoutRequestID,
      mpesaPhone: phone,
      status: 'pending'
    });

    return res.status(200).json({
      message: 'STK push sent, waiting for customer to enter PIN',
      checkoutRequestId: response.CheckoutRequestID
    });
  } catch (err) {
    const message = err.response?.data?.errorMessage || err.message;
    return res.status(500).json({ error: message });
  }
}

/**
 * POST /api/mpesa/callback
 *
 * Safaricom calls this once the customer has responded to the STK prompt
 * (entered PIN, cancelled, or timed out). Must always return HTTP 200
 * or Daraja will treat the callback as undelivered.
 */
async function callback(req, res) {
  // Always acknowledge, even on internal errors, so Safaricom doesn't retry indefinitely
  const ack = () => res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  let callbackEvent = null;
  try {
    const stkCallback = req.body?.Body?.stkCallback;
    const payloadHash = callbackPayloadHash(req.body);
    const [event, created] = await MpesaCallbackEvent.findOrCreate({
      where: { payloadHash },
      defaults: {
        checkoutRequestId: stkCallback?.CheckoutRequestID || null,
        resultCode: Number.isFinite(Number(stkCallback?.ResultCode)) ? Number(stkCallback.ResultCode) : null,
        payload: req.body || {},
        status: stkCallback ? 'received' : 'exception',
        error: stkCallback ? null : 'Missing Body.stkCallback'
      }
    });
    callbackEvent = event;
    if (!created) {
      await event.increment('deliveryCount');
      return ack();
    }
    if (!stkCallback) {
      return ack();
    }

    const { CheckoutRequestID, ResultCode, CallbackMetadata } = stkCallback;

    const payment = await Payment.findOne({
      where: { mpesaCheckoutRequestId: CheckoutRequestID },
      include: [{ model: Order }]
    });

    if (!payment) {
      await callbackEvent.update({ status: 'unmatched', processedAt: new Date() });
      return ack();
    }
    await callbackEvent.update({ paymentId: payment.id });

    // Idempotency: Safaricom can retry callbacks, don't reprocess a settled payment
    if (payment.status === 'confirmed' || payment.status === 'failed') {
      await callbackEvent.update({ status: 'duplicate', processedAt: new Date() });
      return ack();
    }

    if (Number(ResultCode) !== 0) {
      // Customer cancelled, timed out, or had insufficient funds
      await payment.update({ status: 'failed' });

      // If no other payment on this order is confirmed, the sale never
      // actually happened, so restore the stock automatically rather than
      // leaving it short until a cashier notices and voids manually.
      const siblingPayments = await Payment.findAll({
        where: { orderId: payment.orderId }
      });
      const anyOtherConfirmed = siblingPayments.some(
        (p) => p.id !== payment.id && p.status === 'confirmed'
      );

      if (!anyOtherConfirmed) {
        const t = await sequelize.transaction();
        try {
          const order = await Order.findByPk(payment.orderId, {
            include: [{ model: OrderItem }, { model: Payment }, { model: EtimsInvoice }],
            transaction: t,
            lock: t.LOCK.UPDATE
          });

          if (order && order.status === 'completed' && order.EtimsInvoice?.status !== 'transmitted') {
            await reverseOrder(
              order,
              { reason: 'M-Pesa payment failed or timed out', userId: null },
              t
            );
          }
          await t.commit();
        } catch (reversalErr) {
          await t.rollback();
          console.error('Auto-reversal after failed mpesa payment failed:', reversalErr.message);
        }
      }

      await callbackEvent.update({ status: 'payment_failed', processedAt: new Date() });
      return ack();
    }

    const items = CallbackMetadata?.Item || [];
    const getValue = (name) => items.find((i) => i.Name === name)?.Value;

    const mpesaReceiptNumber = getValue('MpesaReceiptNumber');
    const amountPaid = getValue('Amount');
    const phoneNumber = getValue('PhoneNumber');
    const { valid: amountMatches, expectedAmount } = validateCallbackAmount(amountPaid, payment.amount);

    if (!amountMatches) {
      await callbackEvent.update({
        status: 'exception',
        error: `Amount mismatch: expected ${expectedAmount.toFixed(2)}, received ${amountPaid ?? 'missing'}`,
        processedAt: new Date()
      });
      return ack();
    }

    await payment.update({
      status: 'confirmed',
      mpesaReceiptNumber,
      mpesaPhone: phoneNumber ? String(phoneNumber) : payment.mpesaPhone
    });

    // If every payment on this order is now confirmed, mark the order paid
    const orderPayments = await Payment.findAll({
      where: { orderId: payment.orderId }
    });
    const allConfirmed = orderPayments.every((p) => p.status === 'confirmed');

    if (allConfirmed) {
      await Order.update(
        { paymentStatus: 'paid' },
        { where: { id: payment.orderId } }
      );
    }

    await callbackEvent.update({ status: 'processed', processedAt: new Date() });

    return ack();
  } catch (err) {
    if (callbackEvent) {
      await callbackEvent.update({ status: 'error', error: err.message, processedAt: new Date() }).catch(() => {});
    }
    console.error('M-Pesa callback processing error:', err.message);
    return ack();
  }
}

async function callbackExceptions(req, res) {
  try {
    const events = await MpesaCallbackEvent.findAll({
      where: { status: { [Op.in]: ['exception', 'error'] } },
      include: [{
        model: Payment,
        required: true,
        attributes: ['id', 'amount', 'status', 'mpesaPhone'],
        include: [{ model: Order, required: true, where: tenantWhere(req), attributes: ['id', 'orderNumber', 'total'] }]
      }],
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    return res.json(events.map((event) => ({
      id: event.id,
      status: event.status,
      checkoutRequestId: event.checkoutRequestId,
      resultCode: event.resultCode,
      error: event.error,
      deliveryCount: event.deliveryCount,
      createdAt: event.createdAt,
      payment: event.Payment ? {
        id: event.Payment.id,
        amount: Number(event.Payment.amount),
        status: event.Payment.status,
        phone: event.Payment.mpesaPhone,
        orderId: event.Payment.Order?.id,
        orderNumber: event.Payment.Order?.orderNumber
      } : null
    })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function simulateCallback(req, res) {
  if (process.env.NODE_ENV === 'production' || String(process.env.MPESA_ENV).toLowerCase() === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  const { paymentId, scenario = 'success', receiptNumber } = req.body;
  const payment = await Payment.findOne({
    where: { id: paymentId, method: 'mpesa' },
    include: [{ model: Order, required: true, where: tenantWhere(req) }]
  });
  if (!payment) return res.status(404).json({ error: 'Pending M-Pesa payment not found' });
  if (payment.status !== 'pending') return res.status(409).json({ error: `Payment is already ${payment.status}` });

  const checkoutRequestId = payment.mpesaCheckoutRequestId || `SIM-${payment.id}`;
  if (!payment.mpesaCheckoutRequestId) await payment.update({ mpesaCheckoutRequestId: checkoutRequestId });
  const resultCode = scenario === 'success' || scenario === 'amount_mismatch' ? 0 : scenario === 'timeout' ? 1037 : 1032;
  const amount = scenario === 'amount_mismatch' ? Number(payment.amount) + 1 : Number(payment.amount);
  req.body = {
    Body: {
      stkCallback: {
        MerchantRequestID: `SIM-MERCHANT-${payment.id}`,
        CheckoutRequestID: checkoutRequestId,
        ResultCode: resultCode,
        ResultDesc: scenario,
        ...(resultCode === 0 ? {
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: amount },
              { Name: 'MpesaReceiptNumber', Value: String(receiptNumber || `SIM${payment.id.replace(/-/g, '').slice(0, 8)}`).toUpperCase() },
              { Name: 'PhoneNumber', Value: payment.mpesaPhone || '254700000000' }
            ]
          }
        } : {})
      }
    }
  };
  return callback(req, res);
}

async function resolveCallbackException(req, res) {
  const { action, note, receiptNumber } = req.body;
  const normalizedReceiptNumber = receiptNumber ? String(receiptNumber).trim().toUpperCase() : null;
  const transaction = await sequelize.transaction();
  try {
    const event = await MpesaCallbackEvent.findOne({
      where: { id: req.params.id, status: { [Op.in]: ['exception', 'error'] } },
      include: [{
        model: Payment,
        required: true,
        include: [{ model: Order, required: true, where: tenantWhere(req) }]
      }],
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!event) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Unresolved M-Pesa exception not found' });
    }

    const payment = await Payment.findByPk(event.paymentId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!payment) throw new Error('Exception payment no longer exists');

    let resolution;
    if (action === 'confirm') {
      if (payment.status !== 'pending') {
        await transaction.rollback();
        return res.status(409).json({ error: `Payment is already ${payment.status}` });
      }
      const duplicateReceipt = await Payment.findOne({
        where: { mpesaReceiptNumber: normalizedReceiptNumber, id: { [Op.ne]: payment.id } },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (duplicateReceipt) {
        await transaction.rollback();
        return res.status(409).json({ error: 'That M-Pesa receipt is already assigned to another payment' });
      }
      await payment.update({ status: 'confirmed', mpesaReceiptNumber: normalizedReceiptNumber }, { transaction });
      const orderPayments = await Payment.findAll({
        where: { orderId: payment.orderId },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (orderPayments.every((item) => item.status === 'confirmed')) {
        await Order.update({ paymentStatus: 'paid' }, { where: { id: payment.orderId }, transaction });
      }
      resolution = 'confirmed_from_statement';
    } else {
      resolution = 'dismissed';
    }

    await event.update({
      status: 'resolved',
      resolution,
      resolutionNote: note,
      resolvedByUserId: req.user.id,
      resolvedAt: new Date()
    }, { transaction });
    await logAudit({
      req,
      action: 'mpesa.callback_exception_resolved',
      entityType: 'mpesa_callback_event',
      entityId: event.id,
      metadata: {
        resolution,
        note,
        paymentId: payment.id,
        orderId: payment.orderId,
        receiptNumber: action === 'confirm' ? normalizedReceiptNumber : null
      },
      transaction
    });
    await transaction.commit();
    return res.json({ id: event.id, status: 'resolved', resolution });
  } catch (err) {
    if (!transaction.finished) await transaction.rollback();
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { initiate, callback, callbackExceptions, resolveCallbackException, simulateCallback };
