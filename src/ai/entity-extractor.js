/**
 * KhataLens — Entity Extraction Engine
 * Local, rule-based NLP for extracting structured data from OCR/ASR text.
 * Supports Hindi, Telugu, and English.
 * No cloud dependency.
 */

// ─── Amount Patterns ────────────────────────────────────────

const AMOUNT_PATTERNS = [
  // ₹500, Rs.500, Rs 500, INR 500
  /(?:₹|rs\.?|rupees?|inr)\s*(\d[\d,]*\.?\d*)/gi,
  // 500 Rs, 500 rupees, 500₹
  /(\d[\d,]*\.?\d*)\s*(?:₹|rs\.?|rupees?|inr)/gi,
  // Standalone numbers with context (must be near transaction words)
  /\b(\d[\d,]*\.?\d*)\b/g,
  // Hindi number words
  /(?:पांच\s*सौ)/gi,         // 500
  /(?:एक\s*हज़ार|हज़ार)/gi,   // 1000
  /(?:दो\s*सौ)/gi,           // 200
  /(?:तीन\s*सौ)/gi,          // 300
  /(?:सौ)/gi,                // 100
];

const HINDI_NUMBER_WORDS = {
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5,
  'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
  'बीस': 20, 'तीस': 30, 'चालीस': 40, 'पचास': 50,
  'साठ': 60, 'सत्तर': 70, 'अस्सी': 80, 'नब्बे': 90,
  'सौ': 100, 'हज़ार': 1000, 'हजार': 1000, 'लाख': 100000,
  'पांच सौ': 500, 'दो सौ': 200, 'तीन सौ': 300, 'एक हज़ार': 1000,
};

// ─── Transaction Type Patterns ──────────────────────────────

const TYPE_PATTERNS = {
  credit: [
    // Hindi
    /उधार|उधारी|खाते?\s*(?:पर|में)|बाकी|जमा\s*(?:नहीं)|कर्ज/gi,
    // English
    /\b(?:credit|udhaar|udhar|loan|lend|gave|given|baaki|baki)\b/gi,
    // Telugu
    /అప్పు|బాకీ|ఇచ్చాను/gi,
  ],
  debit: [
    // Hindi
    /वापसी|भुगतान|पेमेंट|जमा|वापस/gi,
    // English
    /\b(?:debit|payment|paid|received|return|jama|wapas|wapsi)\b/gi,
    // Telugu
    /చెల్లింపు|తిరిగి/gi,
  ],
  sale: [
    /\b(?:sale|sold|becha|बेचा|बिक्री|sell)\b/gi,
  ],
  expense: [
    /\b(?:expense|kharcha|खर्चा|खर्च|bought|purchase)\b/gi,
  ]
};

// ─── Customer Name Extraction ───────────────────────────────

