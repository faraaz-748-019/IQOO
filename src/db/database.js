/**
 * KhataLens — Local Database (IndexedDB via Dexie.js)
 * Fully offline-first. No data leaves the device.
 */
import Dexie from 'dexie';

const db = new Dexie('KhataLensDB');

db.version(1).stores({
  transactions: '++id, customer, amount, type, category, date, source, createdAt',
  customers: '++id, &name, totalCredit, totalDebit, lastTransaction'
});

// ─── Transaction CRUD ───────────────────────────────────────

export async function addTransaction(tx) {
  const entry = {
    customer: tx.customer || 'Unknown',
    amount: parseFloat(tx.amount) || 0,
    type: tx.type || 'credit',        // 'credit' | 'debit' | 'payment'
    item: tx.item || '',
    category: tx.category || 'general',
    date: tx.date || new Date().toISOString().split('T')[0],
    source: tx.source || 'manual',     // 'voice' | 'camera' | 'manual'
    rawText: tx.rawText || '',
    confidence: tx.confidence || {},
    createdAt: new Date().toISOString()
  };

  const id = await db.transactions.add(entry);
  await updateCustomerSummary(entry.customer);
  return { ...entry, id };
}

export async function getTransactions(filters = {}) {
  let collection = db.transactions.orderBy('createdAt').reverse();

  const results = await collection.toArray();

  return results.filter(tx => {
    if (filters.customer && tx.customer.toLowerCase() !== filters.customer.toLowerCase()) return false;
    if (filters.date && tx.date !== filters.date) return false;
    if (filters.type && tx.type !== filters.type) return false;
    if (filters.dateFrom && tx.date < filters.dateFrom) return false;
    if (filters.dateTo && tx.date > filters.dateTo) return false;
    return true;
  });
}

export async function getTransactionsByDateRange(from, to) {
  return getTransactions({ dateFrom: from, dateTo: to });
}

export async function getTodayTransactions() {
  const today = new Date().toISOString().split('T')[0];
  return getTransactions({ date: today });
}

export async function deleteTransaction(id) {
  const tx = await db.transactions.get(id);
  if (tx) {
    await db.transactions.delete(id);
    await updateCustomerSummary(tx.customer);
  }
}

export async function getAllTransactions() {
  return db.transactions.orderBy('createdAt').reverse().toArray();
}

// ─── Customer management ────────────────────────────────────

async function updateCustomerSummary(customerName) {
  const txns = await db.transactions.where('customer').equalsIgnoreCase(customerName).toArray();

  let totalCredit = 0;
  let totalDebit = 0;
  let lastTx = null;

  txns.forEach(tx => {
    if (tx.type === 'credit' || tx.type === 'udhaar') {
      totalCredit += tx.amount;
    } else {
      totalDebit += tx.amount;
    }
    if (!lastTx || tx.createdAt > lastTx) {
      lastTx = tx.createdAt;
    }
  });

  const existing = await db.customers.where('name').equalsIgnoreCase(customerName).first();

  if (existing) {
    await db.customers.update(existing.id, {
      totalCredit,
      totalDebit,
      lastTransaction: lastTx
    });
  } else if (txns.length > 0) {
    await db.customers.add({
      name: customerName,
      totalCredit,
      totalDebit,
      lastTransaction: lastTx
    });
  }
}

export async function getCustomers() {
  return db.customers.orderBy('name').toArray();
}

export async function getCustomerByName(name) {
  return db.customers.where('name').equalsIgnoreCase(name).first();
}

export async function getCustomerTransactions(name) {
  return db.transactions.where('customer').equalsIgnoreCase(name).reverse().sortBy('createdAt');
}

// ─── Aggregations & Analytics ───────────────────────────────

export async function getDailySummary(date) {
  const dateStr = date || new Date().toISOString().split('T')[0];
  const txns = await getTransactions({ date: dateStr });

  const summary = {
    date: dateStr,
    totalTransactions: txns.length,
    totalSales: 0,
    totalExpenses: 0,
    creditGiven: 0,
    paymentsReceived: 0,
    outstandingCustomers: [],
    transactions: txns
  };

  txns.forEach(tx => {
    if (tx.type === 'credit' || tx.type === 'udhaar') {
      summary.creditGiven += tx.amount;
    } else if (tx.type === 'debit' || tx.type === 'payment') {
      summary.paymentsReceived += tx.amount;
    }
    if (tx.type === 'sale') {
      summary.totalSales += tx.amount;
    }
    if (tx.type === 'expense') {
      summary.totalExpenses += tx.amount;
    }
  });

  // Get outstanding customers
  const customers = await getCustomers();
  summary.outstandingCustomers = customers
    .map(c => ({
      name: c.name,
      outstanding: c.totalCredit - c.totalDebit
    }))
    .filter(c => c.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  return summary;
}

export async function getTopDebtors(limit = 10) {
  const customers = await getCustomers();
  return customers
    .map(c => ({
      name: c.name,
      outstanding: c.totalCredit - c.totalDebit,
      totalCredit: c.totalCredit,
      totalDebit: c.totalDebit,
      lastTransaction: c.lastTransaction
    }))
    .filter(c => c.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, limit);
}

export async function getTotalOutstanding() {
  const customers = await getCustomers();
  return customers.reduce((sum, c) => sum + Math.max(0, c.totalCredit - c.totalDebit), 0);
}

export { db };
