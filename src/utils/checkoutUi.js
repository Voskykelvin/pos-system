export function getCheckoutQuickStatus(query, resultCount, cartCount) {
  const safeQuery = String(query || '').trim();
  const safeCartCount = Number(cartCount || 0);
  const safeResultCount = Number(resultCount || 0);

  if (!safeQuery) {
    return 'Ready to scan or search';
  }

  if (safeResultCount === 0) {
    return `No products found · ${safeCartCount} item${safeCartCount === 1 ? '' : 's'} in cart`;
  }

  return `${safeResultCount} product${safeResultCount === 1 ? '' : 's'} found · ${safeCartCount} item${safeCartCount === 1 ? '' : 's'} in cart`;
}
