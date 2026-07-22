'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { TAX_CATEGORY_OPTIONS, normalizeTaxCategory, taxLabel } from '../utils/taxCategories';

const EMPTY_FORM = {
  sku: '',
  barcode: '',
  scaleCode: '',
  name: '',
  unit: 'each',
  isWeighted: false,
  tracksLots: false,
  costPrice: '',
  sellingPrice: '',
  taxCategory: 'standard',
  reorderLevel: 5,
  stockQuantity: 0,
  categoryId: '',
  imageUrl: ''
};

const PRODUCT_TABS = [
  { id: 'products', label: 'Products' },
  { id: 'suppliers', label: 'Suppliers', feature: 'purchasing' },
  { id: 'pos', label: 'Purchase Orders', feature: 'purchasing' },
  { id: 'reorder', label: 'Reorder Suggestions', feature: 'reorder_suggestions' },
  { id: 'promotions', label: 'Promotions', feature: 'promotions' },
  { id: 'vat', label: 'VAT Audit' },
  { id: 'csv', label: 'CSV Import/Export' }
];

function labelCode(product) {
  return String(product.barcode || product.sku || '').trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createBarcodeSvg(value) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, value, {
    format: 'CODE128',
    displayValue: false,
    margin: 0,
    width: 1.45,
    height: 46
  });
  return svg.outerHTML;
}

function BarcodePreview({ value }) {
  const svgRef = useRef(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        width: 1.35,
        height: 42
      });
      setInvalid(false);
    } catch {
      setInvalid(true);
    }
  }, [value]);

  if (invalid) {
    return <div className="barcodeError">Invalid code</div>;
  }

  return <svg ref={svgRef} className="barcodeSvg" aria-label={`Barcode ${value}`} />;
}

