/**
 * KhataLens — Smart Confirmation Screen
 * Trust layer: never silently commit an AI result.
 * Shows extracted fields with confidence indicators and edit capability.
 */
import { addTransaction } from '../db/database.js';
import { formatCurrency } from '../utils/currency.js';
import { formatDate } from '../utils/date.js';
import { getConfidenceMessage, getOverallConfidence } from '../ai/entity-extractor.js';
import { playSuccess, playError } from '../utils/audio-feedback.js';

let currentExtraction = null;

export function renderConfirmation(extraction) {
  currentExtraction = { ...extraction };
  const conf = getConfidenceMessage(extraction);
  const overall = getOverallConfidence(extraction);
  const isCredit = extraction.type === 'credit' || extraction.type === 'udhaar';

  const typeLabel = {
    credit: 'Credit / Udhaar',
    debit: 'Payment / Debit',
    udhaar: 'Credit / Udhaar',
    payment: 'Payment',
    sale: 'Sale',
    expense: 'Expense'
  }[extraction.type] || 'Credit / Udhaar';

  let confidenceBanner = '';
  if (conf.type === 'error') {
    confidenceBanner = `
      <div class="card" style="border-left: 3px solid var(--color-danger); margin-bottom: var(--space-xl); padding: var(--space-md) var(--space-lg);">
        <p style="color: var(--color-danger); font-size: var(--text-sm); font-weight: var(--weight-medium);">
          ⚠️ ${conf.message}
        </p>
      </div>
    `;
  } else if (conf.type === 'uncertain') {
    confidenceBanner = `
      <div class="card" style="border-left: 3px solid var(--color-warning); margin-bottom: var(--space-xl); padding: var(--space-md) var(--space-lg);">
        <p style="color: var(--color-warning); font-size: var(--text-sm); font-weight: var(--weight-medium);">
          🤔 ${conf.message}
        </p>
      </div>
    `;
  } else {
    confidenceBanner = `
      <div style="text-align: center; margin-bottom: var(--space-xl);">
        <span class="badge badge-accent" style="font-size: var(--text-sm); padding: var(--space-sm) var(--space-lg);">
          ✨ ${conf.message}
        </span>
      </div>
    `;
  }

  const sourceIcon = extraction.source === 'voice' ? '🎙️ Voice' : extraction.source === 'camera' ? '📷 Camera' : '✏️ Manual';

  return `
    <div class="screen active" id="screen-confirmation">
      <!-- Header -->
      <div class="screen-header">
        <button class="back-btn" onclick="window.app.navigate('home')">←</button>
        <h2 class="screen-title">Verify Entry</h2>
        <span class="badge badge-privacy" style="margin-left: auto;">${sourceIcon}</span>
      </div>

      ${confidenceBanner}

      <!-- Confirmation Card -->
      <div class="confirm-card">
        <!-- Amount (prominent) -->
        <div class="confirm-amount ${isCredit ? 'credit' : 'debit'}" id="confirm-amount-display">
          ${extraction.amount !== null ? formatCurrency(extraction.amount) : '₹???'}
        </div>

        <!-- Fields -->
        <div class="confirm-field">
          <span class="confirm-field-label">Customer</span>
          <span class="confirm-field-value">
            <span class="confidence-dot ${extraction.confidence.customer === 'high' ? 'high' : extraction.confidence.customer === 'missing' ? 'low' : 'medium'}"></span>
            <input class="input" id="confirm-customer" value="${extraction.customer || ''}"
                   placeholder="Enter customer name" style="text-align: right; max-width: 180px; padding: var(--space-xs) var(--space-sm);" />
          </span>
        </div>

        <div class="confirm-field">
          <span class="confirm-field-label">Amount</span>
          <span class="confirm-field-value">
            <span class="confidence-dot ${extraction.confidence.amount === 'high' ? 'high' : extraction.confidence.amount === 'missing' ? 'low' : 'medium'}"></span>
            <input class="input" id="confirm-amount" type="number" value="${extraction.amount || ''}"
                   placeholder="₹0" style="text-align: right; max-width: 140px; padding: var(--space-xs) var(--space-sm);"
                   onchange="window.confirmScreen.updateAmount()" />
          </span>
        </div>

        <div class="confirm-field">
          <span class="confirm-field-label">Type</span>
          <span class="confirm-field-value">
            <select class="input" id="confirm-type" style="text-align: right; max-width: 160px; padding: var(--space-xs) var(--space-sm); background: var(--color-bg-input);">
              <option value="credit" ${extraction.type === 'credit' || extraction.type === 'udhaar' ? 'selected' : ''}>Credit / Udhaar</option>
              <option value="debit" ${extraction.type === 'debit' || extraction.type === 'payment' ? 'selected' : ''}>Payment / Debit</option>
              <option value="sale" ${extraction.type === 'sale' ? 'selected' : ''}>Sale</option>
              <option value="expense" ${extraction.type === 'expense' ? 'selected' : ''}>Expense</option>
            </select>
          </span>
        </div>

        <div class="confirm-field">
          <span class="confirm-field-label">Item</span>
          <span class="confirm-field-value">
            <input class="input" id="confirm-item" value="${extraction.item || ''}"
                   placeholder="Optional" style="text-align: right; max-width: 160px; padding: var(--space-xs) var(--space-sm);" />
          </span>
        </div>

        <div class="confirm-field">
          <span class="confirm-field-label">Date</span>
          <span class="confirm-field-value">
            <input class="input" id="confirm-date" type="date" value="${extraction.date || new Date().toISOString().split('T')[0]}"
                   style="text-align: right; max-width: 160px; padding: var(--space-xs) var(--space-sm);" />
          </span>
        </div>
      </div>

      <!-- Raw Text Preview -->
      ${extraction.rawText ? `
        <details style="margin-top: var(--space-lg);">
          <summary class="caption" style="cursor: pointer; padding: var(--space-sm) 0;">
            VIEW RAW TEXT
          </summary>
          <div class="card" style="margin-top: var(--space-sm); font-size: var(--text-sm); color: var(--color-text-secondary); font-family: monospace;">
            ${extraction.rawText}
          </div>
        </details>
      ` : ''}

      ${extraction.ocrLatency ? `
        <div style="text-align: center; margin-top: var(--space-md);">
          <span class="caption">🔒 Processed on device · ${extraction.ocrLatency}ms latency${extraction.ocrConfidence ? ` · ${Math.round(extraction.ocrConfidence)}% OCR confidence` : ''}</span>
        </div>
      ` : ''}

      <!-- Actions -->
      <div class="confirm-actions" style="margin-top: var(--space-2xl);">
        <button class="btn btn-danger btn-lg" onclick="window.app.navigate('home')" style="flex: 0.4;">
          ✗ Cancel
        </button>
        <button class="btn btn-success btn-lg" id="btn-confirm" onclick="window.confirmScreen.confirm()">
          ✓ Confirm
        </button>
      </div>
    </div>
  `;
}

