/**
 * KhataLens — Currency Utilities
 * Indian number system formatting (lakhs, crores).
 */

/**
 * Format amount in Indian currency style: ₹1,23,456.00
 */
export function formatCurrency(amount, showDecimal = false) {
  if (amount === null || amount === undefined) return '₹0';

  const num = parseFloat(amount);
  if (isNaN(num)) return '₹0';

  const isNeg = num < 0;
  const abs = Math.abs(num);

  let formatted;

  if (showDecimal) {
    formatted = formatIndianNumber(abs.toFixed(2));
  } else {
    // Show decimal only if there's a fractional part
    if (abs % 1 !== 0) {
      formatted = formatIndianNumber(abs.toFixed(2));
    } else {
      formatted = formatIndianNumber(abs.toString());
    }
  }

  return `${isNeg ? '-' : ''}₹${formatted}`;
}

/**
 * Format number in Indian style: 1,23,456
 */
function formatIndianNumber(numStr) {
  const parts = numStr.split('.');
  let intPart = parts[0];
  const decPart = parts[1];

  // Indian grouping: last 3, then every 2
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    let remaining = intPart.slice(0, -3);

    // Add commas every 2 digits to remaining
    let result = '';
    while (remaining.length > 2) {
      result = ',' + remaining.slice(-2) + result;
      remaining = remaining.slice(0, -2);
    }
    result = remaining + result;
    intPart = result + ',' + last3;
  }

  return decPart ? `${intPart}.${decPart}` : intPart;
}

/**
 * Format amount in compact form: ₹1.2L, ₹50K
 */
export function formatCurrencyCompact(amount) {
  const num = Math.abs(parseFloat(amount) || 0);

  if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
  return `₹${num}`;
}

/**
 * Parse amount from string (handles Indian conventions)
 */
export function parseAmount(str) {
  if (!str) return 0;
  // Remove ₹, Rs, commas, spaces
  const cleaned = str.toString().replace(/[₹,\s]|rs\.?/gi, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
