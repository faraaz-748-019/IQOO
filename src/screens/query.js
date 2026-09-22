/**
 * KhataLens — "Ask my Khata" Screen
 * Chat-like interface for natural-language queries against the local ledger.
 */
import { processQuery, getSuggestedQueries } from '../ai/query-engine.js';
import { formatCurrency } from '../utils/currency.js';
import { startListening, stopListening, isSpeechAvailable } from '../capture/voice-engine.js';
import { playTap } from '../utils/audio-feedback.js';

let chatHistory = [];

export function renderQuery() {
  const suggestions = getSuggestedQueries();

  return `
    <div class="screen active" id="screen-query">
      <!-- Header -->
      <div class="screen-header">
        <button class="back-btn" onclick="window.app.navigate('home')">←</button>
        <h2 class="screen-title">💬 Ask my Khata</h2>
      </div>

      <!-- Suggestion Chips -->
      <div class="suggestion-chips" id="query-suggestions">
        ${suggestions.map(s => `
          <button class="chip" onclick="window.queryScreen.ask('${s.text}')">
            ${s.text}
          </button>
        `).join('')}
      </div>

      <!-- Chat Container -->
      <div class="chat-container" id="chat-container">
        <!-- Welcome message -->
        <div class="chat-bubble ai">
          <strong>🙏 Namaste!</strong><br>
          Ask me anything about your khata in Hindi, Telugu, or English.<br>
          <span style="font-size: var(--text-sm); color: var(--color-text-tertiary);">
            e.g. "Ramesh ka kitna udhaar hai?"
          </span>
        </div>
      </div>

      <!-- Input Bar -->
      <div class="chat-input-bar">
        <input class="chat-input" id="query-input"
               placeholder="Ask your khata..."
               onkeypress="if(event.key==='Enter') window.queryScreen.submit()" />
        ${isSpeechAvailable() ? `
          <button class="btn btn-icon btn-secondary" id="query-mic" onclick="window.queryScreen.voiceQuery()" style="flex-shrink: 0;">
            🎙️
          </button>
        ` : ''}
        <button class="btn btn-icon btn-primary" onclick="window.queryScreen.submit()" style="flex-shrink: 0;">
          →
        </button>
      </div>
    </div>
  `;
}

export function initQuery() {
  window.queryScreen = {
    async ask(text) {
      const input = document.getElementById('query-input');
      if (input) input.value = text;
      await submitQuery(text);
      playTap();
    },

    async submit() {
      const input = document.getElementById('query-input');
      const text = input?.value?.trim();
      if (!text) return;
      input.value = '';
      await submitQuery(text);
    },

    voiceQuery() {
      const micBtn = document.getElementById('query-mic');

      startListening({
        lang: 'hindi',
        onStart: () => {
          if (micBtn) micBtn.textContent = '⏹️';
        },
        onResult: (text) => {
          if (micBtn) micBtn.textContent = '🎙️';
          const input = document.getElementById('query-input');
          if (input) input.value = text;
          submitQuery(text);
        },
        onError: (msg) => {
          if (micBtn) micBtn.textContent = '🎙️';
          addChatBubble('ai', `⚠️ ${msg}`);
        },
        onEnd: () => {
          if (micBtn) micBtn.textContent = '🎙️';
        }
      });
    }
  };
}

async function submitQuery(text) {
  const container = document.getElementById('chat-container');
  if (!container) return;

  // Add user bubble
  addChatBubble('user', text);

  // Show typing indicator
  const typingId = addTypingIndicator();

  try {
    const result = await processQuery(text);

    // Remove typing indicator
    removeTypingIndicator(typingId);

    // Add AI response
    const responseHtml = formatQueryResponse(result);
    addChatBubble('ai', responseHtml, true);

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  } catch (err) {
    removeTypingIndicator(typingId);
    addChatBubble('ai', '❌ Sorry, something went wrong. Please try again.');
    console.error('Query error:', err);
  }
}

