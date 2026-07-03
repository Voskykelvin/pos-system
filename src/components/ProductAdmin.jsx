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

export default function ProductAdmin({ authToken, userId }) {
  const [activeTab, setActiveTab] = useState('products'); // products | suppliers | pos | reorder | csv

  // Products state
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

  // Suppliers & POs state
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [reorderSuggestions, setReorderSuggestions] = useState([]);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', email: '', address: '', contactPerson: '' });
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poItems, setPoItems] = useState([]); // [{ productId, orderedQuantity, unitCostPrice }]
  const [csvText, setCsvText] = useState('');

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

  async function loadProducts() {
    try {
      const data = await api('/api/admin/products?includeInactive=true');
      setProducts(data);
    } catch (err) { setError(err.message); }
  }

  async function loadCategories() {
    try {
      const data = await api('/api/admin/categories');
      setCategories(data);
    } catch { /* ignore */ }
  }

  async function loadSuppliers() {
    try {
      const data = await api('/api/suppliers');
      setSuppliers(data);
    } catch { /* ignore */ }
  }

  async function loadPurchaseOrders() {
    try {
      const data = await api('/api/purchase-orders');
      setPurchaseOrders(data);
    } catch { /* ignore */ }
  }

  async function loadReorderSuggestions() {
    try {
      const data = await api('/api/reports/reorder-suggestions?days=30');
      setReorderSuggestions(data.suggestions || []);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [authToken]);

  useEffect(() => {
    if (activeTab === 'suppliers') loadSuppliers();
    if (activeTab === 'pos') { loadSuppliers(); loadPurchaseOrders(); }
    if (activeTab === 'reorder') loadReorderSuggestions();
  }, [activeTab]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchesLow = !lowStockOnly || Number(p.stockQuantity) <= Number(p.reorderLevel);
      return matchesSearch && matchesLow;
    });
  }, [products, search, lowStockOnly]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id || '' });
    setError(null);
    setMessage(null);
    setDrawerOpen(true);
  }

  function openEdit(p) {
    setEditingId(p.id);
    setForm({
      sku: p.sku,
      barcode: p.barcode || '',
      name: p.name,
      unit: p.unit || 'each',
      isWeighted: p.isWeighted || false,
      costPrice: p.costPrice || '',
      sellingPrice: p.sellingPrice || '',
      reorderLevel: p.reorderLevel || 5,
      stockQuantity: p.stockQuantity || 0,
      categoryId: p.categoryId
    });
    setError(null);
    setMessage(null);
    setDrawerOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = {
        ...form,
        costPrice: Number(form.costPrice || 0),
        sellingPrice: Number(form.sellingPrice),
        reorderLevel: Number(form.reorderLevel),
        stockQuantity: Number(form.stockQuantity)
      };

      if (editingId) {
        await api(`/api/admin/products/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        setMessage('Product updated successfully.');
      } else {
        await api('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        setMessage('Product created successfully.');
      }

      await loadProducts();
      setDrawerOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdjustStock(e) {
    e.preventDefault();
    if (!editingId || !adjustQty) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/admin/products/${editingId}/adjust-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: adjustType,
          quantity: Number(adjustQty),
          note: adjustNote,
          userId
        })
      });
      setMessage('Stock adjusted successfully.');
      setAdjustQty('');
      setAdjustNote('');
      await loadProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateSupplier(e) {
    e.preventDefault();
    try {
      await api('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierForm)
      });
      setSupplierForm({ name: '', phone: '', email: '', address: '', contactPerson: '' });
      await loadSuppliers();
      alert('Supplier created');
    } catch (err) { alert(err.message); }
  }

  async function handleCreatePo(e) {
    e.preventDefault();
    if (!poSupplierId || poItems.length === 0) return alert('Select supplier and add at least 1 item');
    try {
      await api('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId: poSupplierId, items: poItems })
      });
      setPoItems([]);
      await loadPurchaseOrders();
      alert('Purchase Order created');
    } catch (err) { alert(err.message); }
  }

  async function handleReceivePo(po) {
    const itemsToReceive = po.items.map((i) => ({
      itemId: i.id,
      receivedQuantity: i.orderedQuantity,
      unitCostPrice: i.unitCostPrice
    }));
    try {
      await api(`/api/purchase-orders/${po.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToReceive })
      });
      await loadPurchaseOrders();
      await loadProducts();
      alert('Stock received and inventory updated');
    } catch (err) { alert(err.message); }
  }

  async function handleImportCsv() {
    if (!csvText.trim()) return alert('Paste CSV data first');
    try {
      const data = await api('/api/admin/products/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: csvText })
      });
      alert(data.message);
      setCsvText('');
      await loadProducts();
    } catch (err) { alert(err.message); }
  }

  return (
    <div className={styles.page}>
      {/* Sub-nav tabs for Batch 3 Inventory Depth */}
      <div className={styles.topBar}>
        <div className={styles.tabGroup}>
          <button className={`${styles.tabBtn} ${activeTab === 'products' ? styles.active : ''}`} onClick={() => setActiveTab('products')}>📦 Products</button>
          <button className={`${styles.tabBtn} ${activeTab === 'suppliers' ? styles.active : ''}`} onClick={() => setActiveTab('suppliers')}>🚚 Suppliers</button>
          <button className={`${styles.tabBtn} ${activeTab === 'pos' ? styles.active : ''}`} onClick={() => setActiveTab('pos')}>📑 Purchase Orders</button>
          <button className={`${styles.tabBtn} ${activeTab === 'reorder' ? styles.active : ''}`} onClick={() => setActiveTab('reorder')}>💡 Reorder Suggestions</button>
          <button className={`${styles.tabBtn} ${activeTab === 'csv' ? styles.active : ''}`} onClick={() => setActiveTab('csv')}>📥 CSV Import/Export</button>
        </div>
      </div>

      {message && <div className={styles.successBanner}>{message}</div>}
      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* PRODUCTS TAB */}
      {activeTab === 'products' && (
        <>
          <div className={styles.controls}>
            <input
              type="text"
              placeholder="Search by name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
              />
              Low stock only
            </label>
            <button className={styles.primaryBtn} onClick={openCreate}>+ Add Product</button>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Unit</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isLow = Number(p.stockQuantity) <= Number(p.reorderLevel);
                return (
                  <tr key={p.id} className={isLow ? styles.lowStockRow : ''}>
                    <td><code>{p.sku}</code></td>
                    <td>{p.name}</td>
                    <td>{p.unit}</td>
                    <td>KES {Number(p.costPrice).toFixed(2)}</td>
                    <td>KES {Number(p.sellingPrice).toFixed(2)}</td>
                    <td>
                      <span className={isLow ? styles.badgeLow : styles.badgeOk}>
                        {Number(p.stockQuantity)} {p.unit}
                      </span>
                    </td>
                    <td>{p.isActive ? 'Active' : 'Inactive'}</td>
                    <td>
                      <button className={styles.secondaryBtn} onClick={() => openEdit(p)}>Edit / Stock</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {/* SUPPLIERS TAB */}
      {activeTab === 'suppliers' && (
        <div className={styles.tabContent}>
          <h2>Suppliers Directory</h2>
          <form onSubmit={handleCreateSupplier} className={styles.inlineForm}>
            <input placeholder="Supplier Name *" value={supplierForm.name} onChange={(e) => setSupplierForm({...supplierForm, name: e.target.value})} required />
            <input placeholder="Phone" value={supplierForm.phone} onChange={(e) => setSupplierForm({...supplierForm, phone: e.target.value})} />
            <input placeholder="Email" value={supplierForm.email} onChange={(e) => setSupplierForm({...supplierForm, email: e.target.value})} />
            <input placeholder="Contact Person" value={supplierForm.contactPerson} onChange={(e) => setSupplierForm({...supplierForm, contactPerson: e.target.value})} />
            <button type="submit" className={styles.primaryBtn}>Save Supplier</button>
          </form>

          <table className={styles.table}>
            <thead>
              <tr><th>Name</th><th>Phone</th><th>Email</th><th>Contact Person</th></tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.phone || '—'}</td>
                  <td>{s.email || '—'}</td>
                  <td>{s.contactPerson || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PURCHASE ORDERS TAB */}
      {activeTab === 'pos' && (
        <div className={styles.tabContent}>
          <h2>Create Purchase Order</h2>
          <form onSubmit={handleCreatePo} className={styles.poForm}>
            <select value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)} required>
              <option value="">Select Supplier *</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <div className={styles.addPoItemBox}>
              <h4>Add Line Item</h4>
              <div className={styles.inlineForm}>
                <select id="poProd">
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
                <input id="poQty" type="number" placeholder="Qty" defaultValue="10" />
                <input id="poCost" type="number" placeholder="Unit Cost KES" defaultValue="100" />
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    const prodId = document.getElementById('poProd').value;
                    const qty = Number(document.getElementById('poQty').value);
                    const cost = Number(document.getElementById('poCost').value);
                    const prod = products.find((p) => p.id === prodId);
                    setPoItems([...poItems, { productId: prodId, name: prod.name, orderedQuantity: qty, unitCostPrice: cost }]);
                  }}
                >
                  + Add Item
                </button>
              </div>
            </div>

            {poItems.length > 0 && (
              <ul className={styles.poItemList}>
                {poItems.map((item, idx) => (
                  <li key={idx}>{item.name}: {item.orderedQuantity} units @ KES {item.unitCostPrice}</li>
                ))}
              </ul>
            )}

            <button type="submit" className={styles.primaryBtn}>Submit PO</button>
          </form>

          <h2>Existing Purchase Orders</h2>
          <table className={styles.table}>
            <thead>
              <tr><th>PO Number</th><th>Supplier</th><th>Status</th><th>Total Cost</th><th>Action</th></tr>
            </thead>
            <tbody>
              {purchaseOrders.map((po) => (
                <tr key={po.id}>
                  <td><code>{po.poNumber}</code></td>
                  <td>{po.Supplier?.name}</td>
                  <td><strong>{po.status.toUpperCase()}</strong></td>
                  <td>KES {Number(po.totalCost).toFixed(2)}</td>
                  <td>
                    {po.status !== 'received' && (
                      <button className={styles.primaryBtn} onClick={() => handleReceivePo(po)}>Receive Stock</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* REORDER SUGGESTIONS TAB */}
      {activeTab === 'reorder' && (
        <div className={styles.tabContent}>
          <h2>Intelligent Reorder Suggestions (30-day Velocity)</h2>
          <p className={styles.subtitle}>Recommends stock intake based on daily sales velocity and current stock levels.</p>
          <table className={styles.table}>
            <thead>
              <tr><th>SKU</th><th>Product</th><th>Stock</th><th>Reorder Level</th><th>Daily Velocity</th><th>Suggested Order</th></tr>
            </thead>
            <tbody>
              {reorderSuggestions.map((s) => (
                <tr key={s.productId}>
                  <td><code>{s.sku}</code></td>
                  <td>{s.name}</td>
                  <td>{s.currentStock} {s.unit}</td>
                  <td>{s.reorderLevel}</td>
                  <td>{s.dailyVelocity} / day</td>
                  <td><strong>{s.suggestedReorderQty} {s.unit}</strong></td>
                </tr>
              ))}
              {reorderSuggestions.length === 0 && (
                <tr><td colSpan="6">All stock levels are optimal. No reorders needed.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CSV IMPORT/EXPORT TAB */}
      {activeTab === 'csv' && (
        <div className={styles.tabContent}>
          <h2>Bulk CSV Catalog Management</h2>
          <div className={styles.csvBox}>
            <a href="/api/admin/products/export-csv" className={styles.primaryBtn} download>
              📥 Export Product Catalog CSV
            </a>
          </div>

          <div className={styles.csvImportArea}>
            <h3>Import / Update Catalog via CSV</h3>
            <textarea
              className={styles.csvTextarea}
              rows="8"
              placeholder="Paste CSV contents here (Headers: sku, barcode, name, category, unit, costPrice, sellingPrice, reorderLevel, stockQuantity)"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <button className={styles.primaryBtn} onClick={handleImportCsv}>Process CSV Import</button>
          </div>
        </div>
      )}

      {/* Drawer overlay for product edit */}
      {drawerOpen && (
        <div className={styles.drawerOverlay} onClick={() => setDrawerOpen(false)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? 'Edit Product' : 'Add New Product'}</h3>
            <form onSubmit={handleSubmit} className={styles.form}>
              <label>SKU * <input value={form.sku} onChange={(e) => setForm({...form, sku: e.target.value})} required /></label>
              <label>Barcode <input value={form.barcode} onChange={(e) => setForm({...form, barcode: e.target.value})} /></label>
              <label>Name * <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required /></label>
              <label>Category *
                <select value={form.categoryId} onChange={(e) => setForm({...form, categoryId: e.target.value})} required>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label>Unit <input value={form.unit} onChange={(e) => setForm({...form, unit: e.target.value})} /></label>
              <label>Cost Price KES <input type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({...form, costPrice: e.target.value})} /></label>
              <label>Selling Price KES * <input type="number" step="0.01" value={form.sellingPrice} onChange={(e) => setForm({...form, sellingPrice: e.target.value})} required /></label>
              <label>Reorder Level <input type="number" value={form.reorderLevel} onChange={(e) => setForm({...form, reorderLevel: e.target.value})} /></label>

              <div className={styles.drawerActions}>
                <button type="submit" className={styles.primaryBtn} disabled={saving}>Save Product</button>
                <button type="button" className={styles.secondaryBtn} onClick={() => setDrawerOpen(false)}>Cancel</button>
              </div>
            </form>

            {editingId && (
              <div className={styles.adjustSection}>
                <h4>Quick Stock Adjustment</h4>
                <form onSubmit={handleAdjustStock} className={styles.adjustForm}>
                  <select value={adjustType} onChange={(e) => setAdjustType(e.target.value)}>
                    <option value="purchase">Purchase (+ Stock In)</option>
                    <option value="adjustment">Adjustment (Correction)</option>
                    <option value="wastage">Wastage (- Stock Out)</option>
                    <option value="return">Return (+ Stock In)</option>
                  </select>
                  <input type="number" placeholder="Quantity" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} required />
                  <input placeholder="Note" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} />
                  <button type="submit" className={styles.primaryBtn} disabled={saving}>Adjust Stock</button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
