# ⚡ SplitPay 1999 — Advanced Fintech Treasury & UPI Split Terminal

SplitPay 1999 is an automated UPI payment splitting & multi-bank treasury routing engine. It is engineered for merchants, fintech operators, and businesses that need to separate transactions into safe chunks (e.g. **₹1,999**, **₹4,999**, or custom amounts), balance inflows across multiple bank accounts to stay within daily limits, and clear 100% of the bill without payment friction.

---

## 🎯 Operating Modes

### 1. ⚡ 1-Scan, 1-PIN Auto-Split (Flagship Mode)
- **The Experience:** The customer scans **ONLY ONE QR Code** for the total bill (e.g. ₹3,800) and authorizes their UPI PIN **ONLY ONCE**.
- **The Magic:** Upon authorization, the engine automatically divides the payment into safe **₹1,999 chunks** + remainder (**₹1,801**) and credits them across destination accounts with unique Indian Bank UTR references!
- **Virtual Soundbox:** Dual-chime harmonic bells + natural bilingual (Hindi & English) speech announcements.
- **Interactive UPI MPIN Keypad:** Realistic 6-digit MPIN dialog with NPCI 2FA simulation.
- **Live Bank Credit SMS Alerts:** Floating notification toasts simulating real-time bank credit alerts (e.g., HDFC, ICICI, SBI).

### 2. 🏦 Treasury & Multi-Bank Analytics (Enterprise Mode)
- **Dynamic Multi-Bank Routing**: Add unlimited bank accounts/wallets (HDFC, ICICI, SBI, Axis, Paytm).
- **Automated Routing Strategies**:
  - **Round-Robin**: Distributes chunks evenly across all active accounts.
  - **Daily Limit Cap Overflow**: Automatically routes money away from banks nearing their daily volume limit (e.g. ₹1 Lakh/day) to prevent account freezes.
- **Configurable Chunk Limits**: Preset caps for **₹1,999** (Card-on-UPI limit), **₹4,999** (Instant P2P cap), **₹999** (Micro-transaction), or Custom.
- **Bank Volume Distribution Visualizer**: Interactive color-coded progress bars showing real-time allocation percentage per bank.
- **Reconciliation Audit Trail & CSV Export**: Download RFC-4180 standard reconciliation `.csv` reports with Bank UTRs and NPCI response codes (`00 - APPROVED`).
- **Webhook Simulator**: Test enterprise webhook dispatches with cryptographic HMAC-SHA256 signatures (`x-splitpay-signature`).

### 3. 📱 Sequential Multi-QR (Direct P2P Mode)
- Direct bank-to-bank sequential payment cards with lazy QR loading for direct P2P clearing.

### 4. 🖥️ Merchant Counter POS Kiosk
- Fullscreen auto-advancing counter display for cashiers and point-of-sale terminals.

---

## 🚀 Running the Application

### 1. Start the Server
```bash
node server.js
```

### 2. Access the Application
- **Local Browser**: [http://localhost:3000](http://localhost:3000)
- **Mobile Phone (Same Wi-Fi)**: Open `http://<your-lan-ip>:3000` (e.g. `http://192.168.0.101:3000`). On mobile, tapping UPI buttons directly launches Google Pay, PhonePe, Paytm, or BHIM with the pre-filled amount!

### 3. Run Benchmark & Verification Suite
```bash
node test-treasury.js
node test-big-amount.js
```

---

## 🧩 Project Architecture

```
payment system/
├── package.json               # Project manifest & npm scripts
├── server.js                  # Zero-dependency HTTP server, SVG QR API & webhook simulator
├── test-treasury.js           # Multi-bank routing & webhook test suite
├── test-big-amount.js         # Sub-millisecond calculation benchmark suite
└── public/
    ├── index.html             # Responsive UI (1-Scan 1-PIN + Treasury + POS Kiosk + Scanner)
    ├── css/
    │   └── style.css          # Glassmorphic dark mode design system & SMS alert toasts
    └── js/
        ├── app.js             # Master application state controller & event bindings
        ├── split-engine.js    # Multi-bank routing, O(1) high-volume math & UPI deep links
        ├── soundbox.js        # Virtual UPI Soundbox (Web Audio dual chime + speech synthesizer)
        ├── receipt.js         # Settlement slips, WhatsApp daily digest & RFC-4180 CSV export
        └── vendor/
            └── html5-qrcode.min.js  # Camera & screenshot QR scanner library
```

---

## ⚡ Performance

- **Calculation Complexity:** $O(1)$ constant time math (<0.3ms for ₹10 Crores).
- **Safety Limits:** High-volume executive summaries prevent browser and network socket freezes on large numbers.
- **Network Safety:** Lazy-loads QR images only on demand.
