/**
 * KhataLens — "Ask my Khata" Query Engine
 * Natural-language queries against local ledger.
 * Supports Hindi, Telugu, and English.
 */
import {
  getTransactions,
  getCustomerByName,
  getCustomerTransactions,
  getTodayTransactions,
  getTopDebtors,
  getTotalOutstanding,
  getDailySummary,
  getCustomers
} from '../db/database.js';
import { formatCurrency } from '../utils/currency.js';

// ─── Query Pattern Definitions ──────────────────────────────

const QUERY_PATTERNS = [
  {
    // "Ramesh ka kitna udhaar hai?" / "How much does Ramesh owe?"
    patterns: [
      /(\w+)\s*(?:ka|ke|ki|का|के|की)\s*(?:kitna|kitne|kitni|कितना|कितने|कितनी)?\s*(?:udhaar|udhar|baaki|baki|उधार|बाकी|loan|credit|owe)/i,
      /(?:how\s*much\s*(?:does|did))\s+(\w+)\s+(?:owe|credit|udhaar)/i,
      /(\w+)\s+(?:owes?|udhaar|baaki|udhar)/i,
    ],
    handler: handleCustomerDebt
  },
  {
    // "Aaj kitna credit diya?" / "Today's credit?"
    patterns: [
      /(?:aaj|आज|today)\s*(?:ka|ke|ki|का|के|की)?\s*(?:kitna|कितना)?\s*(?:credit|udhaar|udhar|उधार)/i,
      /(?:today'?s?)\s*(?:total)?\s*(?:credit|udhaar|lending)/i,
    ],
    handler: handleTodayCredit
  },
  {
    // "Who owes me the most?" / "Sabse zyada kisne liya?"
    patterns: [
      /(?:who\s*owes?\s*(?:me\s*)?(?:the\s*)?most)/i,
      /(?:sabse|सबसे)\s*(?:zyada|ज़्यादा|bada|बड़ा)\s*(?:kis|कि|kaun|कौन)/i,
      /(?:top|biggest|largest)\s*(?:debtor|udhaar|credit)/i,
      /(?:sabse|सबसे)\s*(?:zyada|ज़्यादा)\s*(?:udhaar|udhar|उधार)/i,
    ],
    handler: handleTopDebtor
  },
  {
    // "Total outstanding?" / "Kitna baki hai?"
    patterns: [
      /(?:total|kul|कुल)\s*(?:outstanding|baaki|baki|बाकी|udhaar|उधार)/i,
      /(?:kitna|कितना)\s*(?:baaki|baki|बाकी)\s*(?:hai|है)/i,
      /(?:how\s*much\s*(?:is\s*)?outstanding)/i,
    ],
    handler: handleTotalOutstanding
  },
  {
    // "Aaj ka summary" / "Today's summary"
    patterns: [
      /(?:aaj|आज|today)\s*(?:ka|ke|ki|का|के|की)?\s*(?:summary|report|hisaab|हिसाब)/i,
      /(?:today'?s?)\s*(?:summary|report|total)/i,
      /(?:daily)\s*(?:summary|report)/i,
    ],
    handler: handleDailySummary
  },
  {
    // "Aaj kitne transactions hue?" / "How many transactions today?"
    patterns: [
      /(?:aaj|आज|today)\s*(?:kitne|कितने)?\s*(?:transactions?|entries?|lenden)/i,
      /(?:how\s*many)\s*(?:transactions?|entries?)\s*(?:today)/i,
    ],
    handler: handleTodayCount
  },
  {
    // "Last transaction" / "Pichla entry"
    patterns: [
      /(?:last|latest|recent|pichla|पिछला|aakhri|आखरी)\s*(?:transaction|entry|record)/i,
    ],
    handler: handleLastTransaction
  },
  {
    // "All customers" / "Sabhi customers"
    patterns: [
      /(?:all|sabhi|सभी|list)\s*(?:customers?|parties|log)/i,
      /(?:customers?|parties)\s*(?:list|sabhi|सभी)/i,
    ],
    handler: handleAllCustomers
  },
  {
    // "Ramesh ki history" / "Ramesh's transactions"
    patterns: [
      /(\w+)\s*(?:ka|ke|ki|का|के|की)\s*(?:history|transactions?|entries?|record|hisaab|हिसाब)/i,
      /(\w+)'?s?\s*(?:history|transactions?|entries?|record)/i,
    ],
    handler: handleCustomerHistory
  }
];

// ─── Query Handler Functions ────────────────────────────────

async function handleCustomerDebt(match) {
  const name = match[1];
  const customer = await getCustomerByName(name);

  if (!customer) {
    return {
      type: 'text',
      message: `No records found for "${name}". Check the spelling or try a different name.`,
      emoji: '🔍'
    };
  }

  const outstanding = customer.totalCredit - customer.totalDebit;

  if (outstanding > 0) {
    return {
      type: 'amount',
      message: `${customer.name} has an outstanding balance (udhaar) of`,
      amount: outstanding,
      detail: `Total credit: ${formatCurrency(customer.totalCredit)} · Total paid: ${formatCurrency(customer.totalDebit)}`,
      emoji: '📊'
    };
  } else if (outstanding < 0) {
    return {
      type: 'amount',
      message: `${customer.name} has overpaid by`,
      amount: Math.abs(outstanding),
      detail: `Total credit: ${formatCurrency(customer.totalCredit)} · Total paid: ${formatCurrency(customer.totalDebit)}`,
      emoji: '✅'
    };
  } else {
    return {
      type: 'text',
      message: `${customer.name} has no outstanding balance — all clear! ✅`,
      detail: `Total credit: ${formatCurrency(customer.totalCredit)} · Total paid: ${formatCurrency(customer.totalDebit)}`,
      emoji: '✅'
    };
  }
}

async function handleTodayCredit() {
  const txns = await getTodayTransactions();
  const credit = txns
    .filter(tx => tx.type === 'credit' || tx.type === 'udhaar')
    .reduce((sum, tx) => sum + tx.amount, 0);

  return {
    type: 'amount',
    message: `Total credit given today:`,
    amount: credit,
    detail: `${txns.filter(tx => tx.type === 'credit' || tx.type === 'udhaar').length} credit transactions today`,
    emoji: '📅'
  };
}

async function handleTopDebtor() {
  const debtors = await getTopDebtors(5);

  if (debtors.length === 0) {
    return {
      type: 'text',
      message: 'No outstanding debts found. Everyone is clear! 🎉',
      emoji: '✅'
    };
  }

  const top = debtors[0];
  const list = debtors.map((d, i) =>
    `${i + 1}. ${d.name} — ${formatCurrency(d.outstanding)}`
  ).join('\n');

  return {
    type: 'list',
    message: `${top.name} owes the most:`,
    amount: top.outstanding,
    listItems: debtors.map(d => ({
      name: d.name,
      amount: d.outstanding
    })),
    emoji: '🏆'
  };
}

async function handleTotalOutstanding() {
  const total = await getTotalOutstanding();

  return {
    type: 'amount',
    message: 'Total outstanding (udhaar) across all customers:',
    amount: total,
    emoji: '💰'
  };
}

async function handleDailySummary() {
  const summary = await getDailySummary();

  return {
    type: 'summary',
    message: `Today's Summary`,
    data: {
      transactions: summary.totalTransactions,
      creditGiven: summary.creditGiven,
      paymentsReceived: summary.paymentsReceived,
      outstandingCount: summary.outstandingCustomers.length
    },
    emoji: '📊'
  };
}

async function handleTodayCount() {
  const txns = await getTodayTransactions();

  return {
    type: 'text',
    message: `${txns.length} transaction${txns.length !== 1 ? 's' : ''} recorded today.`,
    detail: txns.length > 0
      ? `Last entry: ${txns[0].customer} — ${formatCurrency(txns[0].amount)}`
      : 'Start by adding your first entry!',
    emoji: '📝'
  };
}

async function handleLastTransaction() {
  const txns = await getTransactions();

  if (txns.length === 0) {
    return {
      type: 'text',
      message: 'No transactions recorded yet. Start by speaking or scanning a chit!',
      emoji: '📝'
    };
  }

  const last = txns[0];
  return {
    type: 'transaction',
    message: 'Last recorded transaction:',
    transaction: last,
    emoji: '🕐'
  };
}

async function handleAllCustomers() {
  const customers = await getCustomers();

  if (customers.length === 0) {
    return {
      type: 'text',
      message: 'No customers recorded yet.',
      emoji: '👥'
    };
  }

  return {
    type: 'list',
    message: `${customers.length} customer${customers.length !== 1 ? 's' : ''} in your khata:`,
    listItems: customers.map(c => ({
      name: c.name,
      amount: c.totalCredit - c.totalDebit
    })),
    emoji: '👥'
  };
}

async function handleCustomerHistory(match) {
  const name = match[1];
  const txns = await getCustomerTransactions(name);

  if (txns.length === 0) {
    return {
      type: 'text',
      message: `No transactions found for "${name}".`,
      emoji: '🔍'
    };
  }

  return {
    type: 'history',
    message: `${name}'s transaction history (${txns.length} entries):`,
    transactions: txns.slice(0, 10),
    emoji: '📋'
  };
}

// ─── Main Query Function ────────────────────────────────────

export async function processQuery(queryText) {
  if (!queryText || queryText.trim().length === 0) {
    return {
      type: 'text',
      message: 'Please ask a question about your khata.',
      emoji: '💬'
    };
  }

  const text = queryText.trim();

  // Try each pattern
  for (const { patterns, handler } of QUERY_PATTERNS) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      const match = text.match(pattern);
      if (match) {
        try {
          return await handler(match);
        } catch (err) {
          console.error('Query handler error:', err);
        }
      }
    }
  }

  // Fallback: no pattern matched
  return {
    type: 'text',
    message: "I'm not sure what you're asking. Try questions like:",
    suggestions: [
      '"Ramesh ka kitna udhaar hai?"',
      '"Aaj kitna credit diya?"',
      '"Who owes me the most?"',
      '"Today\'s summary"',
    ],
    emoji: '🤔'
  };
}

/**
 * Get suggested queries to show as chips
 */
export function getSuggestedQueries() {
  return [
    { text: 'Aaj ka summary', hindi: 'आज का हिसाब' },
    { text: 'Who owes the most?', hindi: '' },
    { text: 'Total outstanding', hindi: 'कुल बाकी' },
    { text: "Today's credit", hindi: 'आज का उधार' },
    { text: 'All customers', hindi: 'सभी ग्राहक' },
    { text: 'Last transaction', hindi: 'पिछला लेनदेन' },
  ];
}
