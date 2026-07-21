import { useEffect, useMemo, useState } from 'react';

const EMPTY_BRANCH = {
  name: '',
  code: '',
  phone: '',
  address: '',
  city: ''
};

const EMPTY_STAFF = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'cashier',
  branchId: ''
};

const EMPTY_BUSINESS = {
  name: '',
  kraPin: '',
  timeZone: 'Africa/Nairobi',
  receiptPolicy: '',
  receiptFooter: '',
  currency: 'KES',
  country: 'KE'
};

const EMPTY_BILLING = {
  subscriptionPaymentMethod: 'not_set',
  status: 'active',
  billingContactName: '',
  billingContactEmail: '',
  billingPhone: '',
  billingReference: ''
};

const EMPTY_MPESA = {
  mode: 'manual',
  env: 'sandbox',
  shortcode: '',
  tillNumber: '',
  paybillNumber: '',
  accountNumber: '',
  callbackUrl: '',
  envPrefix: ''
};

const EMPTY_ETIMS = {
  status: 'not_configured',
  env: 'sandbox',
  baseUrl: '',
  deviceSerial: '',
  envPrefix: ''
};

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'staff', label: 'Staff' },
  { id: 'branches', label: 'Branches' },
  { id: 'billing', label: 'Subscription' },
  { id: 'payments', label: 'Payments & VAT' },
  { id: 'security', label: 'Security' }
];

const BILLING_METHODS = [
  { value: 'not_set', label: 'Not selected' },
  { value: 'mpesa_paybill', label: 'M-Pesa PayBill or Till' },
  { value: 'card_online', label: 'Card or online checkout' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'manual_invoice', label: 'Manual invoice' }
];

const MPESA_MODES = [
  { value: 'manual', label: 'Manual M-Pesa confirmation' },
  { value: 'daraja_pending', label: 'Daraja STK Push later' },
  { value: 'aggregator', label: 'Payment aggregator' },
  { value: 'disabled', label: 'No M-Pesa collection' }
];

const ETIMS_STATUSES = [
  { value: 'not_configured', label: 'Not configured' },
  { value: 'pending_activation', label: 'Pending activation' },
  { value: 'configured', label: 'Configured' }
];

function limitText(count, limit) {
  return limit ? `${count} / ${limit}` : `${count} / unlimited`;
}

