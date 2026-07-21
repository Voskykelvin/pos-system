import { daysText, formatDate, formatKes, formatPercent, labelize } from './formatters';

function isUnusedProfile(tenant) {
  return Number(tenant.activity?.attemptedOrders || 0) === 0 &&
    tenant.subscription?.latestPayment?.status !== 'confirmed';
}

export default function TenantTable({ tenants, plans, onToggleStatus, onUpdateTenant, onDeleteTenant }) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <h2>Registered business tenants</h2>
        <span>{tenants.length ? `${tenants.length} stores` : 'No stores yet'}</span>
      </div>
      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Business</th>
              <th>Owner</th>
              <th>Plan</th>
              <th>Activity</th>
              <th>Sales</th>
              <th>Subscription</th>
              <th>Health</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td className="tenantName">
                  <strong>{tenant.name}</strong>
                  <span>{tenant.currency} - joined {new Date(tenant.createdAt).toLocaleDateString()}</span>
                </td>
                <td>{tenant.owner?.email || '-'}</td>
                <td>
                  <select
                    className="planSelect"
                    value={tenant.plan}
                    onChange={(event) => onUpdateTenant(tenant, { plan: event.target.value })}
                  >
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>{plan.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <strong>{tenant.activity.paidOrders > 0 ? tenant.activity.paidOrders : 'No sales yet'}</strong>
                  <span>{tenant.activity.attemptedOrders > 0 ? `${formatPercent(tenant.activity.conversionRate)} conversion` : 'Checkout not used'}</span>
                </td>
                <td>{tenant.activity.sales > 0 ? formatKes(tenant.activity.sales) : 'No POS sales'}</td>
                <td>
                  <strong>{formatDate(tenant.subscription.endsAt)}</strong>
                  <span>{daysText(tenant.subscription.daysRemaining)}</span>
                  {tenant.subscription.pendingPayment && <small className="upgradeHint">Payment review</small>}
                </td>
                <td>
                  <span className={`${"healthBadge"} ${styles[tenant.activity.health]}`}>
                    {labelize(tenant.activity.health)}
                  </span>
                  {tenant.activity.upgradeSignal && <small className="upgradeHint">Upgrade lead</small>}
                </td>
                <td>
                  <span className={`${"statusBadge"} ${styles[tenant.status]}`}>{labelize(tenant.status)}</span>
                </td>
                <td>
                  <div className="rowActions">
                    <button
                      className={tenant.status === 'active' ? "suspendBtn" : "activateBtn"}
                      onClick={() => onToggleStatus(tenant)}
                      type="button"
                    >
                      {tenant.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                    {isUnusedProfile(tenant) && (
                      <button
                        className="deleteProfileBtn"
                        onClick={() => onDeleteTenant(tenant)}
                        type="button"
                      >
                        Delete profile
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan="9" className="emptyCell">No tenant stores registered yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
