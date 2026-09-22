# KhataLens — Final Build Prompt & Strategy (v2)
### iQOO Hackathon 2026 · FinTech & Commerce · Hyderabad City Battle (26–27 Sep 2026)

---

## 1. Positioning

**Tagline:** *A khata you don't have to type into.*
**10-second pitch:** *Point. Speak. Confirm. Done.*

**Core paragraph (final):**
> KhataLens is an offline, phone-first AI khata for India's micro-businesses: point the iQOO camera at a handwritten credit note or speak naturally in Hindi, Telugu, or English, and the phone converts it into a verified ledger entry in seconds — without typing or sending financial data to the cloud. The innovation isn't digitizing the khata; it's removing the data-entry step entirely. Every AI-generated transaction passes through a fast human-confirmation step, so the system stays trustworthy even when OCR or speech recognition isn't perfect.

---

## 2. Architecture (final)

```
                    ┌──────────────────────┐
                    │      SHOP OWNER       │
                    └──────────┬───────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
             📷 CAMERA                    🎙️ VOICE
                 │                           │
                 ▼                           ▼
          On-device OCR              On-device ASR
                 │                           │
                 └─────────────┬─────────────┘
                               ▼
                    ┌─────────────────────┐
                    │  LOCAL AI ENGINE     │
                    │  entity extraction   │
                    │  intent detection    │
                    │  amount validation    │
                    │  language handling    │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │  SMART CONFIRMATION  │
                    │  Ramesh · ₹500 · Udhaar │
                    │  ✓ Confirm   ✎ Edit    │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │  LOCAL LEDGER        │
                    │  offline-first DB     │
                    └──────────┬──────────┘
                       │                │
              "Ask my Khata"        Office Kit
              (local NL query)          │
                       │                ▼
                       │      ┌─────────────────────┐
                       │      │       LAPTOP          │
                       └─────▶│  reconciliation        │
                              │  Excel-compatible export│
                              │  daily summary view     │
                              └─────────────────────┘
```

**Recommended concrete stack (lower technical risk, still counts as "local AI"):**
- **OCR:** ML Kit Text Recognition (on-device, offline) for printed/handwritten chits.
- **ASR:** Android's offline speech recognition where the language is supported, with Vosk (offline, has a Hindi model) as fallback for regional languages if the built-in engine falls short.
- **Local LLM for entity extraction / NL queries:** a small quantized model (e.g. Gemma 2B/3 1B) via Google's MediaPipe LLM Inference API / LiteRT — this is explicitly built for on-device Android and gives you a real, documentable "local model" without hand-rolling model deployment during the hackathon.
- **Ledger storage:** local SQLite/Room DB — no server, by design.

Document the actual model, quantization, and measured (not estimated) inference latency for the pitch — a smaller, honestly-benchmarked stack beats a bigger, unverifiable one on both technical depth and credibility.

---

## 3. Trust layer (non-negotiable for a financial product)

- KhataLens never silently commits an AI interpretation as financial fact.
- Every camera/voice transaction shows a structured preview — customer, amount, type, item/category, date — before it's saved.
- If a critical field (amount or customer) is uncertain, the app asks rather than guesses:
  - High confidence: `Ramesh · ₹500 · Udhaar` → **Confirm**
  - Uncertain: `Did you mean...?` → **Confirm / Edit**
  - Missing: `I couldn't identify the amount — please enter it.`
- This is also your strongest answer to the obvious judge question: *"What happens when the AI gets it wrong?"*

---

## 4. Core workflow (build spec)

1. **Voice → Ledger.** Natural speech in Hindi/Telugu/English → on-device ASR → local model extracts `{customer, amount, type, item?, date}` into one structured schema regardless of language.
2. **Camera → Ledger.** Photograph a chit/bill → on-device OCR → local model maps it into the same schema.
3. **Smart Confirmation.** Every extraction is shown, not silently committed (see §3).
4. **Local Ledger.** Fully offline-capable; no account required for core use.
5. **"Ask my Khata."** Natural-language queries against the local ledger only — *"Ramesh ka kitna udhaar hai?"*, *"Aaj kitna credit diya?"*, *"Who owes me the most?"* This is your second demo wow-moment and proves the local model is useful after capture too, not just at input.
6. **Daily summary.** Sales / expenses / credit given / outstanding customers at a glance — turns the app from "an OCR demo" into "a product."
7. **Office Kit.** Deliberate phone→laptop handoff: capture on phone → review today's ledger → connect via Office Kit → transfer structured data → laptop shows a reconciliation dashboard sized for a bigger screen → export Excel/GST-ready sheet. The laptop must add value a phone screen genuinely can't (this is what separates a real workflow from a mirroring gimmick).

---

## 5. Privacy & transparency (part of the pitch, not just the code)

- All ledger data stays on-device by default; no account needed for core offline use.
- No transaction is uploaded anywhere; export via Office Kit is an explicit user action.
- Small "Processed on device" indicator in the UI (🔒 no cloud AI · 📱 local processing · 📡 offline capable), with a real *measured* latency number — never a fabricated one.
- Hardware note for Q&A: "hardware-accelerated inference where supported by the device" — accurate whether or not full NPU delegation is achieved, so you're never caught overclaiming.

---

## 6. Error handling (trimmed to what's buildable in 30 hours)

