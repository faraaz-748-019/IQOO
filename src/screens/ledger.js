/**
 * KhataLens — Ledger Screen
 * Scrollable transaction list with filters and customer-wise view.
 */
import { getTransactions, getAllTransactions, deleteTransaction } from '../db/database.js';
import { formatCurrency } from '../utils/currency.js';
import { getRelativeTime, getDateLabel, formatTime } from '../utils/date.js';

let currentFilter = 'all'; // 'all', 'credit', 'debit'
let searchQuery = '';

export function renderLedger() {
  return `
    <div class="screen active" id="screen-ledger">
      <!-- Header -->
      <div class="screen-header">
        <button class="back-btn" onclick="window.app.navigate('home')">←</button>
        <h2 class="screen-title">📒 My Khata</h2>
      </div>

      <!-- Search Bar -->
      <div style="margin-bottom: var(--space-lg);">
        <input class="input input-lg" id="ledger-search"
               placeholder="🔍 Search customer, amount..."
               oninput="window.ledgerScreen.search(this.value)" />
      </div>

      <!-- Filter Tabs -->
      <div style="display: flex; gap: var(--space-sm); margin-bottom: var(--space-xl);">
        <button class="chip active" id="filter-all" onclick="window.ledgerScreen.filter('all')">All</button>
        <button class="chip" id="filter-credit" onclick="window.ledgerScreen.filter('credit')">
          Credit / Udhaar
        </button>
        <button class="chip" id="filter-debit" onclick="window.ledgerScreen.filter('debit')">
          Payments
        </button>
      </div>

      <!-- Transaction List -->
      <div id="ledger-list" style="display: flex; flex-direction: column; gap: var(--space-sm);">
        <!-- Populated dynamically -->
      </div>

      <!-- FAB -->
      <button class="btn btn-primary btn-icon" id="btn-add-entry"
              style="position: fixed; bottom: 80px; right: 20px; width: 56px; height: 56px; font-size: 1.5rem; box-shadow: var(--shadow-glow-strong); z-index: 40;"
              onclick="window.app.navigate('home')">
        +
      </button>
    </div>
  `;
}

export async function initLedger() {
  window.ledgerScreen = {
    filter(type) {
      currentFilter = type;
      // Update active state
      document.querySelectorAll('#screen-ledger .chip').forEach(c => c.classList.remove('active'));
      document.getElementById(`filter-${type}`)?.classList.add('active');
      loadTransactions();
    },

    search(query) {
      searchQuery = query.toLowerCase().trim();
      loadTransactions();
    },

    async deleteEntry(id) {
      if (confirm('Delete this transaction?')) {
        await deleteTransaction(id);
        window.app.showToast('Transaction deleted', 'info');
        loadTransactions();
      }
    }
  };

  await loadTransactions();
}

async function loadTransactions() {
  const container = document.getElementById('ledger-list');
  if (!container) return;

  try {
    let txns = await getAllTransactions();

    // Apply type filter
    if (currentFilter === 'credit') {
      txns = txns.filter(tx => tx.type === 'credit' || tx.type === 'udhaar');
    } else if (currentFilter === 'debit') {
      txns = txns.filter(tx => tx.type === 'debit' || tx.type === 'payment');
    }

    // Apply search filter
    if (searchQuery) {
      txns = txns.filter(tx =>
        (tx.customer || '').toLowerCase().includes(searchQuery) ||
        (tx.amount || '').toString().includes(searchQuery) ||
        (tx.item || '').toLowerCase().includes(searchQuery)
      );
    }

    if (txns.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📒</div>
          <div class="empty-state-title">No entries found</div>
          <div class="empty-state-text">
            ${searchQuery ? 'Try a different search term' : 'Start by speaking or scanning a chit'}
          </div>
        </div>
      `;
      return;
    }

    // Group by date
    const grouped = {};
    txns.forEach(tx => {
      const date = tx.date || 'unknown';
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(tx);
    });

    let html = '';
    for (const [date, items] of Object.entries(grouped)) {
      html += `
        <div class="section-divider" style="margin: var(--space-md) 0;">
          <span class="section-divider-text">${getDateLabel(date)}</span>
        </div>
      `;

      items.forEach(tx => {
        const isCredit = tx.type === 'credit' || tx.type === 'udhaar';
        const initial = (tx.customer || '?')[0].toUpperCase();
        const typeClass = isCredit ? 'credit' : 'debit';
        const sign = isCredit ? '+' : '-';
        const sourceIcon = tx.source === 'voice' ? '🎙️' : tx.source === 'camera' ? '📷' : '✏️';

        html += `
          <div class="transaction-item" onclick="window.ledgerScreen.deleteEntry(${tx.id})" style="cursor: pointer;">
            <div class="transaction-avatar ${typeClass}">${initial}</div>
            <div class="transaction-info">
              <div class="transaction-name">${tx.customer || 'Unknown'}</div>
              <div class="transaction-meta">
                ${sourceIcon} ${tx.type}${tx.item ? ' · ' + tx.item : ''} · ${formatTime(tx.createdAt)}
              </div>
            </div>
            <div class="transaction-amount ${typeClass}">${sign}${formatCurrency(tx.amount)}</div>
          </div>
        `;
      });
    }

    container.innerHTML = html;
  } catch (err) {
    console.error('Error loading transactions:', err);
    container.innerHTML = '<p class="body-text" style="text-align: center;">Error loading data</p>';
  }
}