function titleCase(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

function mergeDefaults(defaults, values) {
  return { ...defaults, ...(values || {}) };
}

export default function StoreAdmin({ authToken, user, onOpenBilling }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [setup, setSetup] = useState(null);
  const [branches, setBranches] = useState([]);
  const [staff, setStaff] = useState([]);
  const [branchForm, setBranchForm] = useState(EMPTY_BRANCH);
  const [editingBranchId, setEditingBranchId] = useState(null);
  const [staffForm, setStaffForm] = useState(EMPTY_STAFF);
  const [businessForm, setBusinessForm] = useState(EMPTY_BUSINESS);
  const [billingForm, setBillingForm] = useState(EMPTY_BILLING);
  const [mpesaForm, setMpesaForm] = useState(EMPTY_MPESA);
  const [etimsForm, setEtimsForm] = useState(EMPTY_ETIMS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [mfaEnabled, setMfaEnabled] = useState(Boolean(user?.mfaEnabled));
  const [mfaSetup, setMfaSetup] = useState(null);
  const [mfaCode, setMfaCode] = useState('');

  const canEdit = user?.role === 'admin';
  const limits = setup?.limits || {};
  const counts = setup?.counts || {};
  const checklist = setup?.checklist || {};

  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${authToken}`
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function applySetup(data) {
    const settings = data.tenant?.settings || {};
    setSetup(data);
    setBranches(data.branches || []);
    setStaff(data.staff || []);
    setBusinessForm(mergeDefaults(EMPTY_BUSINESS, {
      ...(settings.business || {}),
      name: settings.business?.name || data.tenant?.name || '',
      currency: settings.business?.currency || data.tenant?.currency || 'KES',
      country: settings.business?.country || data.tenant?.country || 'KE'
    }));
    setBillingForm(mergeDefaults(EMPTY_BILLING, settings.billing));
    setMpesaForm(mergeDefaults(EMPTY_MPESA, settings.mpesa));
    setEtimsForm(mergeDefaults(EMPTY_ETIMS, settings.etims));
  }

  async function loadSetup() {
    setLoading(true);
    try {
      const data = await api('/api/admin/store/setup');
      applySetup(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSetup();
  }, [authToken]);

  async function loadSessions() {
    try {
      setSessions(await api('/api/auth/sessions'));
    } catch (err) {
      setError(err.message);
    }
  }

  async function revokeDeviceSession(session) {
    if (!window.confirm(`Sign out ${session.current ? 'this device' : 'that device'}?`)) return;
    try {
      await api(`/api/auth/sessions/${session.id}`, { method: 'DELETE' });
      if (session.current) window.location.reload();
      else await loadSessions();
    } catch (err) {
      setError(err.message);
    }
  }

  async function beginMfaSetup() {
    const password = window.prompt('Confirm your current password:');
    if (!password) return;
    try {
      setMfaSetup(await api('/api/auth/mfa/setup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password })
      }));
      setMfaCode('');
      setError(null);
    } catch (err) { setError(err.message); }
  }

  async function enableMfa() {
    try {
      await api('/api/auth/mfa/enable', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: mfaCode })
      });
      setMfaEnabled(true);
      setMfaSetup(null);
      setMessage('Authenticator MFA enabled.');
    } catch (err) { setError(err.message); }
  }

  async function disableMfa() {
    const password = window.prompt('Confirm your current password:');
    if (!password) return;
    const code = window.prompt('Enter your current authenticator code:');
    if (!code) return;
    try {
      await api('/api/auth/mfa/disable', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, code })
      });
      setMfaEnabled(false);
      setMessage('Authenticator MFA disabled.');
    } catch (err) { setError(err.message); }
  }

  useEffect(() => {
    if (activeTab === 'security') loadSessions();
  }, [activeTab, authToken]);

  const setupItems = useMemo(() => [
    { key: 'hasBranch', label: 'Branch profile', done: checklist.hasBranch },
    { key: 'hasExtraStaff', label: 'Cashier or manager login', done: checklist.hasExtraStaff },
    { key: 'hasSubscriptionPaymentMethod', label: 'Subscription payment method', done: checklist.hasSubscriptionPaymentMethod },
    { key: 'hasBusinessTaxDetails', label: 'KRA PIN for VAT receipts', done: checklist.hasBusinessTaxDetails },
    { key: 'hasPaymentCollection', label: 'Customer payment collection', done: checklist.hasPaymentCollection },
    { key: 'hasEtimsSetup', label: 'KRA/eTIMS readiness', done: checklist.hasEtimsSetup }
  ], [checklist]);

  async function handleBranchSubmit(event) {
    event.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const path = editingBranchId
        ? `/api/admin/store/branches/${editingBranchId}`
        : '/api/admin/store/branches';
      await api(path, {
        method: editingBranchId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branchForm)
      });
      setBranchForm(EMPTY_BRANCH);
      setEditingBranchId(null);
      await loadSetup();
      setMessage(editingBranchId ? 'Branch updated.' : 'Branch created.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStaffSubmit(event) {
    event.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await api('/api/admin/store/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffForm)
      });
      setStaffForm(EMPTY_STAFF);
      await loadSetup();
      setMessage('Staff login created.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStaff(member, updates) {
    if (!canEdit) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await api(`/api/admin/store/staff/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      await loadSetup();
      setMessage('Staff profile updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleBranch(branch) {
    if (!canEdit) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await api(`/api/admin/store/branches/${branch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !branch.isActive })
      });
      await loadSetup();
      setMessage('Branch status updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await api('/api/admin/store/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business: businessForm,
          billing: billingForm,
          mpesa: mpesaForm,
          etims: etimsForm
        })
      });
      await loadSetup();
      setMessage('Store settings saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function editBranch(branch) {
    setEditingBranchId(branch.id);
    setBranchForm({
      name: branch.name || '',
      code: branch.code || '',
      phone: branch.phone || '',
      address: branch.address || '',
      city: branch.city || ''
    });
    setActiveTab('branches');
  }

  if (loading && !setup) {
    return (
      <section className="store-admin-page page-container">
        <div className="loading">Loading store setup...</div>
      </section>
    );
  }

  return (
    <section className="store-admin-page page-container">
      <header className="header">
        <div>
          <h1>Store setup</h1>
          <p>{setup?.tenant?.name || 'Your store'} is on the {setup?.plan?.name || 'current'} plan.</p>
        </div>
        <button className="secondaryBtn" type="button" onClick={loadSetup}>
          Refresh
        </button>
      </header>

      <div className="tabs" role="tablist" aria-label="Store setup">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${"tabBtn"} ${activeTab === tab.id ? "active" : ''}`}
            onClick={() => setActiveTab(tab.id)}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {message && <div className="successBanner" role="status">{message}</div>}
      {error && <div className="errorBanner" role="alert">{error}</div>}

      {!canEdit && (
        <div className="infoBanner">
          Managers can view setup. Store admins can add staff, branches, and billing details.
        </div>
      )}

      {activeTab === 'overview' && (
        <>
          <div className="metricGrid">
            <article className="metric">
              <span>Plan</span>
              <strong>{setup?.plan?.name || '-'}</strong>
              <small>{setup?.plan?.priceUsd ? `$${setup.plan.priceUsd}/mo` : 'Custom'}</small>
            </article>
            <article className="metric">
              <span>Branches</span>
              <strong>{limitText(counts.activeBranches || 0, limits.branchLimit)}</strong>
              <small>Active branch profiles</small>
            </article>
            <article className="metric">
              <span>Staff</span>
              <strong>{limitText(counts.activeStaff || 0, limits.staffLimit)}</strong>
              <small>Active logins</small>
            </article>
            <article className="metric">
              <span>Registers</span>
              <strong>{limits.registerLimit || 'Unlimited'}</strong>
              <small>Subscription allowance</small>
            </article>
          </div>

          <div className="panel">
            <div className="panelHeader">
              <h2>Launch checklist</h2>
              <span>{setupItems.filter((item) => item.done).length} / {setupItems.length} ready</span>
            </div>
            <div className="checklist">
              {setupItems.map((item) => (
                <div className="checkItem" key={item.key}>
                  <div className="checkItemContent">
                    <span className={item.done ? "doneDot" : "todoDot"} />
                    <strong>{item.label}</strong>
                  </div>
                  <small className={item.done ? "statusDone" : "statusTodo"}>
                    {item.done ? 'Ready' : 'Needs setup'}
                  </small>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'staff' && (
        <div className="twoColumn">
          <form className="panel" onSubmit={handleStaffSubmit}>
            <div className="panelHeader">
              <h2>Create staff login</h2>
              <span>{limitText(counts.activeStaff || 0, limits.staffLimit)}</span>
            </div>
            <label>Name<input value={staffForm.name} onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })} required disabled={!canEdit} /></label>
            <label>Email<input type="email" value={staffForm.email} onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })} disabled={!canEdit} /></label>
            <label>Phone<input value={staffForm.phone} onChange={(event) => setStaffForm({ ...staffForm, phone: event.target.value })} disabled={!canEdit} /></label>
            <label>Password<input type="password" value={staffForm.password} onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })} required disabled={!canEdit} /></label>
            <label>Role
              <select value={staffForm.role} onChange={(event) => setStaffForm({ ...staffForm, role: event.target.value })} disabled={!canEdit}>
                <option value="cashier">Cashier</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label>Branch
              <select value={staffForm.branchId} onChange={(event) => setStaffForm({ ...staffForm, branchId: event.target.value })} disabled={!canEdit}>
                <option value="">No branch assigned</option>
                {branches.filter((branch) => branch.isActive).map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </label>
            <button className="primaryBtn" type="submit" disabled={!canEdit || saving}>
              Create staff profile
            </button>
          </form>

          <div className="panel">
            <div className="panelHeader">
              <h2>Staff profiles</h2>
              <span>{staff.length} total</span>
            </div>
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Branch</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <strong>{member.name}</strong>
                        <small>{member.email || member.phone || '-'}</small>
                      </td>
                      <td>{titleCase(member.role)}</td>
                      <td>
                        <select
                          value={member.branchId || ''}
                          onChange={(event) => updateStaff(member, { branchId: event.target.value || null })}
                          disabled={!canEdit || saving}
                        >
                          <option value="">Unassigned</option>
                          {branches.filter((branch) => branch.isActive).map((branch) => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={member.isActive ? "okBadge" : "offBadge"}>
                          {member.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="secondaryBtn"
                          type="button"
                          disabled={!canEdit || saving || member.id === user?.id}
                          onClick={() => updateStaff(member, { isActive: !member.isActive })}
                        >
                          {member.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'branches' && (
        <div className="twoColumn">
          <form className="panel" onSubmit={handleBranchSubmit}>
            <div className="panelHeader">
              <h2>{editingBranchId ? 'Edit branch' : 'Create branch'}</h2>
              <span>{limitText(counts.activeBranches || 0, limits.branchLimit)}</span>
            </div>
            <label>Branch name<input value={branchForm.name} onChange={(event) => setBranchForm({ ...branchForm, name: event.target.value })} required disabled={!canEdit} /></label>
            <label>Code<input value={branchForm.code} onChange={(event) => setBranchForm({ ...branchForm, code: event.target.value })} disabled={!canEdit} /></label>
            <label>Phone<input value={branchForm.phone} onChange={(event) => setBranchForm({ ...branchForm, phone: event.target.value })} disabled={!canEdit} /></label>
            <label>Address<input value={branchForm.address} onChange={(event) => setBranchForm({ ...branchForm, address: event.target.value })} disabled={!canEdit} /></label>
            <label>City<input value={branchForm.city} onChange={(event) => setBranchForm({ ...branchForm, city: event.target.value })} disabled={!canEdit} /></label>
            <div className="formActions">
              <button className="primaryBtn" type="submit" disabled={!canEdit || saving}>
                {editingBranchId ? 'Save branch' : 'Create branch'}
              </button>
              {editingBranchId && (
                <button className="secondaryBtn" type="button" onClick={() => { setEditingBranchId(null); setBranchForm(EMPTY_BRANCH); }}>
                  Cancel edit
                </button>
              )}
            </div>
          </form>

          <div className="panel">
            <div className="panelHeader">
              <h2>Branch profiles</h2>
              <span>{branches.length} total</span>
            </div>
            <div className="branchList">
              {branches.map((branch) => (
                <article className="branchRow" key={branch.id}>
                  <div>
                    <strong>{branch.name}</strong>
                    <small>{[branch.code, branch.city, branch.phone].filter(Boolean).join(' - ') || 'No extra details'}</small>
                  </div>
                  <span className={branch.isActive ? "okBadge" : "offBadge"}>
                    {branch.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button className="secondaryBtn" type="button" onClick={() => editBranch(branch)} disabled={!canEdit || saving}>
                    Edit
                  </button>
                  <button className="secondaryBtn" type="button" onClick={() => toggleBranch(branch)} disabled={!canEdit || saving}>
                    {branch.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <form className="panel" onSubmit={saveSettings}>
          <div className="panelHeader">
            <h2>Subscription payment</h2>
            <div className="panelHeaderActions">
              <span>{titleCase(billingForm.status)}</span>
              {onOpenBilling && (
                <button className="secondaryBtn" type="button" onClick={onOpenBilling}>
                  Open payment page
                </button>
              )}
            </div>
          </div>
          <div className="formGrid">
            <label>Payment method
              <select value={billingForm.subscriptionPaymentMethod} onChange={(event) => setBillingForm({ ...billingForm, subscriptionPaymentMethod: event.target.value })} disabled={!canEdit}>
                {BILLING_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
            </label>
            <label>Subscription status
              <select value={billingForm.status} onChange={(event) => setBillingForm({ ...billingForm, status: event.target.value })} disabled={!canEdit}>
                <option value="active">Active</option>
                <option value="trialing">Trialing</option>
                <option value="past_due">Past due</option>
                <option value="manual_review">Manual review</option>
              </select>
            </label>
            <label>Billing contact<input value={billingForm.billingContactName} onChange={(event) => setBillingForm({ ...billingForm, billingContactName: event.target.value })} disabled={!canEdit} /></label>
            <label>Billing email<input type="email" value={billingForm.billingContactEmail} onChange={(event) => setBillingForm({ ...billingForm, billingContactEmail: event.target.value })} disabled={!canEdit} /></label>
            <label>Billing phone<input value={billingForm.billingPhone} onChange={(event) => setBillingForm({ ...billingForm, billingPhone: event.target.value })} disabled={!canEdit} /></label>
            <label>Payment reference<input value={billingForm.billingReference} onChange={(event) => setBillingForm({ ...billingForm, billingReference: event.target.value })} disabled={!canEdit} /></label>
          </div>
          <button className="primaryBtn" type="submit" disabled={!canEdit || saving}>
            Save subscription payment
          </button>
        </form>
      )}

      {activeTab === 'payments' && (
        <form className="stackedPanels" onSubmit={saveSettings}>
          <div className="panel">
            <div className="panelHeader">
              <h2>Shop details</h2>
              <span>{businessForm.currency || 'KES'}</span>
            </div>
            <div className="formGrid">
              <label>Receipt business name<input value={businessForm.name} onChange={(event) => setBusinessForm({ ...businessForm, name: event.target.value })} disabled={!canEdit} /></label>
              <label>KRA PIN<input value={businessForm.kraPin} onChange={(event) => setBusinessForm({ ...businessForm, kraPin: event.target.value.toUpperCase() })} disabled={!canEdit} /></label>
              <label>Time zone<input value={businessForm.timeZone} onChange={(event) => setBusinessForm({ ...businessForm, timeZone: event.target.value })} disabled={!canEdit} /></label>
              <label>Currency<input value={businessForm.currency} onChange={(event) => setBusinessForm({ ...businessForm, currency: event.target.value.toUpperCase() })} disabled={!canEdit} /></label>
              <label>Country<input value={businessForm.country} onChange={(event) => setBusinessForm({ ...businessForm, country: event.target.value.toUpperCase() })} disabled={!canEdit} /></label>
              <label>Return policy<input value={businessForm.receiptPolicy} onChange={(event) => setBusinessForm({ ...businessForm, receiptPolicy: event.target.value })} disabled={!canEdit} placeholder="e.g. 14 days exchange/refund upon approval" /></label>
              <label>Receipt footer<input value={businessForm.receiptFooter} onChange={(event) => setBusinessForm({ ...businessForm, receiptFooter: event.target.value })} disabled={!canEdit} /></label>
            </div>
          </div>

          <div className="panel">
            <div className="panelHeader">
              <h2>M-Pesa collection</h2>
              <span>{MPESA_MODES.find((mode) => mode.value === mpesaForm.mode)?.label || 'Manual'}</span>
            </div>
            <div className="formGrid">
              <label>Collection mode
                <select value={mpesaForm.mode} onChange={(event) => setMpesaForm({ ...mpesaForm, mode: event.target.value })} disabled={!canEdit}>
                  {MPESA_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                  ))}
                </select>
              </label>
              <label>Environment
                <select value={mpesaForm.env} onChange={(event) => setMpesaForm({ ...mpesaForm, env: event.target.value })} disabled={!canEdit}>
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </label>
              <label>Shortcode<input value={mpesaForm.shortcode} onChange={(event) => setMpesaForm({ ...mpesaForm, shortcode: event.target.value })} disabled={!canEdit} /></label>
              <label>Till number<input value={mpesaForm.tillNumber} onChange={(event) => setMpesaForm({ ...mpesaForm, tillNumber: event.target.value })} disabled={!canEdit} /></label>
              <label>PayBill number<input value={mpesaForm.paybillNumber} onChange={(event) => setMpesaForm({ ...mpesaForm, paybillNumber: event.target.value })} disabled={!canEdit} /></label>
              <label>Account number<input value={mpesaForm.accountNumber} onChange={(event) => setMpesaForm({ ...mpesaForm, accountNumber: event.target.value })} disabled={!canEdit} /></label>
              <label>Callback URL<input value={mpesaForm.callbackUrl} onChange={(event) => setMpesaForm({ ...mpesaForm, callbackUrl: event.target.value })} disabled={!canEdit} /></label>
              <label>Credentials env prefix<input value={mpesaForm.envPrefix} onChange={(event) => setMpesaForm({ ...mpesaForm, envPrefix: event.target.value.toUpperCase() })} disabled={!canEdit} /></label>
            </div>
          </div>

          <div className="panel">
            <div className="panelHeader">
              <h2>KRA/eTIMS VAT</h2>
              <span>{ETIMS_STATUSES.find((status) => status.value === etimsForm.status)?.label || 'Not configured'}</span>
            </div>
            <div className="formGrid">
              <label>eTIMS status
                <select value={etimsForm.status} onChange={(event) => setEtimsForm({ ...etimsForm, status: event.target.value })} disabled={!canEdit}>
                  {ETIMS_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </label>
              <label>Environment
                <select value={etimsForm.env} onChange={(event) => setEtimsForm({ ...etimsForm, env: event.target.value })} disabled={!canEdit}>
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </label>
              <label>Base URL<input value={etimsForm.baseUrl} onChange={(event) => setEtimsForm({ ...etimsForm, baseUrl: event.target.value })} disabled={!canEdit} /></label>
              <label>Device serial<input value={etimsForm.deviceSerial} onChange={(event) => setEtimsForm({ ...etimsForm, deviceSerial: event.target.value })} disabled={!canEdit} /></label>
              <label>Credentials env prefix<input value={etimsForm.envPrefix} onChange={(event) => setEtimsForm({ ...etimsForm, envPrefix: event.target.value.toUpperCase() })} disabled={!canEdit} /></label>
            </div>
          </div>

          <div className="saveRow">
            <button className="primaryBtn" type="submit" disabled={!canEdit || saving}>
              Save payment and VAT setup
            </button>
          </div>
        </form>
      )}

      {activeTab === 'security' && (
        <div className="stackedPanels">
          <div className="panel">
            <div className="panelHeader">
              <div><h2>Authenticator MFA</h2><p>Protect privileged sign-in with a six-digit rotating code.</p></div>
              <span className={mfaEnabled ? "okBadge" : "offBadge"}>{mfaEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            {!mfaEnabled && !mfaSetup && <button className="primaryBtn" type="button" onClick={beginMfaSetup}>Set up authenticator</button>}
            {mfaSetup && (
              <div className="formGrid">
                <label>Manual setup key<input readOnly value={mfaSetup.secret} onFocus={(event) => event.target.select()} /></label>
                <label>Six-digit code<input value={mfaCode} inputMode="numeric" onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
                <button className="primaryBtn" type="button" disabled={mfaCode.length !== 6} onClick={enableMfa}>Verify and enable</button>
              </div>
            )}
            {mfaEnabled && <button className="secondaryBtn" type="button" onClick={disableMfa}>Disable MFA</button>}
          </div>
          <div className="panel">
          <div className="panelHeader">
            <div>
              <h2>Signed-in devices</h2>
              <p>Review and remotely sign out active browser sessions.</p>
            </div>
            <button className="secondaryBtn" type="button" onClick={loadSessions}>Refresh</button>
          </div>
          <div className="branchList">
            {sessions.map((session) => (
              <article className="branchRow" key={session.id}>
                <div>
                  <strong>{session.current ? 'This device' : 'Other device'}</strong>
                  <small>{session.userAgent || 'Unknown browser'}</small>
                  <small>{session.ipAddress || 'Unknown IP'} · expires {new Date(session.expiresAt).toLocaleString()}</small>
                </div>
                <span className="okBadge">Active</span>
                <button className="secondaryBtn" type="button" onClick={() => revokeDeviceSession(session)}>Sign out</button>
              </article>
            ))}
            {sessions.length === 0 && <p>No active sessions found.</p>}
          </div>
          </div>
        </div>
      )}
    </section>
  );
}
