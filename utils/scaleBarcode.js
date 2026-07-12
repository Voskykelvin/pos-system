function parseScaleBarcode(barcode, prefixes = process.env.SCALE_BARCODE_PREFIXES || '20,21,22,23,24,25,26,27,28,29') {
  const value = String(barcode || '').trim();
  if (!/^\d{13}$/.test(value)) return null;
  const checksum = value.slice(0, 12).split('').reduce((sum, digit, index) => (
    sum + Number(digit) * (index % 2 === 0 ? 1 : 3)
  ), 0);
  if ((10 - (checksum % 10)) % 10 !== Number(value[12])) return null;
  const allowed = String(prefixes).split(',').map((item) => item.trim()).filter(Boolean);
  if (!allowed.includes(value.slice(0, 2))) return null;
  const scaleCode = value.slice(2, 7);
  const grams = Number(value.slice(7, 12));
  if (!scaleCode || !Number.isFinite(grams) || grams <= 0) return null;
  return { scaleCode, quantity: grams / 1000, raw: value };
}

module.exports = { parseScaleBarcode };