export function initConfirmation() {
  window.confirmScreen = {
    updateAmount() {
      const input = document.getElementById('confirm-amount');
      const display = document.getElementById('confirm-amount-display');
      const typeSelect = document.getElementById('confirm-type');
      if (input && display) {
        const val = parseFloat(input.value) || 0;
        const isCredit = typeSelect?.value === 'credit' || typeSelect?.value === 'udhaar';
        display.className = `confirm-amount ${isCredit ? 'credit' : 'debit'}`;
        display.textContent = formatCurrency(val);
      }
    },

    async confirm() {
      const customer = document.getElementById('confirm-customer')?.value?.trim();
      const amount = parseFloat(document.getElementById('confirm-amount')?.value);
      const type = document.getElementById('confirm-type')?.value;
      const item = document.getElementById('confirm-item')?.value?.trim();
      const date = document.getElementById('confirm-date')?.value;

      // Validate required fields
      if (!customer) {
        document.getElementById('confirm-customer')?.focus();
        playError();
        window.app.showToast('Please enter a customer name', 'warning');
        return;
      }

      if (!amount || amount <= 0) {
        document.getElementById('confirm-amount')?.focus();
        playError();
        window.app.showToast('Please enter a valid amount', 'warning');
        return;
      }

      // Save to database
      const btn = document.getElementById('btn-confirm');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Saving...';
      }

      try {
        await addTransaction({
          customer,
          amount,
          type,
          item,
          date,
          source: currentExtraction?.source || 'manual',
          rawText: currentExtraction?.rawText || '',
          confidence: currentExtraction?.confidence || {}
        });

        playSuccess();
        window.app.showToast(`✅ ${customer} · ${formatCurrency(amount)} · ${type} saved!`, 'success');

        // Navigate back to home
        setTimeout(() => {
          window.app.navigate('home');
        }, 800);
      } catch (err) {
        console.error('Save error:', err);
        playError();
        window.app.showToast('Failed to save. Please try again.', 'error');
        if (btn) {
          btn.disabled = false;
          btn.textContent = '✓ Confirm';
        }
      }
    }
  };
}
