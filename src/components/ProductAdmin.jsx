'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from './ProductAdmin.module.css';

const EMPTY_FORM = {
  sku: '',
  barcode: '',
  name: '',
  unit: 'each',
  isWeighted: false,
  costPrice: '',
  sellingPrice: '',
  reorderLevel: 5,
  stockQuantity: 0,
  categoryId: ''
};

export default function ProductAdmin({ userId }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState('purchase');
  const [adjustNote, setAdjustNote] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  async function loadProducts() {
    const res = await fetch('/api/admin/products?includeInactive=true');
    const data = await res.json();
    setProducts(data);
  }

  async function loadCategories() {
    const res = await fetch('/api/admin/categories');
    const data = await res.json();
    setCategories(data);
  }

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchesLowStock =
        !lowStockOnly || Number(p.stockQuantity) <= Number(p.reorderLevel);
      return matchesSearch && matchesLowStock;
    });
  }, [products, search, lowStockOnly]);

  function openNewProduct() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setAdjustQty('');
    setAdjustNote('');
    setError(null);
    setMessage(null);
    setDrawerOpen(true);
  }

  function openEditProduct(product) {
    setEditingId(product.id);
    setForm({
      sku: product.sku,
      barcode: product.barcode || '',
      name: product.name,
      unit: product.unit,
      isWeighted: product.isWeighted,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      reorderLevel: product.reorderLevel,
      stockQuantity: product.stockQuantity,
      categoryId: product.categoryId,
      isActive: product.isActive
    });
    setAdjustQty('');
    setAdjustNote('');
    setError(null);
    setMessage(null);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      if (editingId) {
        const res = await fetch(`/api/admin/products/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      } else {
        const res = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }

      await loadProducts();
      setMessage('Saved.');
      setTimeout(() => setDrawerOpen(false), 500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!editingId) return;
    if (!confirm('Deactivate this product? It will no longer appear at checkout.')) return;

    try {
      await fetch(`/api/admin/products/${editingId}`, { method: 'DELETE' });
      await loadProducts();
      setDrawerOpen(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAdjustStock() {
    if (!editingId || !adjustQty) return;
    setError(null);

    const signedQty =
      adjustType === 'wastage' ? -Math.abs(Number(adjustQty)) : Number(adjustQty);

    try {
      const res = await fetch(`/api/admin/products/${editingId}/adjust-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: adjustType,
          quantity: signedQty,
          note: adjustNote,
          userId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setForm((f) => ({ ...f, stockQuantity: data.stockQuantity }));
      setAdjustQty('');
      setAdjustNote('');
      await loadProducts();
      setMessage('Stock updated.');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <h1 className={`${styles.heading} ${styles.title}`}>Products & inventory</h1>
        <input
          className={styles.searchInput}
          placeholder="Search by name or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className={`${styles.toggleBtn} ${lowStockOnly ? styles.active : ''}`}
          onClick={() => setLowStockOnly((v) => !v)}
        >
          Low stock only
        </button>
        <button className={styles.primaryBtn} onClick={openNewProduct}>
          + Add product
        </button>
      </div>

      <div className={styles.tableWrap}>
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>No products match.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isLow = Number(p.stockQuantity) <= Number(p.reorderLevel);
                return (
                  <tr
                    key={p.id}
                    className={styles.row}
                    onClick={() => openEditProduct(p)}
                  >
                    <td className={styles.name}>
                      {p.name}
                      {isLow && <span className={styles.lowStockBadge}>Low stock</span>}
                      {!p.isActive && <span className={styles.inactiveBadge}>Inactive</span>}
                    </td>
                    <td>{p.sku}</td>
                    <td>{p.Category?.name || '-'}</td>
                    <td>KES {Number(p.sellingPrice).toFixed(2)}</td>
                    <td>
                      {Number(p.stockQuantity)} {p.unit}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {drawerOpen && (
        <div className={styles.overlay} onClick={closeDrawer}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <h2 className={`${styles.heading} ${styles.drawerTitle}`}>
              {editingId ? 'Edit product' : 'New product'}
            </h2>

            <div className={styles.field}>
              <label className={styles.label}>Product name</label>
              <input
                className={styles.input}
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
              />
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>SKU</label>
                <input
                  className={styles.input}
                  value={form.sku}
                  onChange={(e) => updateField('sku', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Barcode</label>
                <input
                  className={styles.input}
                  value={form.barcode}
                  onChange={(e) => updateField('barcode', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Category</label>
              <select
                className={styles.select}
                value={form.categoryId}
                onChange={(e) => updateField('categoryId', e.target.value)}
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.taxCategory})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Cost price (KES)</label>
                <input
                  className={styles.input}
                  type="number"
                  value={form.costPrice}
                  onChange={(e) => updateField('costPrice', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Selling price (KES)</label>
                <input
                  className={styles.input}
                  type="number"
                  value={form.sellingPrice}
                  onChange={(e) => updateField('sellingPrice', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Unit</label>
                <select
                  className={styles.select}
                  value={form.unit}
                  onChange={(e) => updateField('unit', e.target.value)}
                >
                  <option value="each">each</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="litre">litre</option>
                  <option value="pack">pack</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Reorder level</label>
                <input
                  className={styles.input}
                  type="number"
                  value={form.reorderLevel}
                  onChange={(e) => updateField('reorderLevel', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.checkboxField}>
              <input
                type="checkbox"
                id="isWeighted"
                checked={form.isWeighted}
                onChange={(e) => updateField('isWeighted', e.target.checked)}
              />
              <label htmlFor="isWeighted">Sold by weight (scale item)</label>
            </div>

            {!editingId && (
              <div className={styles.field}>
                <label className={styles.label}>Opening stock</label>
                <input
                  className={styles.input}
                  type="number"
                  value={form.stockQuantity}
                  onChange={(e) => updateField('stockQuantity', e.target.value)}
                />
              </div>
            )}

            {editingId && (
              <>
                <hr className={styles.divider} />
                <label className={styles.label}>Current stock</label>
                <div className={styles.stockDisplay}>
                  {Number(form.stockQuantity)}
                  <span className={styles.stockUnit}>{form.unit}</span>
                </div>

                <div className={styles.adjustRow}>
                  <select
                    className={styles.select}
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value)}
                  >
                    <option value="purchase">Stock delivery (+)</option>
                    <option value="adjustment">Manual correction</option>
                    <option value="wastage">Wastage / spoilage (-)</option>
                  </select>
                  <input
                    className={styles.input}
                    type="number"
                    placeholder="Qty"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    style={{ maxWidth: 100 }}
                  />
                </div>
                <input
                  className={styles.input}
                  placeholder="Note (optional)"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  style={{ marginBottom: 10 }}
                />
                <button
                  className={styles.secondaryBtn}
                  style={{ width: '100%' }}
                  onClick={handleAdjustStock}
                  disabled={!adjustQty}
                >
                  Apply stock adjustment
                </button>
              </>
            )}

            {error && <p className={styles.errorText}>{error}</p>}
            {message && <p className={styles.successText}>{message}</p>}

            <div className={styles.drawerActions}>
              <button className={styles.secondaryBtn} onClick={closeDrawer}>
                Cancel
              </button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save product'}
              </button>
            </div>

            {editingId && (
              <button className={styles.dangerBtn} onClick={handleDeactivate}>
                Deactivate product
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
