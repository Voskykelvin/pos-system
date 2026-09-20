export default function PlatformUsersPanel({ users, tenants, form, onChange, onCreate, saving }) {
  const tenantOptions = tenants || [];

  return (
    <section className="panel">
      <div className="panelHeader">
        <h2>Platform users</h2>
        <span>{users.length} accounts</span>
      </div>

      <div className="alertList">
        <form className="form compactForm" onSubmit={onCreate}>
          <div className="inputGrid twoCol">
            <label>
              Full name
              <input
                value={form.name}
                onChange={(event) => onChange((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </label>
            <label>
              Role
              <select value={form.role} onChange={(event) => onChange((prev) => ({ ...prev, role: event.target.value }))}>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="cashier">Cashier</option>
                <option value="super_admin">Platform owner</option>
              </select>
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => onChange((prev) => ({ ...prev, email: event.target.value }))}
              />
            </label>
            <label>
              Phone
              <input
                value={form.phone}
                onChange={(event) => onChange((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </label>
            <label>
              Tenant
              <select value={form.tenantId} onChange={(event) => onChange((prev) => ({ ...prev, tenantId: event.target.value }))}>
                <option value="">No store assignment</option>
                {tenantOptions.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                ))}
              </select>
            </label>
            <label>
              Password
              <input
                type="password"
                value={form.password}
                onChange={(event) => onChange((prev) => ({ ...prev, password: event.target.value }))}
                minLength={8}
                required
              />
            </label>
          </div>
          <div className="rowActions alignStart">
            <button type="submit" className="activateBtn" disabled={saving}>
              {saving ? 'Creating...' : 'Create user'}
            </button>
          </div>
        </form>

        <div className="listStack">
          {users.length === 0 ? (
            <div className="emptyStateCompact">No platform users yet.</div>
          ) : users.slice(0, 6).map((user) => (
            <article key={user.id} className="miniRow">
              <div>
                <strong>{user.name}</strong>
                <span>{user.email || user.phone || 'No contact'} · {user.role}</span>
              </div>
              <small>{user.tenantName || 'No tenant'}</small>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