const NAME_PREFIXES = [
  // Hindi patterns
  /(?:(?:को|ka|ke|ki|का|के|की)\s+)?(\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/,
  // "Ramesh ka", "Suresh ko"
  /\b([A-Z][a-z]{2,})\s*(?:ka|ke|ki|ko|का|के|की|को)/gi,
  // "from Ramesh", "to Ramesh"
  /(?:from|to|for|se|ko|ne)\s+([A-Z][a-z]{2,})/gi,
  // Name at start of sentence
  /^([A-Z][a-z]{2,})\b/,
];

const COMMON_NON_NAMES = new Set([
  'the', 'and', 'for', 'from', 'this', 'that', 'with', 'today',
  'yesterday', 'tomorrow', 'monday', 'tuesday', 'wednesday',
  'thursday', 'friday', 'saturday', 'sunday', 'january',
  'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december', 'rupees',
  'credit', 'debit', 'payment', 'udhaar', 'amount', 'total',
  'give', 'gave', 'take', 'took', 'done', 'please', 'unknown',
  'sale', 'sold', 'becha', 'expense', 'kharcha',
]);

// ─── Date Extraction ────────────────────────────────────────

const DATE_PATTERNS = [
  // DD/MM/YYYY or DD-MM-YYYY
  /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
  // "today", "aaj", "आज"
  /\b(?:today|aaj|आज)\b/gi,
  // "yesterday", "kal", "कल"
  /\b(?:yesterday|kal|कल)\b/gi,
];

// ─── Item/Category Extraction ───────────────────────────────

const ITEM_KEYWORDS = [
  'saman', 'samaan', 'सामान', 'goods', 'item', 'product',
  'rice', 'chawal', 'चावल', 'dal', 'दाल', 'sugar', 'cheeni', 'चीनी',
  'oil', 'tel', 'तेल', 'atta', 'आटा', 'flour', 'milk', 'doodh', 'दूध',
  'cement', 'iron', 'paint', 'wood', 'lakdi', 'लकड़ी',
  'cloth', 'kapda', 'कपड़ा', 'material',
];

// ─── Main Extraction Function ───────────────────────────────

export function extractEntities(text) {
  if (!text || text.trim().length === 0) {
    return {
      customer: null,
      amount: null,
      type: null,
      item: null,
      date: null,
      confidence: {
        customer: 'missing',
        amount: 'missing',
        type: 'missing'
      },
      rawText: text
    };
  }

  const result = {
    customer: extractCustomer(text),
    amount: extractAmount(text),
    type: extractType(text),
    item: extractItem(text),
    date: extractDate(text),
    rawText: text,
    confidence: {}
  };

  // Calculate confidence for each field
  result.confidence = {
    customer: result.customer ? 'high' : 'missing',
    amount: result.amount !== null ? 'high' : 'missing',
    type: result.type ? 'high' : 'low',
  };

  // Adjust confidence based on context
  if (result.customer && result.customer.length < 3) {
    result.confidence.customer = 'low';
  }

  if (result.amount !== null && result.amount === 0) {
    result.confidence.amount = 'low';
  }

  // Default type if not detected
  if (!result.type) {
    result.type = 'credit';
    result.confidence.type = 'low';
  }

  // Default date to today
  if (!result.date) {
    result.date = new Date().toISOString().split('T')[0];
  }

  return result;
}

// ─── Individual Extractors ──────────────────────────────────

function extractAmount(text) {
  // Try currency-prefixed amounts first
  const currencyMatch = text.match(/(?:₹|rs\.?|rupees?|inr)\s*(\d[\d,]*\.?\d*)/i);
  if (currencyMatch) {
    return parseFloat(currencyMatch[1].replace(/,/g, ''));
  }

  // Try currency-suffixed amounts
  const suffixMatch = text.match(/(\d[\d,]*\.?\d*)\s*(?:₹|rs\.?|rupees?|inr)/i);
  if (suffixMatch) {
    return parseFloat(suffixMatch[1].replace(/,/g, ''));
  }

  // Try Hindi number words
  for (const [word, value] of Object.entries(HINDI_NUMBER_WORDS)) {
    if (text.includes(word)) {
      return value;
    }
  }

  // Look for standalone numbers (largest number as likely amount)
  const numbers = text.match(/\b(\d[\d,]*\.?\d*)\b/g);
  if (numbers) {
    const parsed = numbers.map(n => parseFloat(n.replace(/,/g, '')))
      .filter(n => n > 0 && n < 10000000); // Reasonable range
    if (parsed.length > 0) {
      return Math.max(...parsed);
    }
  }

  return null;
}

function extractCustomer(text) {
  const cleanText = text.trim();

  // Pattern: "Ramesh ka 500 udhaar" or "Ramesh ko 200 diye"
  const hindiPattern = cleanText.match(/\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)?)\s*(?:ka|ke|ki|ko|ne|se|का|के|की|को|ने|से)/i);
  if (hindiPattern && !COMMON_NON_NAMES.has(hindiPattern[1].toLowerCase())) {
    return capitalize(hindiPattern[1]);
  }

  // Pattern: "500 udhaar Ramesh" or "credit to Ramesh"
  const toPattern = cleanText.match(/(?:to|from|for|se|ko)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)?)/i);
  if (toPattern && !COMMON_NON_NAMES.has(toPattern[1].toLowerCase())) {
    return capitalize(toPattern[1]);
  }

  // Try to find a capitalized word that looks like a name
  const words = cleanText.split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[^a-zA-Z]/g, '');
    if (clean.length >= 3 &&
        clean[0] === clean[0].toUpperCase() &&
        !COMMON_NON_NAMES.has(clean.toLowerCase())) {
      return capitalize(clean);
    }
  }

  // Fallback: look for any 3+ letter word not in non-names
  for (const word of words) {
    const clean = word.replace(/[^a-zA-Z\u0900-\u097F\u0C00-\u0C7F]/g, '');
    if (clean.length >= 3 && !COMMON_NON_NAMES.has(clean.toLowerCase())) {
      // Check if it's a Hindi/Telugu word that could be a name
      if (/[\u0900-\u097F\u0C00-\u0C7F]/.test(clean)) {
        return clean;
      }
      return capitalize(clean);
    }
  }

  return null;
}

function extractType(text) {
  const lower = text.toLowerCase();

  for (const [type, patterns] of Object.entries(TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(lower)) {
        return type;
      }
    }
  }

  return null;
}

function extractItem(text) {
  const lower = text.toLowerCase();
  const found = ITEM_KEYWORDS.find(keyword => lower.includes(keyword.toLowerCase()));
  return found || '';
}

function extractDate(text) {
  // Check for relative dates
  if (/\b(?:today|aaj|आज)\b/i.test(text)) {
    return new Date().toISOString().split('T')[0];
  }

  if (/\b(?:yesterday|kal|कल)\b/i.test(text)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }

  // Check for explicit dates
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dateMatch) {
    let [, day, month, year] = dateMatch;
    if (year.length === 2) year = '20' + year;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null; // Will default to today
}

// ─── Helpers ────────────────────────────────────────────────

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Get overall confidence level for an extraction result
 */
export function getOverallConfidence(extraction) {
  const { confidence } = extraction;

  if (confidence.amount === 'missing' || confidence.customer === 'missing') {
    return 'missing';
  }

  if (confidence.amount === 'low' || confidence.customer === 'low') {
    return 'low';
  }

  return 'high';
}

/**
 * Get user-friendly message based on extraction confidence
 */
export function getConfidenceMessage(extraction) {
  const overall = getOverallConfidence(extraction);

  switch (overall) {
    case 'high':
      return { type: 'confirm', message: 'Please verify this entry' };
    case 'low':
      return { type: 'uncertain', message: 'Did you mean...?' };
    case 'missing':
      if (extraction.confidence.amount === 'missing' && extraction.confidence.customer === 'missing') {
        return { type: 'error', message: "I couldn't identify the customer or amount — please enter them." };
      }
      if (extraction.confidence.amount === 'missing') {
        return { type: 'error', message: "I couldn't identify the amount — please enter it." };
      }
      if (extraction.confidence.customer === 'missing') {
        return { type: 'error', message: "I couldn't identify the customer — please enter the name." };
      }
      return { type: 'error', message: 'Some fields are missing — please complete the entry.' };
    default:
      return { type: 'confirm', message: 'Please verify this entry' };
  }
}