function addChatBubble(type, content, isHtml = false) {
  const container = document.getElementById('chat-container');
  if (!container) return;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${type}`;

  if (isHtml) {
    bubble.innerHTML = content;
  } else {
    bubble.textContent = content;
  }

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;

  chatHistory.push({ type, content });
}

function addTypingIndicator() {
  const container = document.getElementById('chat-container');
  const id = 'typing-' + Date.now();

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ai';
  bubble.id = id;
  bubble.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';

  container?.appendChild(bubble);
  container.scrollTop = container.scrollHeight;

  return id;
}

function removeTypingIndicator(id) {
  document.getElementById(id)?.remove();
}

function formatQueryResponse(result) {
  let html = `<span style="font-size: 1.2rem;">${result.emoji || '📊'}</span> `;

  switch (result.type) {
    case 'amount':
      html += `${result.message}<br>`;
      html += `<strong style="font-size: var(--text-xl); color: var(--color-accent-secondary);">${formatCurrency(result.amount)}</strong>`;
      if (result.detail) {
        html += `<br><span style="font-size: var(--text-xs); color: var(--color-text-tertiary);">${result.detail}</span>`;
      }
      break;

    case 'list':
      html += `${result.message}<br>`;
      if (result.amount !== undefined) {
        html += `<strong style="font-size: var(--text-lg); color: var(--color-accent-secondary);">${formatCurrency(result.amount)}</strong><br>`;
      }
      if (result.listItems) {
        html += '<div style="margin-top: var(--space-sm);">';
        result.listItems.forEach((item, i) => {
          const outstanding = item.amount;
          const color = outstanding > 0 ? 'var(--color-debit)' : 'var(--color-credit)';
          html += `<div style="display: flex; justify-content: space-between; padding: 0.2rem 0; font-size: var(--text-sm);">
            <span>${i + 1}. ${item.name}</span>
            <span style="color: ${color}; font-weight: var(--weight-semibold);">${formatCurrency(outstanding)}</span>
          </div>`;
        });
        html += '</div>';
      }
      break;

    case 'summary':
      html += `<strong>${result.message}</strong><br>`;
      html += `<div style="margin-top: var(--space-sm); font-size: var(--text-sm);">`;
      html += `📝 Transactions: <strong>${result.data.transactions}</strong><br>`;
      html += `📤 Credit Given: <strong style="color: var(--color-debit);">${formatCurrency(result.data.creditGiven)}</strong><br>`;
      html += `📥 Received: <strong style="color: var(--color-credit);">${formatCurrency(result.data.paymentsReceived)}</strong><br>`;
      html += `👥 Outstanding Customers: <strong>${result.data.outstandingCount}</strong>`;
      html += `</div>`;
      break;

    case 'transaction':
      html += `${result.message}<br>`;
      const tx = result.transaction;
      const isCredit = tx.type === 'credit' || tx.type === 'udhaar';
      html += `<div style="margin-top: var(--space-sm); padding: var(--space-sm); background: var(--color-bg-input); border-radius: var(--radius-md);">`;
      html += `<strong>${tx.customer}</strong> · <span style="color: ${isCredit ? 'var(--color-debit)' : 'var(--color-credit)'};">${formatCurrency(tx.amount)}</span> · ${tx.type}`;
      html += `</div>`;
      break;

    case 'history':
      html += `${result.message}<br>`;
      if (result.transactions) {
        html += '<div style="margin-top: var(--space-sm); font-size: var(--text-sm);">';
        result.transactions.forEach(tx => {
          const isCredit = tx.type === 'credit' || tx.type === 'udhaar';
          const color = isCredit ? 'var(--color-debit)' : 'var(--color-credit)';
          html += `<div style="display: flex; justify-content: space-between; padding: 0.2rem 0; border-bottom: 1px solid var(--color-border);">
            <span>${tx.date} · ${tx.type}</span>
            <span style="color: ${color}; font-weight: var(--weight-semibold);">${formatCurrency(tx.amount)}</span>
          </div>`;
        });
        html += '</div>';
      }
      break;

    case 'text':
    default:
      html += result.message;
      if (result.detail) {
        html += `<br><span style="font-size: var(--text-xs); color: var(--color-text-tertiary);">${result.detail}</span>`;
      }
      if (result.suggestions) {
        html += '<div style="margin-top: var(--space-sm);">';
        result.suggestions.forEach(s => {
          html += `<div style="font-size: var(--text-sm); color: var(--color-accent-secondary); cursor: pointer; padding: 0.15rem 0;"
                       onclick="window.queryScreen.ask(${JSON.stringify(s.replace(/"/g, ''))})">${s}</div>`;
        });
        html += '</div>';
      }
      break;
  }

  return html;
}
