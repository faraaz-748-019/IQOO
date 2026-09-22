/**
 * KhataLens — Daily Summary Screen
 * Sales, expenses, credit given, outstanding customers at a glance.
 */
import { getDailySummary, getTopDebtors } from '../db/database.js';
import { formatCurrency } from '../utils/currency.js';
import { formatDate, getToday, getDateLabel } from '../utils/date.js';

let currentDate = getToday();

export function renderSummary() {
  return `
    <div class="screen active" id="screen-summary">
      <!-- Header -->
      <div class="screen-header">
        <button class="back-btn" onclick="window.app.navigate('home')">←</button>
        <h2 class="screen-title">📊 Daily Summary</h2>
      </div>

      <!-- Date Selector -->
      <div style="text-align: center; margin-bottom: var(--space-xl);">
        <div style="display: flex; align-items: center; justify-content: center; gap: var(--space-md);">
          <button class="btn btn-icon btn-ghost" onclick="window.summaryScreen.prevDay()">◀</button>
          <div>
            <input type="date" id="summary-date" class="input"
                   value="${currentDate}"
                   onchange="window.summaryScreen.setDate(this.value)"
                   style="text-align: center; background: transparent; border: none; color: var(--color-text-primary); font-size: var(--text-lg); font-weight: var(--weight-semibold);" />
            <div class="caption" id="summary-date-label">${getDateLabel(currentDate)}</div>
          </div>
          <button class="btn btn-icon btn-ghost" onclick="window.summaryScreen.nextDay()">▶</button>
        </div>
      </div>

      <!-- Main Stats -->
      <div id="summary-stats">
        <!-- Populated dynamically -->
      </div>

      <!-- Donut Chart -->
      <div class="donut-chart" id="summary-chart">
        <canvas id="donut-canvas" width="160" height="160"></canvas>
        <div class="donut-center">
          <div class="caption">NET</div>
          <div id="donut-net" style="font-size: var(--text-lg); font-weight: var(--weight-bold);"></div>
        </div>
      </div>

      <!-- Outstanding Customers -->
      <div class="section-divider" style="margin-top: var(--space-2xl);">
        <span class="section-divider-text">Outstanding Customers</span>
      </div>

      <div id="summary-outstanding" style="display: flex; flex-direction: column; gap: var(--space-sm);">
        <!-- Populated dynamically -->
      </div>

      <!-- Privacy footer -->
      <div style="text-align: center; margin-top: var(--space-2xl);">
        <span class="caption">🔒 All data processed on device · No cloud dependency</span>
      </div>
    </div>
  `;
}

export async function initSummary() {
  window.summaryScreen = {
    prevDay() {
      const d = new Date(currentDate + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      currentDate = d.toISOString().split('T')[0];
      updateDateUI();
      loadSummary();
    },
    nextDay() {
      const d = new Date(currentDate + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      currentDate = d.toISOString().split('T')[0];
      updateDateUI();
      loadSummary();
    },
    setDate(date) {
      currentDate = date;
      updateDateUI();
      loadSummary();
    }
  };

  await loadSummary();
}

function updateDateUI() {
  const input = document.getElementById('summary-date');
  const label = document.getElementById('summary-date-label');
  if (input) input.value = currentDate;
  if (label) label.textContent = getDateLabel(currentDate);
}

async function loadSummary() {
  const statsContainer = document.getElementById('summary-stats');
  const outstandingContainer = document.getElementById('summary-outstanding');

  try {
    const summary = await getDailySummary(currentDate);
    const debtors = await getTopDebtors(10);

    // Render stats grid
    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-value" style="color: var(--color-accent-secondary);">${summary.totalTransactions}</div>
            <div class="stat-label">Entries</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color: var(--color-credit);">${formatCurrency(summary.creditGiven)}</div>
            <div class="stat-label">Credit Given</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color: var(--color-success);">${formatCurrency(summary.paymentsReceived)}</div>
            <div class="stat-label">Received</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color: var(--color-warning);">${summary.outstandingCustomers.length}</div>
            <div class="stat-label">Outstanding</div>
          </div>
        </div>
      `;
    }

    // Draw donut chart
    drawDonut(summary.creditGiven, summary.paymentsReceived);

    // Render outstanding customers
    if (outstandingContainer) {
      if (debtors.length === 0) {
        outstandingContainer.innerHTML = `
          <div class="empty-state" style="padding: var(--space-xl) 0;">
            <div class="empty-state-icon">✅</div>
            <div class="empty-state-title">All clear!</div>
            <div class="empty-state-text">No outstanding balances</div>
          </div>
        `;
      } else {
        outstandingContainer.innerHTML = debtors.map((d, i) => `
          <div class="transaction-item">
            <div class="transaction-avatar credit" style="font-size: var(--text-sm);">${i + 1}</div>
            <div class="transaction-info">
              <div class="transaction-name">${d.name}</div>
              <div class="transaction-meta">
                Credit: ${formatCurrency(d.totalCredit)} · Paid: ${formatCurrency(d.totalDebit)}
              </div>
            </div>
            <div class="transaction-amount debit">${formatCurrency(d.outstanding)}</div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Summary error:', err);
  }
}

function drawDonut(credit, received) {
  const canvas = document.getElementById('donut-canvas');
  const netEl = document.getElementById('donut-net');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const size = 160;
  const center = size / 2;
  const radius = 60;
  const lineWidth = 18;

  ctx.clearRect(0, 0, size, size);

  const total = credit + received;
  if (total === 0) {
    // Empty state
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    if (netEl) {
      netEl.textContent = '₹0';
      netEl.style.color = 'var(--color-text-tertiary)';
    }
    return;
  }

  const creditAngle = (credit / total) * Math.PI * 2;
  const receivedAngle = (received / total) * Math.PI * 2;

  // Credit arc
  ctx.beginPath();
  ctx.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + creditAngle);
  ctx.strokeStyle = '#ff6b6b';
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Received arc
  ctx.beginPath();
  ctx.arc(center, center, radius, -Math.PI / 2 + creditAngle, -Math.PI / 2 + creditAngle + receivedAngle);
  ctx.strokeStyle = '#00cec9';
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Net display
  const net = received - credit;
  if (netEl) {
    netEl.textContent = formatCurrency(Math.abs(net));
    netEl.style.color = net >= 0 ? 'var(--color-credit)' : 'var(--color-debit)';
  }
}
