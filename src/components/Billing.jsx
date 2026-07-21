import { useEffect, useMemo, useState } from 'react';
import {
  BUILDER_NAME,
  BUILDER_PHONE_DISPLAY,
  BUILDER_TEL_URL,
  BUILDER_WHATSAPP_URL
} from '../utils/builderContact';

const METHOD_OPTIONS = [
  { value: 'mpesa_manual', label: 'M-Pesa phone' },
  { value: 'till_manual', label: 'M-Pesa Till' },
  { value: 'paybill_manual', label: 'M-Pesa PayBill' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card_gateway', label: 'Card or gateway' },
  { value: 'other', label: 'Other' }
];

function formatMoney(amount, currency = 'KES') {
  return `${currency} ${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function titleCase(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

function statusCopy(status) {
  if (status === 'active') return 'Active';
  if (status === 'pending_payment') return 'Payment required';
  if (status === 'past_due') return 'Past due';
  if (status === 'suspended') return 'Suspended';
  return titleCase(status);
}

function billingGuidance(billing) {
  if (!billing) return '';
  if (billing.status === 'active' && Number(billing.daysRemaining) <= 7) {
    return `Renew before ${formatDate(billing.subscriptionEndsAt)} to keep checkout, inventory, and reports open.`;
  }
  if (billing.status === 'active') {
    return 'Your subscription is active. You can submit the next payment reference before the renewal date.';
  }
  if (billing.pendingPayment) {
    return 'Your payment reference is waiting for platform admin verification.';
  }
  if (billing.status === 'past_due') {
    return 'Your subscription has ended. Submit a payment reference to restore workspace access.';
  }
  if (billing.status === 'pending_payment') {
    return 'Submit your first subscription payment reference to activate the workspace.';
  }
  return 'Submit a payment reference or contact the platform admin for billing help.';
}

export default function Billing({ authToken, onContinue, onLogout }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [selectedUpgrade, setSelectedUpgrade] = useState('');
  const [form, setForm] = useState({
    method: 'mpesa_manual',
    payerName: '',
    payerPhone: '',
    reference: '',
    notes: ''
  });

  async function loadBilling() {
    try {
      setLoading(true);
      const res = await fetch('/api/billing', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Billing failed to load');
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBilling();
  }, [authToken]);

  const billing = data?.billing;
  const instructions = data?.instructions || {};
  const charge = billing?.charge || {};
  const upgradeQuotes = billing?.availableUpgrades || [];
  const selectedQuote = upgradeQuotes.find((quote) => quote.targetPlan === selectedUpgrade) || null;
  const displayCharge = selectedQuote || charge;
  const canContinue = billing?.status === 'active';
  const rejectedPayment = data?.recentPayments?.find((payment) => payment.status === 'rejected');

  const paymentChannels = useMemo(() => {
    const rows = [];
    if (instructions.mpesaPhone) {
      rows.push({ label: 'M-Pesa phone', value: instructions.mpesaPhone, method: 'mpesa_manual' });
    }
    if (instructions.tillNumber) {
      rows.push({ label: 'Till number', value: instructions.tillNumber, method: 'till_manual' });
    }
    if (instructions.paybillNumber) {
      rows.push({
        label: 'PayBill',
        value: instructions.paybillNumber,
        detail: instructions.accountNumber ? `Account: ${instructions.accountNumber}` : '',
        method: 'paybill_manual'
      });
    }
    if (instructions.bankName || instructions.bankAccountNumber) {
      rows.push({
        label: 'Bank transfer',
        value: [instructions.bankName, instructions.bankAccountNumber].filter(Boolean).join(' - '),
        detail: instructions.bankAccountName || '',
        method: 'bank_transfer'
      });
    }
    if (instructions.gatewayProvider) {
      rows.push({ label: 'Gateway', value: instructions.gatewayProvider, method: 'card_gateway' });
    }
    return rows;
  }, [instructions]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch('/api/billing/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ ...form, targetPlan: selectedUpgrade || undefined })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Payment reference could not be submitted');
      setMessage(result.message || 'Payment reference submitted.');
      setForm((current) => ({ ...current, reference: '', notes: '' }));
      setSelectedUpgrade('');
      await loadBilling();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !data) {
    return <div className="loading">Loading subscription billing...</div>;
  }

  return (
    <section className="billing-page page-container">
      <header className="header">
        <div>
          <span className="badge">Subscription billing</span>
          <h1>{data?.tenant?.name || 'Store'} payment</h1>
          <p>{statusCopy(billing?.status)} on {billing?.plan?.name || 'current'} plan.</p>
        </div>
        <div className="actions">
          <button className="secondaryBtn" type="button" onClick={loadBilling}>
            Refresh
          </button>
          {onLogout && (
            <button className="secondaryBtn" type="button" onClick={onLogout}>
              Sign out
            </button>
          )}
        </div>
      </header>

      {message && <div className="successBanner">{message}</div>}
      {error && <div className="errorBanner">{error}</div>}
      {rejectedPayment && (
        <div className="warningBanner">
          <strong>Latest rejected reference: {rejectedPayment.reference}</strong>
          <span>{rejectedPayment.adminNotes || 'The platform admin could not verify this payment. Submit a corrected reference.'}</span>
        </div>
      )}

      {upgradeQuotes.length > 0 && (
        <section className="upgradePanel" aria-labelledby="upgrade-heading">
          <div className="upgradeHeader">
            <div>
              <span className="badge">Upgrade anytime</span>
              <h2 id="upgrade-heading">Unlock more features today</h2>
              <p>Unused time on {billing?.plan?.name} is credited automatically. Your renewal date stays {formatDate(billing?.subscriptionEndsAt)}.</p>
            </div>
            {selectedQuote && (
              <button className="secondaryBtn" type="button" onClick={() => setSelectedUpgrade('')}>Keep current plan</button>
            )}
          </div>
          <div className="upgradeGrid">
            {upgradeQuotes.map((quote) => (
              <button
                key={quote.targetPlan}
                type="button"
                className={`${"upgradeCard"} ${selectedUpgrade === quote.targetPlan ? "selectedUpgrade" : ''}`}
                onClick={() => setSelectedUpgrade(quote.targetPlan)}
                disabled={Boolean(billing?.pendingPayment)}
                aria-pressed={selectedUpgrade === quote.targetPlan}
              >
                <span>{quote.targetName}</span>
                <strong>{formatMoney(quote.amount, quote.currency)} now</strong>
                <small>{quote.remainingDays} days remaining · includes {formatMoney(quote.unusedCurrentPlanCredit, quote.currency)} unused-plan credit</small>
                <p>{quote.featureSummary}</p>
              </button>
            ))}
          </div>
          {billing?.pendingPayment && <p className="pendingHint">Finish the pending payment review before requesting another upgrade.</p>}
        </section>
      )}

      <div className="summaryGrid">
        <article className="metric">
          <span>{selectedQuote ? 'Upgrade amount due' : 'Amount due'}</span>
          <strong>{formatMoney(displayCharge.amount, displayCharge.currency)}</strong>
          <small>{selectedQuote ? `${billing?.plan?.name} → ${selectedQuote.targetName}, renewal date unchanged` : `${billing?.plan?.name || 'Plan'} / 30 days`}</small>
        </article>
        <article className="metric">
          <span>Status</span>
          <strong>{statusCopy(billing?.status)}</strong>
          <small>{billing?.pendingPayment ? 'Awaiting admin verification' : 'Latest billing state'}</small>
        </article>
        <article className="metric">
          <span>Subscription ends</span>
          <strong>{formatDate(billing?.subscriptionEndsAt)}</strong>
          <small>{billing?.daysRemaining !== null && billing?.daysRemaining !== undefined ? `${billing.daysRemaining} days remaining` : 'Not active yet'}</small>
        </article>
      </div>

      <div className="guidanceBanner">
        <strong>{billing?.status === 'active' && Number(billing?.daysRemaining) <= 7 ? 'Renewal reminder' : 'Next step'}</strong>
        <span>{billingGuidance(billing)}</span>
      </div>

      <div className="contentGrid">
        <section className="panel">
          <div className="panelHeader">
            <h2>Pay subscription</h2>
            <span>{selectedQuote ? `Upgrade to ${selectedQuote.targetName}` : (instructions.platformName || 'Jijenge POS')}</span>
          </div>

          <div className="channelList">
            {paymentChannels.map((channel) => (
              <button
                className={`${"channel"} ${form.method === channel.method ? "selectedChannel" : ''}`}
                key={`${channel.label}-${channel.value}`}
                type="button"
                onClick={() => setForm((current) => ({ ...current, method: channel.method }))}
              >
                <span>{channel.label}</span>
                <strong>{channel.value}</strong>
                {channel.detail && <small>{channel.detail}</small>}
              </button>
            ))}
            {paymentChannels.length === 0 && (
              <div className="emptyState">
                Platform payment account is not configured yet. Contact {instructions.billingEmail || instructions.billingPhone || 'the platform admin'} after sending payment.
              </div>
            )}
          </div>

          <div className="supportStrip">
            <span>System built by {BUILDER_NAME}</span>
            <a href={BUILDER_TEL_URL}>{BUILDER_PHONE_DISPLAY}</a>
            <a href={BUILDER_WHATSAPP_URL} target="_blank" rel="noreferrer">WhatsApp</a>
          </div>

          <form className="form" onSubmit={handleSubmit}>
            <label>
              Payment method
              <select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>
                {METHOD_OPTIONS.map((method) => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
            </label>
            <label>
              M-Pesa or bank reference
              <input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value.toUpperCase() })} required />
            </label>
            <label>
              Payer phone
              <input value={form.payerPhone} onChange={(event) => setForm({ ...form, payerPhone: event.target.value })} />
            </label>
            <label>
              Payer name
              <input value={form.payerName} onChange={(event) => setForm({ ...form, payerName: event.target.value })} />
            </label>
            <label className="fullField">
              Notes
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows="3" />
            </label>
            <div className="formActions">
              <button className="primaryBtn" type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : selectedQuote ? 'Submit upgrade payment' : 'Submit payment reference'}
              </button>
              {canContinue && (
                <button className="secondaryBtn" type="button" onClick={onContinue}>
                  Open workspace
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <h2>Payment history</h2>
            <span>{data?.recentPayments?.length || 0} records</span>
          </div>
          <div className="history">
            {(data?.recentPayments || []).map((payment) => (
              <article className="historyRow" key={payment.id}>
                <div>
                  <strong>{formatMoney(payment.amount, payment.currency)}</strong>
                  <small>{payment.reference} - {titleCase(payment.method)}</small>
                  {payment.upgrade && <small>{titleCase(payment.upgrade.fromPlan)} → {titleCase(payment.upgrade.targetPlan)} upgrade</small>}
                  {payment.status === 'rejected' && payment.adminNotes && <small className="adminNote">{payment.adminNotes}</small>}
                </div>
                <span className={`${"statusBadge"} ${styles[payment.status]}`}>{titleCase(payment.status)}</span>
                <small>{formatDate(payment.submittedAt)}</small>
              </article>
            ))}
            {(!data?.recentPayments || data.recentPayments.length === 0) && (
              <div className="emptyState">No subscription payment references have been submitted yet.</div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