Core three (build these):
- Unreadable chit → *"I couldn't read this clearly — try moving closer or better light."*
- Unclear speech → *"I couldn't catch the amount — please repeat or type it."*
- Missing customer/amount → explicit prompt rather than a guess.

Nice-to-have if time remains: duplicate-transaction warning ("This looks similar to one recorded 30 seconds ago — add anyway?").

---

## 7. Demo reliability

- Keep a small, rehearsed **demo dataset** (a real handwritten chit, a real printed bill, a couple of scripted voice lines) so the live demo doesn't depend on judging-room lighting or ambient noise.
- Any fallback shown must be clearly the same on-device pipeline, not a pre-recorded fake result — the rule against "cheating/unfair practice" and the spirit of "original work" both matter here, not just the letter of it.
- If you attempt the offline/airplane-mode demo, rehearse it exactly as you'll perform it, and only put it in the actual pitch once it has worked reliably multiple times in a row. If it's shaky, cut it — a confident 3.5-minute pitch beats a live failure.

---

## 8. Build priority (respects the ~55% Red Light / 45% Green Light split)

Do **not** add features at the expense of reliability. Build in this order:

1. Voice → structured ledger → confirmation (phone-only, works in Red Light)
2. Camera/chit → structured ledger → confirmation (phone-only, works in Red Light)
3. Offline operation proof (phone-only)
4. Office Kit phone→laptop workflow (needs Green Light windows — plan this work for when the laptop is unrestricted)
5. "Ask my Khata" natural-language queries
6. Daily summary + polish + optional duplicate-detection

A smaller number of fully reliable workflows beats a longer list of half-working ones — this is also literally what the 30% "does it work / would someone keep using it" criterion is scoring.

---

## 9. Scoring alignment (final)

| Rubric | Weight | What this version demonstrates |
|---|---|---|
| End product quality | 30% | Reliable capture → confirm → ledger → query → export, not just a one-shot OCR demo |
| Novelty & impact | 20% | Removes typing entirely, rather than just digitizing the khata like existing apps |
| Creative phone use | 15% | Camera + mic + local model + offline storage are the product, not decoration |
| Technical depth | 15% | OCR + ASR + local entity extraction + confidence/error handling + honest hardware reporting |
| Office Kit usage | 10% | Genuine phone-captures/laptop-reconciles workflow, not a mirroring gimmick |
| Demo & pitch | 10% | Physical chit → AI → ledger in seconds, live voice input, "Ask my Khata" second wow-moment |

---

## 10. Final build prompt (paste this to your coding assistant / team as the spec)

> Build **KhataLens**, an offline-first Android micro-business khata for the iQOO Hackathon. Core principle: *"A khata you don't have to type into."*
>
> The app must run on the iQOO phone as the primary surface and make meaningful use of its camera, microphone, and on-device AI.
>
> **Core workflow:**
> 1. **Voice → Ledger** — natural speech in Hindi, Telugu, or English via on-device ASR; a local model extracts `{customer, amount, type, item?, date}`.
> 2. **Camera → Ledger** — photograph a handwritten chit or printed bill; on-device OCR + the same local model produce the same structured schema.
> 3. **Smart Confirmation** — never silently commit an AI result. Show `customer · amount · type` with Confirm/Edit. If amount or customer is uncertain or missing, ask explicitly rather than guess.
> 4. **Local Ledger** — store confirmed transactions locally; the entire core workflow must work with no internet connection.
> 5. **"Ask my Khata"** — natural-language queries against the local ledger only (e.g. "Ramesh ka kitna udhaar hai?", "Who owes me the most?").
> 6. **Daily summary** — sales, expenses, credit given, outstanding customers at a glance.
> 7. **Office Kit** — phone captures and stores; laptop provides reconciliation, review, and Excel-compatible export. The laptop step must add value the phone screen can't.
>
> **Privacy:** all data stays on-device by default; no cloud dependency for the core workflow; export is an explicit user action.
>
> **Technical requirements:** use a local/open-source model (e.g. a small quantized model via MediaPipe LLM Inference API / LiteRT) and ML Kit / Vosk for OCR/ASR. Document the actual model, quantization, size, acceleration path, and *measured* inference latency. Never claim NPU acceleration unless it's actually verified — say "hardware-accelerated where supported" if unsure.
>
> **UX:** extremely simple for a non-technical shopkeeper — Speak | Scan | Khata. Every AI result understandable at a glance. Handle: unreadable document, unclear speech, missing amount, missing customer.
>
> **Demo requirements:** handwritten chit → camera → ledger; natural speech (Hindi/Telugu/English) → ledger; confirm/edit; a rehearsed offline transaction if reliably achieved; a natural-language query; Office Kit → laptop reconciliation/export.
>
> **Build priority:** reliability over feature count — voice, then camera, then offline proof, then Office Kit (build during Green Light windows), then queries, then summary/polish. Do not add secondary features if they weaken the core workflows.
>
> **Success criterion:** a judge should understand the whole product within 30 seconds and see clearly why camera + voice + local AI + the iQOO phone are essential — not decorative.

---

*This supersedes the earlier draft. Rules, dates, and prize figures per the official guide at [iqoo.reskilll.com/guide](https://iqoo.reskilll.com/guide) — confirm before build day, since the organizers flag some figures as indicative.*
