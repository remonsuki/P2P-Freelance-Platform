/**
 * 將完整錢包地址縮短顯示，例如 0x1234...abcd
 */
export function formatAddress(address) {
  if (!address || address.length < 10) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
