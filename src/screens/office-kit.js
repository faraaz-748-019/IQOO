/**
 * KhataLens — Office Kit Screen
 * Phone → Laptop handoff: export structured data, reconciliation view, Excel export.
 */
import { getAllTransactions, getCustomers, getDailySummary } from '../db/database.js';
import { formatCurrency } from '../utils/currency.js';
import { formatDate, getToday } from '../utils/date.js';
import * as XLSX from 'xlsx';

let dateFrom = '';
let dateTo = '';

export function renderOfficeKit() {
  const today = getToday();
  dateFrom = dateFrom || today;
  dateTo = dateTo || today;

  return `
    <div class="screen active" id="screen-office-kit">
      <!-- Header -->
      <div class="screen-header">
        <button class="back-btn" onclick="window.app.navigate('home')">←</button>
        <h2 class="screen-title">💼 Office Kit</h2>
      </div>

      <!-- Description -->
      <div class="card" style="margin-bottom: var(--space-xl); border-left: 3px solid var(--color-accent-primary);">
        <p style="font-size: var(--text-sm); color: var(--color-text-secondary);">
          📱→💻 <strong>Transfer to Laptop</strong><br>
          Export your khata data for reconciliation, review, and Excel-compatible reports on a bigger screen.
        </p>
      </div>

      <!-- Date Range -->
      <div style="display: flex; gap: var(--space-md); margin-bottom: var(--space-xl);">
        <div class="input-group" style="flex: 1;">
          <label class="input-label">From</label>
          <input type="date" class="input" id="export-from" value="${dateFrom}"
                 onchange="window.officeKit.setDateFrom(this.value)" />
        </div>
        <div class="input-group" style="flex: 1;">
          <label class="input-label">To</label>
          <input type="date" class="input" id="export-to" value="${dateTo}"
                 onchange="window.officeKit.setDateTo(this.value)" />
        </div>
      </div>

      <!-- Quick Date Buttons -->
      <div style="display: flex; gap: var(--space-sm); margin-bottom: var(--space-xl); flex-wrap: wrap;">
        <button class="chip" onclick="window.officeKit.setToday()">Today</button>
        <button class="chip" onclick="window.officeKit.setWeek()">This Week</button>
        <button class="chip" onclick="window.officeKit.setMonth()">This Month</button>
        <button class="chip" onclick="window.officeKit.setAll()">All Time</button>
      </div>

      <!-- Export Options -->
      <div style="display: flex; flex-direction: column; gap: var(--space-md); margin-bottom: var(--space-2xl);">
        <div class="export-option" onclick="window.officeKit.exportExcel()">
          <div class="export-option-icon" style="background: rgba(0, 184, 148, 0.12);">📊</div>
          <div class="export-option-info">
            <div class="export-option-title">Export as Excel</div>
            <div class="export-option-desc">Download .xlsx file for laptop reconciliation</div>
          </div>
        </div>

        <div class="export-option" onclick="window.officeKit.exportCSV()">
          <div class="export-option-icon" style="background: rgba(108, 92, 231, 0.12);">📄</div>
          <div class="export-option-info">
            <div class="export-option-title">Export as CSV</div>
            <div class="export-option-desc">Universal format, compatible with any spreadsheet</div>
          </div>
        </div>

        <div class="export-option" onclick="window.officeKit.showReconciliation()">
          <div class="export-option-icon" style="background: rgba(253, 203, 110, 0.12);">🔍</div>
          <div class="export-option-info">
            <div class="export-option-title">Reconciliation View</div>
            <div class="export-option-desc">Full data table optimized for laptop screens</div>
          </div>
        </div>
      </div>

      <!-- Preview Stats -->
      <div class="section-divider">
        <span class="section-divider-text">Export Preview</span>
      </div>

      <div id="export-preview" class="stat-grid" style="margin-bottom: var(--space-xl);">
        <!-- Populated dynamically -->
      </div>

      <!-- Reconciliation Table (shown on larger screens) -->
      <div id="reconciliation-container" style="display: none; margin-top: var(--space-xl); overflow-x: auto;">
        <table class="reconciliation-table" id="reconciliation-table">
          <!-- Populated dynamically -->
        </table>
      </div>

      <!-- Privacy -->
      <div style="text-align: center; margin-top: var(--space-xl);">
        <span class="caption">🔒 Export is an explicit user action · No automatic uploads</span>
      </div>
    </div>
  `;
}