export default function ProductAdmin({ authToken, userId, tenant }) {
  const [activeTab, setActiveTab] = useState('products'); // products | suppliers | pos | reorder | promotions | csv

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
  const [scanCode, setScanCode] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('idle');
  const [cameraError, setCameraError] = useState(null);
  const productNameRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const cameraControlsRef = useRef(null);
  const cameraResultHandledRef = useRef(false);

  useEffect(() => {
    if (!cameraOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setCameraOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cameraOpen]);

  // Category inline modal
  const [newCatName, setNewCatName] = useState('');
  const [newCatTaxCategory, setNewCatTaxCategory] = useState('standard');
  const [showCatModal, setShowCatModal] = useState(false);

  // Barcode sticker printing modal
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeScope, setBarcodeScope] = useState('all');
  const [barcodeCopies, setBarcodeCopies] = useState(1);

  // Suppliers & POs state
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [reorderSuggestions, setReorderSuggestions] = useState([]);
  const [vatAudit, setVatAudit] = useState(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', email: '', address: '', contactPerson: '' });
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poItems, setPoItems] = useState([]); // [{ productId, orderedQuantity, unitCostPrice }]
  const [csvText, setCsvText] = useState('');

  // Promotions state
  const [promotions, setPromotions] = useState([]);
  const [promoForm, setPromoForm] = useState({ code: '', type: 'percent', value: '', minOrderTotal: 0, maxUses: 0, description: '' });
  const enabledFeatures = tenant?.enabledFeatures || [];
  const canUseFeature = (feature) => !feature || !tenant || enabledFeatures.includes(feature);
  const visibleTabs = PRODUCT_TABS.filter((tab) => canUseFeature(tab.feature));

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

  async function loadVatAudit() {
    try {
      const data = await api('/api/reports/vat-products');
      setVatAudit(data);
    } catch (err) { setError(err.message); }
  }

  async function loadPromotions() {
    try {
      const data = await api('/api/admin/promotions');
      setPromotions(data);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [authToken]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab('products');
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    if (activeTab === 'suppliers') loadSuppliers();
    if (activeTab === 'pos') { loadSuppliers(); loadPurchaseOrders(); }
    if (activeTab === 'reorder') loadReorderSuggestions();
    if (activeTab === 'promotions') loadPromotions();
    if (activeTab === 'vat') loadVatAudit();
  }, [activeTab]);

  useEffect(() => {
    if (!cameraOpen) return undefined;
    let cancelled = false;
    cameraResultHandledRef.current = false;

    async function beginCameraScan() {
      setCameraStatus('starting');
      setCameraError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is not supported by this browser.');
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (cancelled || !cameraVideoRef.current) return;
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        }, cameraVideoRef.current, (result, _scanError, activeControls) => {
          if (!result || cameraResultHandledRef.current) return;
          const value = String(result.getText?.() || result.text || '').trim();
          if (!value) return;
          cameraResultHandledRef.current = true;
          activeControls.stop();
          setCameraOpen(false);
          setScanCode(value);
          lookupScannedProduct(value);
        });
        if (cancelled) {
          controls.stop();
          return;
        }
        cameraControlsRef.current = controls;
        setCameraStatus('scanning');
      } catch (err) {
        if (cancelled) return;
        const denied = err?.name === 'NotAllowedError' || /permission|denied/i.test(err?.message || '');
        setCameraError(denied
          ? 'Camera permission was denied. Allow camera access in the browser, or use the scanner input instead.'
          : err.message || 'The camera could not start.');
        setCameraStatus('error');
      }
    }

    beginCameraScan();
    return () => {
      cancelled = true;
      cameraControlsRef.current?.stop?.();
      cameraControlsRef.current = null;
      const stream = cameraVideoRef.current?.srcObject;
      stream?.getTracks?.().forEach((track) => track.stop());
    };
  }, [cameraOpen]);

  useEffect(() => {
    if (!cameraOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setCameraOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [cameraOpen]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const needle = search.toLowerCase();
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(needle) ||
        p.sku.toLowerCase().includes(needle) ||
        (p.barcode || '').toLowerCase().includes(needle);
      const matchesLow = !lowStockOnly || Number(p.stockQuantity) <= Number(p.reorderLevel);
      return matchesSearch && matchesLow;
    });
  }, [products, search, lowStockOnly]);

  const barcodeProducts = useMemo(() => {
    const source = barcodeScope === 'filtered' ? filtered : products;
    return source.filter((product) => product.isActive && labelCode(product));
  }, [barcodeScope, filtered, products]);

  const printableLabels = useMemo(() => {
    const copies = Math.min(Math.max(Number(barcodeCopies || 1), 1), 50);
    return barcodeProducts.flatMap((product) => (
      Array.from({ length: copies }, (_, index) => ({
        key: `${product.id}-${index}`,
        product,
        code: labelCode(product)
      }))
    ));
  }, [barcodeCopies, barcodeProducts]);

  function openCreate() {
    setEditingId(null);
    const defaultCategory = categories[0];
    setForm({
      ...EMPTY_FORM,
      categoryId: defaultCategory?.id || '',
      taxCategory: normalizeTaxCategory(defaultCategory?.taxCategory)
    });
    setError(null);
    setMessage(null);
    setDrawerOpen(true);
  }

  async function lookupScannedProduct(rawBarcode) {
    const barcode = String(rawBarcode || '').trim();
    if (!barcode) return;
    setScanBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api('/api/admin/products/scan-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode })
      });
      if (result.existing) {
        openEdit(result.product);
        setMessage(`${result.product.name} is already in the catalogue. Its record is open for review.`);
      } else {
        const draft = result.draft;
        setEditingId(null);
        setForm({
          ...EMPTY_FORM,
          ...draft,
          name: draft.name || '',
          imageUrl: draft.imageUrl || '',
          sellingPrice: '',
          costPrice: ''
        });
        setDrawerOpen(true);
        setMessage(result.catalogMatch
          ? `Product details found via ${result.source}. Confirm prices and save.`
          : 'Barcode is new. A unique SKU was generated; complete the product name and prices.');
      }
      setScanCode('');
    } catch (err) {
      setError(err.message);
    } finally {
      setScanBusy(false);
    }
  }

  async function handleProductScan(event) {
    event.preventDefault();
    await lookupScannedProduct(scanCode);
  }

  function openCameraScanner() {
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      setError('Phone camera scanning requires HTTPS. Use the hardware scanner field on non-secure connections.');
      return;
    }
    setCameraOpen(true);
  }

  function openEdit(p) {
    setEditingId(p.id);
    setForm({
      sku: p.sku,
      barcode: p.barcode || '',
      scaleCode: p.scaleCode || '',
      name: p.name,
      unit: p.unit || 'each',
      isWeighted: p.isWeighted || false,
      tracksLots: p.tracksLots || false,
      costPrice: p.costPrice || '',
      sellingPrice: p.sellingPrice || '',
      taxCategory: normalizeTaxCategory(p.taxCategory || p.Category?.taxCategory),
      reorderLevel: p.reorderLevel || 5,
      stockQuantity: p.stockQuantity || 0,
      categoryId: p.categoryId,
      imageUrl: p.imageUrl || ''
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
        sku: form.sku.trim(),
        barcode: form.barcode.trim() || null,
        scaleCode: form.scaleCode.trim() || null,
        name: form.name.trim(),
        unit: form.unit.trim() || 'each',
        imageUrl: form.imageUrl.trim() || null,
        costPrice: Number(form.costPrice || 0),
        sellingPrice: Number(form.sellingPrice),
        taxCategory: normalizeTaxCategory(form.taxCategory),
        reorderLevel: Number(form.reorderLevel),
        stockQuantity: Number(form.stockQuantity),
        tracksLots: Boolean(form.tracksLots)
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

  async function handleCreateCategory(e) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setError(null);
    setMessage(null);
    try {
      const newCat = await api('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCatName.trim(),
          taxCategory: normalizeTaxCategory(newCatTaxCategory)
        })
      });
      await loadCategories();
      setForm((f) => ({
        ...f,
        categoryId: newCat.id,
        taxCategory: normalizeTaxCategory(newCat.taxCategory)
      }));
      setNewCatName('');
      setNewCatTaxCategory('standard');
      setShowCatModal(false);
      setMessage(`Category "${newCat.name}" created.`);
    } catch (err) { setError(err.message); }
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
    setError(null);
    setMessage(null);
    try {
      await api('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierForm)
      });
      setSupplierForm({ name: '', phone: '', email: '', address: '', contactPerson: '' });
      await loadSuppliers();
      setMessage('Supplier created successfully.');
    } catch (err) { setError(err.message); }
  }

  async function handleCreatePo(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!poSupplierId || poItems.length === 0) {
      setError('Select a supplier and add at least one item before creating a purchase order.');
      return;
    }
    try {
      await api('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId: poSupplierId, items: poItems })
      });
      setPoItems([]);
      await loadPurchaseOrders();
      setMessage('Purchase order created successfully.');
    } catch (err) { setError(err.message); }
  }

  async function handleReceivePo(po) {
    setError(null);
    setMessage(null);
    const itemsToReceive = [];
    for (const item of po.items) {
      const line = {
        itemId: item.id,
        receivedQuantity: item.orderedQuantity,
        unitCostPrice: item.unitCostPrice
      };
      if (item.Product?.tracksLots) {
        const lotNumber = window.prompt(`Lot / batch number for ${item.Product.name}:`);
        if (!lotNumber) return;
        const expiryDate = window.prompt(`Expiry date for ${item.Product.name} (YYYY-MM-DD, blank if none):`) || '';
        Object.assign(line, { lotNumber, expiryDate: expiryDate || undefined });
      }
      itemsToReceive.push(line);
    }
    try {
      await api(`/api/purchase-orders/${po.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToReceive })
      });
      await loadPurchaseOrders();
      await loadProducts();
      setMessage('Stock received and inventory updated.');
    } catch (err) { setError(err.message); }
  }

  function generatePoFromReorder() {
    setError(null);
    setMessage(null);
    if (reorderSuggestions.length === 0) {
      setError('No reorder suggestions are available right now.');
      return;
    }
    const items = reorderSuggestions.map((s) => ({
      productId: s.productId,
      name: s.name,
      orderedQuantity: s.suggestedReorderQty,
      unitCostPrice: s.costPrice || 100
    }));
    setPoItems(items);
    setActiveTab('pos');
    setMessage('Reorder suggestions loaded into the purchase order draft.');
  }

  async function handleCreatePromo(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await api('/api/admin/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...promoForm,
          value: Number(promoForm.value),
          minOrderTotal: Number(promoForm.minOrderTotal || 0),
          maxUses: Number(promoForm.maxUses || 0)
        })
      });
      setPromoForm({ code: '', type: 'percent', value: '', minOrderTotal: 0, maxUses: 0, description: '' });
      await loadPromotions();
      setMessage('Promotion code created successfully.');
    } catch (err) { setError(err.message); }
  }

  async function togglePromoStatus(promo) {
    setError(null);
    setMessage(null);
    try {
      await api(`/api/admin/promotions/${promo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !promo.isActive })
      });
      await loadPromotions();
      setMessage(`Promotion ${promo.code} is now ${!promo.isActive ? 'active' : 'inactive'}.`);
    } catch (err) { setError(err.message); }
  }

  async function handleImportCsv() {
    setError(null);
    setMessage(null);
    if (!csvText.trim()) {
      setError('Paste CSV data first before importing products.');
      return;
    }
    try {
      const data = await api('/api/admin/products/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: csvText })
      });
      setMessage(data.message || 'CSV import completed.');
      setCsvText('');
      await loadProducts();
    } catch (err) { setError(err.message); }
  }

  function printBarcodeLabels() {
    if (printableLabels.length === 0) {
      setError('Add at least one active product before printing barcode labels.');
      return;
    }

    let labelHtml = '';
    try {
      labelHtml = printableLabels.map(({ product, code }) => `
        <article class="label">
          <div class="name">${escapeHtml(product.name)}</div>
          <div class="barcode">${createBarcodeSvg(code)}</div>
          <div class="code">${escapeHtml(code)}</div>
          <div class="price">KES ${Number(product.sellingPrice).toFixed(2)}</div>
        </article>
      `).join('');
    } catch (err) {
      setError(`Could not generate barcode labels: ${err.message}`);
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      setError('Allow pop-ups for this site, then try printing labels again.');
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Barcode labels</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 10mm;
              font-family: Arial, sans-serif;
              color: #111827;
              background: #ffffff;
            }
            .sheet {
              display: grid;
              grid-template-columns: repeat(3, 64mm);
              gap: 3mm;
              align-items: start;
            }
            .label {
              width: 64mm;
              min-height: 32mm;
              padding: 3mm;
              border: 1px solid #d1d5db;
              break-inside: avoid;
              page-break-inside: avoid;
              display: grid;
              gap: 1.4mm;
              align-content: start;
            }
            .name {
              font-size: 10px;
              font-weight: 700;
              line-height: 1.2;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .barcode svg {
              width: 100%;
              height: 13mm;
              display: block;
            }
            .code {
              font-family: "Courier New", monospace;
              font-size: 9px;
              text-align: center;
              letter-spacing: 0;
            }
            .price {
              font-size: 11px;
              font-weight: 800;
              text-align: center;
            }
            @media print {
              body { padding: 0; }
              .sheet { gap: 2mm; }
              .label { border-color: #e5e7eb; }
            }
          </style>
        </head>
        <body>
          <main class="sheet">${labelHtml}</main>
          <script>
            window.addEventListener('load', () => {
              window.print();
              window.setTimeout(() => window.close(), 300);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <div className="product-admin-page page-container">
      {/* Sub-nav tabs */}
      <div className="topBar">
        <div className="tabGroup" role="tablist" aria-label="Inventory sections">
          {visibleTabs.map((tab) => (
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
      </div>

      {message && <div className="successBanner" role="status">{message}</div>}
      {error && <div className="errorBanner" role="alert">{error}</div>}

      {/* PRODUCTS TAB */}
      {activeTab === 'products' && (
        <>
          <form className="scanPanel" onSubmit={handleProductScan}>
            <div>
              <strong>Scan to add a product</strong>
              <span>Use a USB/Bluetooth scanner, phone camera, or type the barcode.</span>
            </div>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              aria-label="Product barcode to scan"
              placeholder="Scan barcode here"
              value={scanCode}
              onChange={(event) => setScanCode(event.target.value.replace(/\s/g, '').slice(0, 64))}
            />
            <button className="cameraBtn" type="button" onClick={openCameraScanner} disabled={scanBusy}>Use camera</button>
            <button className="primaryBtn" type="submit" disabled={scanBusy || !scanCode.trim()}>
              {scanBusy ? 'Looking up...' : 'Find product'}
            </button>
          </form>
          <div className="controls">
            <input
              type="text"
              placeholder="Search by name, SKU, or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="searchInput"
            />
            <label className="checkboxLabel">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
              />
              Low stock only
            </label>
            <button className="secondaryBtn" onClick={() => setShowBarcodeModal(true)}>Print Barcode Stickers</button>
            <button className="primaryBtn" onClick={openCreate}>+ Add Product</button>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Barcode</th>
                <th>Name</th>
                <th>Unit</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>Tax</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isLow = Number(p.stockQuantity) <= Number(p.reorderLevel);
                return (
                  <tr key={p.id} className={isLow ? "lowStockRow" : ''}>
                    <td><code>{p.sku}</code></td>
                    <td><code>{p.barcode || '-'}</code></td>
                    <td>{p.name}</td>
                    <td>{p.unit}</td>
                    <td>KES {Number(p.costPrice).toFixed(2)}</td>
                    <td>KES {Number(p.sellingPrice).toFixed(2)}</td>
                    <td>{taxLabel(p.taxCategory || p.Category?.taxCategory)}</td>
                    <td>
                      <span className={isLow ? "badgeLow" : "badgeOk"}>
                        {Number(p.stockQuantity)} {p.unit}
                      </span>
                    </td>
                    <td>{p.isActive ? 'Active' : 'Inactive'}</td>
                    <td>
                      <button className="secondaryBtn" onClick={() => openEdit(p)}>Edit / Stock</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {/* SUPPLIERS TAB */}
      {activeTab === 'suppliers' && canUseFeature('purchasing') && (
        <div className="tabContent">
          <h2>Suppliers Directory</h2>
          <form onSubmit={handleCreateSupplier} className="inlineForm">
            <input placeholder="Supplier Name *" value={supplierForm.name} onChange={(e) => setSupplierForm({...supplierForm, name: e.target.value})} required />
            <input placeholder="Phone" value={supplierForm.phone} onChange={(e) => setSupplierForm({...supplierForm, phone: e.target.value})} />
            <input placeholder="Email" value={supplierForm.email} onChange={(e) => setSupplierForm({...supplierForm, email: e.target.value})} />
            <input placeholder="Contact Person" value={supplierForm.contactPerson} onChange={(e) => setSupplierForm({...supplierForm, contactPerson: e.target.value})} />
            <button type="submit" className="primaryBtn">Save Supplier</button>
          </form>

          <table className="table">
            <thead>
              <tr><th>Name</th><th>Phone</th><th>Email</th><th>Contact Person</th></tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.phone || '-'}</td>
                  <td>{s.email || '-'}</td>
                  <td>{s.contactPerson || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PURCHASE ORDERS TAB */}
      {activeTab === 'pos' && canUseFeature('purchasing') && (
        <div className="tabContent">
          <h2>Create Purchase Order</h2>
          <form onSubmit={handleCreatePo} className="poForm">
            <select value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)} required>
              <option value="">Select Supplier *</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <div className="addPoItemBox">
              <h4>Add Line Item</h4>
              <div className="inlineForm">
                <select id="poProd">
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
                <input id="poQty" type="number" placeholder="Qty" defaultValue="10" />
                <input id="poCost" type="number" placeholder="Unit Cost KES" defaultValue="100" />
                <button
                  type="button"
                  className="secondaryBtn"
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
              <ul className="poItemList">
                {poItems.map((item, idx) => (
                  <li key={idx}>{item.name}: {item.orderedQuantity} units @ KES {item.unitCostPrice}</li>
                ))}
              </ul>
            )}

            <button type="submit" className="primaryBtn">Submit PO</button>
          </form>

          <h2>Existing Purchase Orders</h2>
          <table className="table">
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
                      <button className="primaryBtn" onClick={() => handleReceivePo(po)}>Receive Stock</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* REORDER SUGGESTIONS TAB */}
      {activeTab === 'reorder' && canUseFeature('reorder_suggestions') && (
        <div className="tabContent">
          <div className="tabHeaderAction">
            <div>
              <h2>Intelligent Reorder Suggestions (30-day Velocity)</h2>
              <p className="subtitle">Recommends stock intake based on daily sales velocity and current stock levels.</p>
            </div>
            {reorderSuggestions.length > 0 && (
              <button className="primaryBtn" onClick={generatePoFromReorder}>
                Auto-Generate PO with Suggested Items
              </button>
            )}
          </div>
          <table className="table">
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

      {/* PROMOTIONS TAB */}
      {activeTab === 'promotions' && canUseFeature('promotions') && (
        <div className="tabContent">
          <h2>Promotions & Discount Codes</h2>
          <form onSubmit={handleCreatePromo} className="inlineForm">
            <input placeholder="Promo Code (e.g. SAVE10) *" value={promoForm.code} onChange={(e) => setPromoForm({...promoForm, code: e.target.value})} required />
            <select value={promoForm.type} onChange={(e) => setPromoForm({...promoForm, type: e.target.value})}>
              <option value="percent">Percentage (%)</option>
              <option value="fixed">Fixed Amount (KES)</option>
            </select>
            <input type="number" placeholder="Discount Value *" value={promoForm.value} onChange={(e) => setPromoForm({...promoForm, value: e.target.value})} required />
            <input type="number" placeholder="Min Order Total" value={promoForm.minOrderTotal} onChange={(e) => setPromoForm({...promoForm, minOrderTotal: e.target.value})} />
            <input placeholder="Description" value={promoForm.description} onChange={(e) => setPromoForm({...promoForm, description: e.target.value})} />
            <button type="submit" className="primaryBtn">Create Promotion</button>
          </form>

          <table className="table">
            <thead>
              <tr><th>Code</th><th>Type</th><th>Value</th><th>Min Order</th><th>Uses</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {promotions.map((p) => (
                <tr key={p.id}>
                  <td><code>{p.code}</code></td>
                  <td>{p.type}</td>
                  <td>{p.type === 'percent' ? `${p.value}%` : `KES ${p.value}`}</td>
                  <td>KES {p.minOrderTotal}</td>
                  <td>{p.usedCount} {p.maxUses > 0 ? `/ ${p.maxUses}` : ''}</td>
                  <td>
                    <span className={p.isActive ? "badgeOk" : "badgeLow"}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button className="secondaryBtn" onClick={() => togglePromoStatus(p)}>
                      {p.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VAT AUDIT TAB */}
      {activeTab === 'vat' && (
        <div className="tabContent">
          <div className="tabHeaderAction">
            <div>
              <h2>VAT Classification Audit</h2>
              <p className="subtitle">Review active products by VAT treatment before they reach checkout.</p>
            </div>
            <button className="secondaryBtn" type="button" onClick={loadVatAudit}>Refresh Audit</button>
          </div>

          <div className="auditCards">
            {TAX_CATEGORY_OPTIONS.map((option) => {
              const summary = vatAudit?.summary?.[option.value] || { count: 0, stockValue: 0 };
              return (
                <article key={option.value} className="auditCard">
                  <span>{option.label}</span>
                  <strong>{summary.count}</strong>
                  <small>KES {Number(summary.stockValue || 0).toFixed(2)} stock value</small>
                </article>
              );
            })}
            <article className="auditCard">
              <span>Needs review</span>
              <strong>{vatAudit?.reviewCount || 0}</strong>
              <small>Product/category tax mismatch</small>
            </article>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Category</th>
                <th>Product VAT</th>
                <th>Category VAT</th>
                <th>Stock Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(vatAudit?.products || []).map((product) => (
                <tr key={product.id} className={product.needsReview ? "lowStockRow" : ''}>
                  <td><code>{product.sku}</code></td>
                  <td>{product.name}</td>
                  <td>{product.category}</td>
                  <td>{taxLabel(product.productTaxCategory)}</td>
                  <td>{taxLabel(product.categoryTaxCategory || product.taxCategory)}</td>
                  <td>KES {Number(product.stockValue || 0).toFixed(2)}</td>
                  <td>
                    <span className={product.needsReview ? "badgeLow" : "badgeOk"}>
                      {product.needsReview ? 'Review' : 'OK'}
                    </span>
                  </td>
                </tr>
              ))}
              {(!vatAudit || vatAudit.products?.length === 0) && (
                <tr><td colSpan="7">No active products found for VAT audit.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CSV IMPORT/EXPORT TAB */}
      {activeTab === 'csv' && (
        <div className="tabContent">
          <h2>Bulk CSV Catalog Management</h2>
          <div className="csvBox">
            <a href="/api/admin/products/export-csv" className="primaryBtn" download>
              Export Product Catalog CSV
            </a>
          </div>

          <div className="csvImportArea">
            <h3>Import / Update Catalog via CSV</h3>
            <textarea
              className="csvTextarea"
              rows="8"
              placeholder="Paste CSV contents here (Headers: sku, barcode, name, category, taxCategory, unit, costPrice, sellingPrice, reorderLevel, stockQuantity)"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <button className="primaryBtn" onClick={handleImportCsv}>Process CSV Import</button>
          </div>
        </div>
      )}

      {cameraOpen && (
        <div className="cameraOverlay" role="presentation" onClick={() => setCameraOpen(false)}>
          <section className="cameraModal" role="dialog" aria-modal="true" aria-labelledby="camera-title" onClick={(event) => event.stopPropagation()}>
            <div className="cameraHeader">
              <div>
                <h2 id="camera-title">Scan product barcode</h2>
                <p>Hold the rear camera steady over the full barcode.</p>
              </div>
              <button type="button" className="cameraClose" aria-label="Close camera scanner" onClick={() => setCameraOpen(false)}>&times;</button>
            </div>
            <div className="cameraViewport">
              <video ref={cameraVideoRef} autoPlay muted playsInline aria-label="Live camera preview" />
              <div className="scanGuide" aria-hidden="true" />
              {cameraStatus === 'starting' && <div className="cameraState">Starting camera...</div>}
            </div>
            {cameraError && <div className="cameraError" role="alert">{cameraError}</div>}
            <div className="cameraFooter">
              <span>{cameraStatus === 'scanning' ? 'Scanning automatically...' : 'Camera access is used only while this window is open.'}</span>
              <button type="button" className="secondaryBtn" onClick={() => setCameraOpen(false)}>Cancel</button>
            </div>
          </section>
        </div>
      )}

      {/* Drawer overlay for product edit */}
      {drawerOpen && (
        <div className="drawerOverlay" onClick={() => setDrawerOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? 'Edit Product' : 'Add New Product'}</h3>
            <form onSubmit={handleSubmit} className="form">
              <label>SKU * <input value={form.sku} onChange={(e) => setForm({...form, sku: e.target.value})} required /></label>
              <label>Barcode <input
                value={form.barcode}
                inputMode="numeric"
                autoComplete="off"
                onChange={(e) => setForm({...form, barcode: e.target.value.replace(/\s/g, '').slice(0, 100)})}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  productNameRef.current?.focus();
                }}
              /></label>
              <label className="fullWidth">Name * <input ref={productNameRef} value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required /></label>
              <label className="fullWidth">Category *
                <div className="categorySelectRow">
                  <select
                    value={form.categoryId}
                    onChange={(e) => {
                      const category = categories.find((c) => c.id === e.target.value);
                      setForm({
                        ...form,
                        categoryId: e.target.value,
                        taxCategory: editingId
                          ? normalizeTaxCategory(form.taxCategory)
                          : normalizeTaxCategory(category?.taxCategory || form.taxCategory)
                      });
                    }}
                    required
                  >
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button type="button" className="secondaryBtn" onClick={() => setShowCatModal(true)}>+ Category</button>
                </div>
              </label>
              <label>Unit <input value={form.unit} onChange={(e) => setForm({...form, unit: e.target.value})} /></label>
              {form.isWeighted && <label>Scale PLU code <input inputMode="numeric" maxLength="5" value={form.scaleCode} onChange={(e) => setForm({...form, scaleCode: e.target.value.replace(/\D/g, '').slice(0, 5)})} placeholder="00001" /></label>}
              <label className="checkboxLabel">
                <input
                  type="checkbox"
                  checked={form.isWeighted}
                  onChange={(e) => setForm({...form, isWeighted: e.target.checked})}
                />
                Sold by weight
              </label>
              <label className="checkboxLabel">
                <input
                  type="checkbox"
                  checked={form.tracksLots}
                  onChange={(e) => setForm({...form, tracksLots: e.target.checked})}
                />
                Track batch / lot expiry
              </label>
              <label className="fullWidth">Image URL <input value={form.imageUrl} onChange={(e) => setForm({...form, imageUrl: e.target.value})} placeholder="https://example.com/photo.jpg" /></label>
              <label>Cost Price KES <input type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({...form, costPrice: e.target.value})} /></label>
              <label>Selling Price KES * <input type="number" step="0.01" value={form.sellingPrice} onChange={(e) => setForm({...form, sellingPrice: e.target.value})} required /></label>
              <label>Tax Category *
                <select value={form.taxCategory} onChange={(e) => setForm({...form, taxCategory: e.target.value})} required>
                  {TAX_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>Reorder Level <input type="number" value={form.reorderLevel} onChange={(e) => setForm({...form, reorderLevel: e.target.value})} /></label>
              {!editingId && (
                <label>Opening Stock <input type="number" step="0.001" value={form.stockQuantity} onChange={(e) => setForm({...form, stockQuantity: e.target.value})} /></label>
              )}

              <div className="drawerActions">
                <button type="submit" className="primaryBtn" disabled={saving}>Save Product</button>
                <button type="button" className="secondaryBtn" onClick={() => setDrawerOpen(false)}>Cancel</button>
              </div>
            </form>

            {editingId && (
              <div className="adjustSection">
                <h4>Quick Stock Adjustment</h4>
                <form onSubmit={handleAdjustStock} className="adjustForm">
                  <select value={adjustType} onChange={(e) => setAdjustType(e.target.value)}>
                    <option value="purchase">Purchase (+ Stock In)</option>
                    <option value="adjustment">Adjustment (Correction)</option>
                    <option value="wastage">Wastage (- Stock Out)</option>
                    <option value="return">Return (+ Stock In)</option>
                  </select>
                  <input type="number" placeholder="Quantity" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} required />
                  <input placeholder="Note" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} />
                  <button type="submit" className="primaryBtn" disabled={saving}>Adjust Stock</button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inline Category Creation Modal */}
      {showCatModal && (
        <div className="drawerOverlay" onClick={() => setShowCatModal(false)}>
          <div className="catModal" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Product Category</h3>
            <form onSubmit={handleCreateCategory} className="form">
              <input
                placeholder="Category Name (e.g. Dairy, Beverages) *"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                required
                autoFocus
              />
              <select value={newCatTaxCategory} onChange={(e) => setNewCatTaxCategory(e.target.value)} required>
                {TAX_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <div className="drawerActions">
                <button type="submit" className="primaryBtn">Create Category</button>
                <button type="button" className="secondaryBtn" onClick={() => setShowCatModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Sticker Label Sheet Printing Modal */}
      {showBarcodeModal && (
        <div className="drawerOverlay" onClick={() => setShowBarcodeModal(false)}>
          <div className="barcodeModal" onClick={(e) => e.stopPropagation()}>
            <div className="tabHeaderAction">
              <h3>Printable Barcode Sticker Sheets</h3>
              <button className="primaryBtn" onClick={printBarcodeLabels} disabled={printableLabels.length === 0}>
                Print Labels
              </button>
            </div>

            <div className="barcodeControls">
              <label>
                Products
                <select value={barcodeScope} onChange={(e) => setBarcodeScope(e.target.value)}>
                  <option value="all">All active products</option>
                  <option value="filtered">Current filtered list</option>
                </select>
              </label>
              <label>
                Copies per product
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={barcodeCopies}
                  onChange={(e) => setBarcodeCopies(e.target.value)}
                />
              </label>
              <div className="labelCount">{printableLabels.length} labels</div>
            </div>

            <div className="stickerGrid">
              {printableLabels.slice(0, 60).map(({ key, product, code }) => (
                <div key={key} className="stickerCard">
                  <div className="stickerTitle">{product.name}</div>
                  <BarcodePreview value={code} />
                  <div className="barcodeCode">{code}</div>
                  <div className="stickerPrice">KES {Number(product.sellingPrice).toFixed(2)}</div>
                </div>
              ))}
              {printableLabels.length === 0 && (
                <div className="stickerEmpty">No active products are ready for labels.</div>
              )}
              {printableLabels.length > 60 && (
                <div className="stickerEmpty">Preview shows the first 60 labels.</div>
              )}
            </div>

            <div className="drawerActions">
              <button type="button" className="secondaryBtn" onClick={() => setShowBarcodeModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
