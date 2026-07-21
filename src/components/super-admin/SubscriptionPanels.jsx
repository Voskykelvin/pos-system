import { formatDate, formatKes, labelize } from './formatters';

export default function SubscriptionPanels({ alerts, pendingReview, onReviewPayment }) {
  return (
    <div className="opsGrid">
      <section className="panel">
        <div className="panelHeader">
          <h2>Subscription alerts</h2>
          <span>{alerts.length ? `${alerts.length} alerts` : 'Clear'}</span>
        </div>
        <div className="alertList">
          {alerts.slice(0, 8).map((alert) => (
            <article className={`alertRow ${alert.severity}`} key={`${alert.type}-${alert.tenantId}-${alert.paymentId || alert.createdAt}`}>
              <div>
                <strong>{alert.tenantName}</strong>
                <span>{alert.message}</span>
              </div>
              <small>{labelize(alert.type)}</small>
            </article>
          ))}
          {alerts.length === 0 && (
            <div className="emptyStateCompact">No subscription alerts right now.</div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2>Payment references</h2>
          <span>{pendingReview.length ? `${pendingReview.length} pending` : 'Nothing to verify'}</span>
        </div>
        {pendingReview.length > 0 ? (
          <div className="tableWrap">
            <table className={`${"table"} ${"compactTable"}`}>
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Amount</th>
                  <th>Reference</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingReview.map((payment) => (
                  <tr key={payment.id}>
                    <td className="tenantName">
                      <strong>{payment.tenant?.name || '-'}</strong>
                      <span>{payment.upgrade
                        ? `${labelize(payment.upgrade.fromPlan)} → ${labelize(payment.upgrade.targetPlan)} upgrade`
                        : labelize(payment.plan)}</span>
                    </td>
                    <td>{formatKes(payment.amount)}</td>
                    <td>
                      <strong>{payment.reference}</strong>
                      <span>{payment.payerPhone || labelize(payment.method)}</span>
                    </td>
                    <td>{formatDate(payment.submittedAt)}</td>
                    <td>
                      <div className="rowActions">
                        <button className="activateBtn" type="button" onClick={() => onReviewPayment(payment, 'confirm')}>
                          Confirm
                        </button>
                        <button className="suspendBtn" type="button" onClick={() => onReviewPayment(payment, 'reject')}>
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyStateCompact">No payment references waiting for admin review.</div>
        )}
      </section>
    </div>
  );
}