export async function initOfficeKit() {
  window.officeKit = {
    setDateFrom(d) { dateFrom = d; loadPreview(); },
    setDateTo(d) { dateTo = d; loadPreview(); },

    setToday() {
      const today = getToday();
      dateFrom = today;
      dateTo = today;
      updateDateInputs();
      loadPreview();
    },

    setWeek() {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      dateFrom = d.toISOString().split('T')[0];
      dateTo = getToday();
      updateDateInputs();
      loadPreview();
    },

    setMonth() {
      const d = new Date();
      d.setDate(1);
      dateFrom = d.toISOString().split('T')[0];
      dateTo = getToday();
      updateDateInputs();
      loadPreview();
    },

    setAll() {
      dateFrom = '2020-01-01';
      dateTo = getToday();
      updateDateInputs();
      loadPreview();
    },

    async exportExcel() {
      try {
        const txns = await getFilteredTransactions();
        if (txns.length === 0) {
          window.app.showToast('No data to export', 'warning');
          return;
        }

        const wb = XLSX.utils.book_new();

        // Transactions sheet
        const txData = txns.map(tx => ({
          'Date': tx.date,
          'Customer': tx.customer,
          'Amount (₹)': tx.amount,
          'Type': tx.type,
          'Item': tx.item || '',
          'Source': tx.source || 'manual',
          'Created At': tx.createdAt
        }));

        const ws = XLSX.utils.json_to_sheet(txData);
        XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

        // Customer Summary sheet
        const customers = await getCustomers();
        const custData = customers.map(c => ({
          'Customer': c.name,
          'Total Credit (₹)': c.totalCredit,
          'Total Paid (₹)': c.totalDebit,
          'Outstanding (₹)': c.totalCredit - c.totalDebit,
          'Last Transaction': c.lastTransaction
        }));

        const ws2 = XLSX.utils.json_to_sheet(custData);
        XLSX.utils.book_append_sheet(wb, ws2, 'Customer Summary');

        // Download
        XLSX.writeFile(wb, `KhataLens_${dateFrom}_to_${dateTo}.xlsx`);
        window.app.showToast('✅ Excel file downloaded!', 'success');
      } catch (err) {
        console.error('Export error:', err);
        window.app.showToast('Export failed', 'error');
      }
    },

    async exportCSV() {
      try {
        const txns = await getFilteredTransactions();
        if (txns.length === 0) {
          window.app.showToast('No data to export', 'warning');
          return;
        }

        const headers = ['Date', 'Customer', 'Amount', 'Type', 'Item', 'Source', 'Created At'];
        const rows = txns.map(tx => [
          tx.date, tx.customer, tx.amount, tx.type, tx.item || '', tx.source || 'manual', tx.createdAt
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `KhataLens_${dateFrom}_to_${dateTo}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        window.app.showToast('✅ CSV file downloaded!', 'success');
      } catch (err) {
        console.error('CSV export error:', err);
        window.app.showToast('Export failed', 'error');
      }
    },

    async showReconciliation() {
      const container = document.getElementById('reconciliation-container');
      const table = document.getElementById('reconciliation-table');
      if (!container || !table) return;

      const txns = await getFilteredTransactions();

      if (txns.length === 0) {
        container.style.display = 'block';
        table.innerHTML = '<tr><td style="padding: var(--space-xl); text-align: center; color: var(--color-text-tertiary);">No transactions in this date range</td></tr>';
        return;
      }

      let html = `
        <thead>
          <tr>
            <th>#</th>
            <th>Date</th>
            <th>Customer</th>
            <th>Type</th>
            <th>Item</th>
            <th>Amount</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
      `;

      txns.forEach((tx, i) => {
        const isCredit = tx.type === 'credit' || tx.type === 'udhaar';
        html += `
          <tr>
            <td style="color: var(--color-text-tertiary);">${i + 1}</td>
            <td>${tx.date}</td>
            <td style="font-weight: var(--weight-semibold);">${tx.customer}</td>
            <td><span class="badge ${isCredit ? 'badge-debit' : 'badge-credit'}">${tx.type}</span></td>
            <td style="color: var(--color-text-secondary);">${tx.item || '—'}</td>
            <td style="font-weight: var(--weight-bold); color: ${isCredit ? 'var(--color-debit)' : 'var(--color-credit)'};">
              ${formatCurrency(tx.amount)}
            </td>
            <td style="color: var(--color-text-tertiary);">${tx.source === 'voice' ? '🎙️' : tx.source === 'camera' ? '📷' : '✏️'}</td>
          </tr>
        `;
      });

      html += '</tbody>';
      table.innerHTML = html;
      container.style.display = 'block';

      // Scroll to table
      container.scrollIntoView({ behavior: 'smooth' });
    }
  };

  await loadPreview();
}

function updateDateInputs() {
  const fromInput = document.getElementById('export-from');
  const toInput = document.getElementById('export-to');
  if (fromInput) fromInput.value = dateFrom;
  if (toInput) toInput.value = dateTo;
}

async function getFilteredTransactions() {
  const all = await getAllTransactions();
  return all.filter(tx => {
    if (dateFrom && tx.date < dateFrom) return false;
    if (dateTo && tx.date > dateTo) return false;
    return true;
  });
}

async function loadPreview() {
  const container = document.getElementById('export-preview');
  if (!container) return;

  const txns = await getFilteredTransactions();

  let totalCredit = 0;
  let totalDebit = 0;
  const customerSet = new Set();

  txns.forEach(tx => {
    customerSet.add(tx.customer);
    if (tx.type === 'credit' || tx.type === 'udhaar') {
      totalCredit += tx.amount;
    } else {
      totalDebit += tx.amount;
    }
  });

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-value" style="color: var(--color-accent-secondary);">${txns.length}</div>
      <div class="stat-label">Entries</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: var(--color-text-primary);">${customerSet.size}</div>
      <div class="stat-label">Customers</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: var(--color-debit);">${formatCurrency(totalCredit)}</div>
      <div class="stat-label">Credit</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: var(--color-credit);">${formatCurrency(totalDebit)}</div>
      <div class="stat-label">Received</div>
    </div>
  `;
}
