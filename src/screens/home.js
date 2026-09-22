/**
 * KhataLens — Home Screen
 * Main hub with Speak/Scan/Khata actions, today's stats, and recent transactions.
 */
import { getTodayTransactions, getDailySummary } from '../db/database.js';
import { formatCurrency } from '../utils/currency.js';
import { getRelativeTime } from '../utils/date.js';

export function renderHome(app) {
  return `
    <div class="screen active" id="screen-home">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: var(--space-xl);">
        <h1 class="heading-1" style="margin-bottom: 0.15rem;">
          <span class="gradient-text">KhataLens</span>
        </h1>
        <p style="font-size: var(--text-sm); color: var(--color-text-tertiary); font-style: italic;">
          A khata you don't have to type into
        </p>
      </div>

      <!-- Privacy Bar -->
      <div class="privacy-bar" style="margin-bottom: var(--space-xl);">
        <span class="badge badge-privacy">🔒 No cloud AI</span>
        <span class="badge badge-privacy">📱 Local processing</span>
        <span class="badge badge-privacy">📡 Offline capable</span>
      </div>

      <!-- Main Action Buttons -->
      <div class="action-grid" style="margin-bottom: var(--space-2xl);">
        <button class="action-btn" id="btn-speak" onclick="window.app.navigate('voice')">
          <div class="action-btn-icon">🎙️</div>
          <div class="action-btn-label">Speak</div>
          <div class="action-btn-sublabel">बोलो</div>
        </button>
        <button class="action-btn" id="btn-scan" onclick="window.app.navigate('camera')">
          <div class="action-btn-icon">📷</div>
          <div class="action-btn-label">Scan</div>
          <div class="action-btn-sublabel">स्कैन करो</div>
        </button>
        <button class="action-btn" id="btn-khata" onclick="window.app.navigate('ledger')">
          <div class="action-btn-icon">📒</div>
          <div class="action-btn-label">Khata</div>
          <div class="action-btn-sublabel">खाता</div>
        </button>
      </div>

      <!-- Today's Quick Stats -->
      <div class="section-divider">
        <span class="section-divider-text">Today's Snapshot</span>
      </div>

      <div class="stat-grid" id="home-stats" style="margin-bottom: var(--space-2xl);">
        <div class="stat-card">
          <div class="stat-value" id="stat-transactions" style="color: var(--color-accent-secondary);">0</div>
          <div class="stat-label">Entries</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="stat-credit" style="color: var(--color-credit);">₹0</div>
          <div class="stat-label">Credit Given</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="stat-received" style="color: var(--color-success);">₹0</div>
          <div class="stat-label">Received</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="stat-outstanding" style="color: var(--color-warning);">₹0</div>
          <div class="stat-label">Outstanding</div>
        </div>
      </div>

      <!-- Recent Transactions -->
      <div class="section-divider">
        <span class="section-divider-text">Recent Entries</span>
      </div>

      <div id="recent-transactions" style="display: flex; flex-direction: column; gap: var(--space-sm);">
        <!-- Populated dynamically -->
      </div>

      <!-- Quick Ask -->
      <div style="margin-top: var(--space-2xl);">
        <button class="btn btn-secondary btn-full btn-lg" id="btn-ask-khata" onclick="window.app.navigate('query')">
          💬 Ask my Khata
        </button>
      </div>
    </div>
  `;
}

export async function initHome() {
  try {
    const summary = await getDailySummary();
    const txns = await getTodayTransactions();

    // Update stats
    const statTx = document.getElementById('stat-transactions');
    const statCredit = document.getElementById('stat-credit');
    const statReceived = document.getElementById('stat-received');
    const statOutstanding = document.getElementById('stat-outstanding');

    if (statTx) statTx.textContent = summary.totalTransactions;
    if (statCredit) statCredit.textContent = formatCurrency(summary.creditGiven);
    if (statReceived) statReceived.textContent = formatCurrency(summary.paymentsReceived);

    // Calculate total outstanding
    const totalOutstanding = summary.outstandingCustomers.reduce(
      (sum, c) => sum + c.outstanding, 0
    );
    if (statOutstanding) statOutstanding.textContent = formatCurrency(totalOutstanding);

    // Render recent transactions
    const container = document.getElementById('recent-transactions');
    if (container) {
      if (txns.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding: var(--space-2xl) 0;">
            <div class="empty-state-icon">📝</div>
            <div class="empty-state-title">No entries today</div>
            <div class="empty-state-text">Tap Speak or Scan to add your first entry</div>
          </div>
        `;
      } else {
        container.innerHTML = txns.slice(0, 5).map(tx => renderTransactionItem(tx)).join('');
      }
    }
  } catch (err) {
    console.error('Error loading home data:', err);
  }
}

function renderTransactionItem(tx) {
  const isCredit = tx.type === 'credit' || tx.type === 'udhaar';
  const initial = (tx.customer || '?')[0].toUpperCase();
  const typeClass = isCredit ? 'credit' : 'debit';
  const sign = isCredit ? '+' : '-';
  const sourceIcon = tx.source === 'voice' ? '🎙️' : tx.source === 'camera' ? '📷' : '✏️';

  return `
    <div class="transaction-item">
      <div class="transaction-avatar ${typeClass}">${initial}</div>
      <div class="transaction-info">
        <div class="transaction-name">${tx.customer || 'Unknown'}</div>
        <div class="transaction-meta">${sourceIcon} ${tx.type} · ${getRelativeTime(tx.createdAt)}</div>
      </div>
      <div class="transaction-amount ${typeClass}">${sign}${formatCurrency(tx.amount)}</div>
    </div>
  `;
}
