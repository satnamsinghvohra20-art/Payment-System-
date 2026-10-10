/**
 * SplitPay Master Application Controller — Advanced Fintech Treasury Edition
 */

class SplitPayApp {
  constructor() {
    this.splitEngine = new window.SplitEngine(1999);
    this.soundbox = new window.Soundbox();
    
    // Application State
    const savedAccounts = localStorage.getItem('splitpay_treasury_accounts');
    const savedAudit = localStorage.getItem('splitpay_audit_log');

    this.state = {
      mode: 'smart', // 'smart' | 'customer' | 'kiosk' | 'treasury'
      splitLimit: 1999,
      totalAmount: 3800,
      routingRule: localStorage.getItem('splitpay_routing_rule') || 'round_robin',
      accounts: savedAccounts ? JSON.parse(savedAccounts) : this.splitEngine.defaultAccounts,
      reconciliationLog: savedAudit ? JSON.parse(savedAudit) : this.getInitialAuditLogs(),
      addedItems: [
        { id: 'item_1', amount: 3800, label: 'Base Bill' }
      ],
      merchant: {
        vpa: 'satnam.store@okhdfcbank',
        secondaryVpa: 'satnam.secondary@okicici',
        name: 'Satnam Enterprise',
        note: 'Order Settlement'
      },
      smartPlan: null,
      enteredPin: '',
      currentCalculation: null,
      activeSplitIndex: 0,
      scannerActive: false,
      autoAdvance: true
    };

    this.qrScanner = null;
    this.dom = {};
  }

  getInitialAuditLogs() {
    const datePrefix = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    return [
      {
        txRef: 'MST_MV2OCUMW',
        orderId: 'ORD_94821',
        splitPart: 'Part 1 of 2',
        accountName: 'Primary Current A/C (HDFC)',
        bankCode: 'HDFC',
        vpa: 'satnam.store@okhdfcbank',
        amount: 1999.00,
        utr: `${datePrefix}1849182`,
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toLocaleTimeString('en-IN')
      },
      {
        txRef: 'MST_MV2OCUMW',
        orderId: 'ORD_94821',
        splitPart: 'Part 2 of 2',
        accountName: 'Secondary Business A/C (ICICI)',
        bankCode: 'ICICI',
        vpa: 'satnam.secondary@okicici',
        amount: 1801.00,
        utr: `${datePrefix}2938192`,
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toLocaleTimeString('en-IN')
      },
      {
        txRef: 'MST_KL8912AA',
        orderId: 'ORD_94820',
        splitPart: 'Part 1 of 3',
        accountName: 'Reserve Escrow A/C (SBI)',
        bankCode: 'SBI',
        vpa: 'satnam.escrow@oksbi',
        amount: 1999.00,
        utr: `${datePrefix}3718291`,
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toLocaleTimeString('en-IN')
      },
      {
        txRef: 'MST_KL8912AA',
        orderId: 'ORD_94820',
        splitPart: 'Part 2 of 3',
        accountName: 'Primary Current A/C (HDFC)',
        bankCode: 'HDFC',
        vpa: 'satnam.store@okhdfcbank',
        amount: 1999.00,
        utr: `${datePrefix}4829102`,
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toLocaleTimeString('en-IN')
      },
      {
        txRef: 'MST_KL8912AA',
        orderId: 'ORD_94820',
        splitPart: 'Part 3 of 3',
        accountName: 'Secondary Business A/C (ICICI)',
        bankCode: 'ICICI',
        vpa: 'satnam.secondary@okicici',
        amount: 1002.00,
        utr: `${datePrefix}5910293`,
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toLocaleTimeString('en-IN')
      }
    ];
  }

  init() {
    this.cacheDom();
    this.bindEvents();
    this.fetchServerInfo();
    this.fetchMerchantConfig();
    this.renderAddedItems();
    this.calculateAndRender();
  }

  cacheDom() {
    this.dom = {
      // Inputs & Add Amount
      totalAmountInput: document.getElementById('totalAmountInput'),
      addAmountInput: document.getElementById('addAmountInput'),
      addAmountBtn: document.getElementById('addAmountBtn'),
      clearAmountBtn: document.getElementById('clearAmountBtn'),
      addedItemsContainer: document.getElementById('addedItemsContainer'),
      addedItemsBadges: document.getElementById('addedItemsBadges'),
      splitLimitInput: document.getElementById('splitLimitInput'),
      merchantVpaInput: document.getElementById('merchantVpaInput'),
      secondaryVpaInput: document.getElementById('secondaryVpaInput'),
      merchantNameInput: document.getElementById('merchantNameInput'),

      // 1-Scan 1-PIN Flagship Elements
      smartSection: document.getElementById('smartSection'),
      smartMasterQrContainer: document.getElementById('smartMasterQrContainer'),
      smartMasterAmountDisplay: document.getElementById('smartMasterAmountDisplay'),
      smartMasterUpiBtn: document.getElementById('smartMasterUpiBtn'),
      smartPartsContainer: document.getElementById('smartPartsContainer'),
      smartPartsCountBadge: document.getElementById('smartPartsCountBadge'),
      smartSettlementBanner: document.getElementById('smartSettlementBanner'),
      smartSettlementSubtitle: document.getElementById('smartSettlementSubtitle'),
      openPinModalBtn: document.getElementById('openPinModalBtn'),

      // Interactive PIN Modal Elements
      pinModal: document.getElementById('pinModal'),
      pinModalAmount: document.getElementById('pinModalAmount'),
      pinMerchantName: document.getElementById('pinMerchantName'),
      pinDotsRow: document.getElementById('pinDotsRow'),
      submitPinBtn: document.getElementById('submitPinBtn'),
      pinStatusMsg: document.getElementById('pinStatusMsg'),

      // Displays (Customer Sequential Mode)
      totalBillDisplay: document.getElementById('totalBillDisplay'),
      splitsCountBadge: document.getElementById('splitsCountBadge'),
      progressFill: document.getElementById('progressFill'),
      progressText: document.getElementById('progressText'),
      progressPercentage: document.getElementById('progressPercentage'),
      splitsContainer: document.getElementById('splitsContainer'),

      // Kiosk Elements
      kioskSection: document.getElementById('kioskSection'),
      customerSection: document.getElementById('customerSection'),
      kioskSplitTitle: document.getElementById('kioskSplitTitle'),
      kioskAmountDisplay: document.getElementById('kioskAmountDisplay'),
      kioskQrContainer: document.getElementById('kioskQrContainer'),
      kioskStatusBadge: document.getElementById('kioskStatusBadge'),
      kioskProgressFill: document.getElementById('kioskProgressFill'),
      kioskNextHint: document.getElementById('kioskNextHint'),

      // Treasury & Analytics Elements
      treasurySection: document.getElementById('treasurySection'),
      kpiTotalVolume: document.getElementById('kpiTotalVolume'),
      kpiTotalSplits: document.getElementById('kpiTotalSplits'),
      kpiActiveBanks: document.getElementById('kpiActiveBanks'),
      kpiMdrSavings: document.getElementById('kpiMdrSavings'),
      treasuryAllocationBars: document.getElementById('treasuryAllocationBars'),
      treasuryAccountsGrid: document.getElementById('treasuryAccountsGrid'),
      auditTableBody: document.getElementById('auditTableBody'),
      webhookEndpointInput: document.getElementById('webhookEndpointInput'),
      webhookResultBox: document.getElementById('webhookResultBox'),
      webhookPayloadCode: document.getElementById('webhookPayloadCode'),
      webhookDeliveryTime: document.getElementById('webhookDeliveryTime'),
      addBankModal: document.getElementById('addBankModal'),
      bankAlertsContainer: document.getElementById('bankAlertsContainer'),

      // Scanner
      scannerContainer: document.getElementById('scannerContainer'),
      scannerToggleBtn: document.getElementById('scannerToggleBtn'),
      fileInput: document.getElementById('qrFileInput'),

      // Network & Audio
      lanBadge: document.getElementById('lanBadge'),
      soundToggleBtn: document.getElementById('soundToggleBtn'),
      langToggleBtn: document.getElementById('langToggleBtn'),
      confettiCanvas: document.getElementById('confettiCanvas'),

      // Voice Hands-Free Assistant
      voiceCommandBtn: document.getElementById('voiceCommandBtn'),
      voiceFeedbackPill: document.getElementById('voiceFeedbackPill'),
      voiceFeedbackText: document.getElementById('voiceFeedbackText'),

      // 3D Hardware Soundbox 4G Device
      soundboxLcdAmount: document.getElementById('soundboxLcdAmount'),
      soundboxLcdStatus: document.getElementById('soundboxLcdStatus'),
      soundboxLcdVolume: document.getElementById('soundboxLcdVolume'),
      soundboxSpeakerArea: document.getElementById('soundboxSpeakerArea'),
      soundboxLedRing: document.getElementById('soundboxLedRing'),
      hwReplayBtn: document.getElementById('hwReplayBtn'),
      hwChimeBtn: document.getElementById('hwChimeBtn'),
      hwVolUpBtn: document.getElementById('hwVolUpBtn'),
      hwVolDownBtn: document.getElementById('hwVolDownBtn'),

      // Customer Smartphone Simulator Mirror
      togglePhoneMirrorBtn: document.getElementById('togglePhoneMirrorBtn'),
      phoneMirrorModal: document.getElementById('phoneMirrorModal'),
      phoneLiveClock: document.getElementById('phoneLiveClock'),
      phoneMerchantName: document.getElementById('phoneMerchantName'),
      phoneMerchantVpa: document.getElementById('phoneMerchantVpa'),
      phoneAmountVal: document.getElementById('phoneAmountVal'),
      phonePayBtnAmount: document.getElementById('phonePayBtnAmount'),
      phoneSplitHint: document.getElementById('phoneSplitHint'),
      phonePayNowBtn: document.getElementById('phonePayNowBtn'),
      phoneSuccessOverlay: document.getElementById('phoneSuccessOverlay'),
      phonePaidSuccessAmount: document.getElementById('phonePaidSuccessAmount'),
      phoneSuccessUtrText: document.getElementById('phoneSuccessUtrText'),
      phoneSuccessSplits: document.getElementById('phoneSuccessSplits'),

      // Gateway Configuration & Pipeline
      gatewayConfigModal: document.getElementById('gatewayConfigModal'),
      gatewayConfigBtn: document.getElementById('gatewayConfigBtn'),
      activeGatewayDot: document.getElementById('activeGatewayDot'),
      activeGatewayText: document.getElementById('activeGatewayText'),
      gatewaySelect: document.getElementById('gatewaySelect'),
      liveCredentialsFields: document.getElementById('liveCredentialsFields'),
      gatewayAppIdInput: document.getElementById('gatewayAppIdInput'),
      gatewaySecretKeyInput: document.getElementById('gatewaySecretKeyInput'),
      gatewayWebhookSecretInput: document.getElementById('gatewayWebhookSecretInput'),
      webhookIngressUrl: document.getElementById('webhookIngressUrl'),

      // Commercial SaaS Pricing & ROI Calculator
      saasPricingModal: document.getElementById('saasPricingModal'),
      roiVolumeInput: document.getElementById('roiVolumeInput'),
      roiMdrSaved: document.getElementById('roiMdrSaved'),
      roiNetSaved: document.getElementById('roiNetSaved')
    };
  }

  bindEvents() {
    // Direct Total Amount Change Listener (Debounced to prevent freezing)
    this._amountDebounce = null;
    this.dom.totalAmountInput.addEventListener('input', (e) => {
      const val = Math.max(0, parseFloat(e.target.value) || 0);
      this.state.totalAmount = val;
      this.state.addedItems = val > 0 ? [{ id: 'manual_' + Date.now(), amount: val, label: 'Entered' }] : [];
      this.renderAddedItems();
      
      clearTimeout(this._amountDebounce);
      this._amountDebounce = setTimeout(() => {
        this.calculateAndRender();
      }, 120);
    });

    // Dedicated "Enter Amount to Add" Listeners
    if (this.dom.addAmountBtn && this.dom.addAmountInput) {
      this.dom.addAmountBtn.addEventListener('click', () => {
        this.handleAddAmount();
      });

      this.dom.addAmountInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleAddAmount();
        }
      });
    }

    // Clear Bill Amount Button
    if (this.dom.clearAmountBtn) {
      this.dom.clearAmountBtn.addEventListener('click', () => {
        this.handleClearAmount();
      });
    }

    // Quick Add Increment Buttons (+₹100, +₹500, +₹1,000, +₹1,999, etc.)
    document.querySelectorAll('.quick-add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const addVal = parseFloat(btn.dataset.add) || 0;
        this.handleQuickAdd(addVal);
      });
    });

    // Preset Amount Chips (Replace Total)
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const amt = parseFloat(btn.dataset.amount);
        this.dom.totalAmountInput.value = amt;
        this.state.totalAmount = amt;
        this.state.addedItems = [{ id: 'preset_' + Date.now(), amount: amt, label: 'Preset' }];
        this.renderAddedItems();
        this.calculateAndRender();
      });
    });

    // Split Chunk Limit Cap Presets (₹1,999, ₹4,999, ₹999)
    document.querySelectorAll('.chunk-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chunk-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const chunkVal = parseFloat(btn.dataset.chunk) || 1999;
        this.state.splitLimit = chunkVal;
        if (this.dom.splitLimitInput) this.dom.splitLimitInput.value = chunkVal;
        const badge = document.getElementById('activeChunkCapBadge');
        if (badge) badge.textContent = `₹${chunkVal.toLocaleString('en-IN')} / chunk`;
        this.soundbox.playBeep();
        this.calculateAndRender();
      });
    });

    // Routing Strategy Rule Presets
    document.querySelectorAll('.routing-rule-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.routing-rule-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.routingRule = btn.dataset.rule;
        localStorage.setItem('splitpay_routing_rule', this.state.routingRule);
        this.soundbox.playBeep();
        this.calculateAndRender();
      });
    });

    // Split Limit Manual Input
    this.dom.splitLimitInput.addEventListener('change', (e) => {
      this.state.splitLimit = Math.max(1, parseFloat(e.target.value) || 1999);
      const badge = document.getElementById('activeChunkCapBadge');
      if (badge) badge.textContent = `₹${this.state.splitLimit.toLocaleString('en-IN')} / chunk`;
      this.calculateAndRender();
    });

    // Merchant Info Changes
    this.dom.merchantVpaInput.addEventListener('change', (e) => {
      this.state.merchant.vpa = e.target.value.trim() || 'satnam.store@okhdfcbank';
      this.calculateAndRender();
    });
    this.dom.secondaryVpaInput.addEventListener('change', (e) => {
      this.state.merchant.secondaryVpa = e.target.value.trim() || 'satnam.secondary@okicici';
      this.calculateAndRender();
    });
    this.dom.merchantNameInput.addEventListener('change', (e) => {
      this.state.merchant.name = e.target.value.trim() || 'Satnam Enterprise';
      this.calculateAndRender();
    });

    // View Mode Tabs Switcher
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const targetMode = tab.dataset.mode;
        this.toggleViewMode(targetMode);
      });
    });

    // 1-PIN Modal Triggers
    if (this.dom.openPinModalBtn) {
      this.dom.openPinModalBtn.addEventListener('click', () => {
        this.openPinModal();
      });
    }

    // PIN Keypad Button clicks
    document.querySelectorAll('.pin-keypad .key-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.handlePinKey(btn.dataset.key);
      });
    });

    if (this.dom.submitPinBtn) {
      this.dom.submitPinBtn.addEventListener('click', () => {
        this.submitPin();
      });
    }

    // Keyboard support for PIN entry
    window.addEventListener('keydown', (e) => {
      if (this.dom.pinModal && this.dom.pinModal.style.display !== 'none') {
        if (e.key >= '0' && e.key <= '9') {
          this.handlePinKey(e.key);
        } else if (e.key === 'Backspace') {
          this.handlePinKey('back');
        } else if (e.key === 'Enter') {
          this.submitPin();
        } else if (e.key === 'Escape') {
          this.closePinModal();
        }
      }
    });

    // Soundbox Controls
    this.dom.soundToggleBtn.addEventListener('click', () => {
      this.soundbox.enabled = !this.soundbox.enabled;
      this.dom.soundToggleBtn.classList.toggle('active', this.soundbox.enabled);
      this.dom.soundToggleBtn.innerHTML = this.soundbox.enabled ? '🔊' : '🔇';
      if (this.soundbox.enabled) {
        this.soundbox.playBeep();
      }
    });

    this.dom.langToggleBtn.addEventListener('click', () => {
      this.soundbox.voiceLang = this.soundbox.voiceLang === 'en' ? 'hi' : 'en';
      this.dom.langToggleBtn.textContent = this.soundbox.voiceLang === 'en' ? 'EN' : 'हिन्दी';
      this.soundbox.announcePayment(1999, false);
    });

    // Scanner Toggles
    this.dom.scannerToggleBtn.addEventListener('click', () => {
      this.toggleCameraScanner();
    });

    this.dom.fileInput.addEventListener('change', (e) => {
      this.handleQrFileUpload(e);
    });

    // Voice Hands-Free Assistant Button
    if (this.dom.voiceCommandBtn) {
      this.dom.voiceCommandBtn.addEventListener('click', () => {
        this.initVoiceCommands();
      });
    }

    // 3D Hardware Soundbox Physical Buttons
    if (this.dom.hwReplayBtn) {
      this.dom.hwReplayBtn.addEventListener('click', () => {
        this.soundbox.replayLastAnnouncement();
      });
    }

    if (this.dom.hwChimeBtn) {
      this.dom.hwChimeBtn.addEventListener('click', () => {
        this.soundbox.playChime();
      });
    }

    if (this.dom.hwVolUpBtn) {
      this.dom.hwVolUpBtn.addEventListener('click', () => {
        const newVol = this.soundbox.setVolume(this.soundbox.volume + 0.1);
        if (this.dom.soundboxLcdVolume) {
          this.dom.soundboxLcdVolume.textContent = `VOL: ${Math.round(newVol * 100)}%`;
        }
        this.soundbox.playBeep();
      });
    }

    if (this.dom.hwVolDownBtn) {
      this.dom.hwVolDownBtn.addEventListener('click', () => {
        const newVol = this.soundbox.setVolume(this.soundbox.volume - 0.1);
        if (this.dom.soundboxLcdVolume) {
          this.dom.soundboxLcdVolume.textContent = `VOL: ${Math.round(newVol * 100)}%`;
        }
        this.soundbox.playBeep();
      });
    }

    // Customer Smartphone Mirror Header Toggle
    if (this.dom.togglePhoneMirrorBtn) {
      this.dom.togglePhoneMirrorBtn.addEventListener('click', () => {
        this.togglePhoneMirror();
      });
    }
  }

  fetchServerInfo() {
    fetch('/api/info')
      .then(r => r.json())
      .then(info => {
        if (this.dom.lanBadge && info.lanUrl) {
          this.dom.lanBadge.innerHTML = `🌐 Mobile LAN: <strong>${info.lanUrl}</strong>`;
        }
      })
      .catch(() => {});
  }

  handleAddAmount() {
    if (!this.dom.addAmountInput) return;
    const addVal = parseFloat(this.dom.addAmountInput.value);
    if (!addVal || addVal <= 0) {
      this.dom.addAmountInput.focus();
      return;
    }

    this.state.totalAmount = parseFloat((this.state.totalAmount + addVal).toFixed(2));
    this.state.addedItems.push({
      id: 'add_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      amount: addVal
    });

    this.dom.totalAmountInput.value = this.state.totalAmount;
    this.dom.addAmountInput.value = '';
    this.dom.addAmountInput.focus();
    this.soundbox.playBeep();

    this.renderAddedItems();
    this.calculateAndRender();
  }

  handleQuickAdd(addVal) {
    if (!addVal || addVal <= 0) return;
    this.state.totalAmount = parseFloat((this.state.totalAmount + addVal).toFixed(2));
    this.state.addedItems.push({
      id: 'quick_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      amount: addVal
    });

    this.dom.totalAmountInput.value = this.state.totalAmount;
    this.soundbox.playBeep();

    this.renderAddedItems();
    this.calculateAndRender();
  }

  handleClearAmount() {
    this.state.totalAmount = 0;
    this.state.addedItems = [];
    this.dom.totalAmountInput.value = 0;
    if (this.dom.addAmountInput) this.dom.addAmountInput.value = '';
    this.soundbox.playBeep();

    this.renderAddedItems();
    this.calculateAndRender();
  }

  removeAddedItem(id) {
    const idx = this.state.addedItems.findIndex(i => i.id === id);
    if (idx !== -1) {
      const removed = this.state.addedItems[idx];
      this.state.totalAmount = Math.max(0, parseFloat((this.state.totalAmount - removed.amount).toFixed(2)));
      this.state.addedItems.splice(idx, 1);
      this.dom.totalAmountInput.value = this.state.totalAmount;
      this.soundbox.playBeep();

      this.renderAddedItems();
      this.calculateAndRender();
    }
  }

  renderAddedItems() {
    if (!this.dom.addedItemsContainer || !this.dom.addedItemsBadges) return;

    if (!this.state.addedItems || this.state.addedItems.length === 0) {
      this.dom.addedItemsContainer.style.display = 'none';
      this.dom.addedItemsBadges.innerHTML = '';
      return;
    }

    this.dom.addedItemsContainer.style.display = 'block';
    this.dom.addedItemsBadges.innerHTML = this.state.addedItems.map(item => `
      <span class="added-badge">
        <span>+₹${Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(item.amount) ? 0 : 2 })}</span>
        <button type="button" class="badge-remove" onclick="app.removeAddedItem('${item.id}')" title="Remove ₹${item.amount}">✕</button>
      </span>
    `).join('');
  }

  toggleViewMode(forcedMode) {
    if (forcedMode) {
      this.state.mode = forcedMode;
      document.querySelectorAll('.mode-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.mode === forcedMode);
      });
    }

    if (this.dom.smartSection) this.dom.smartSection.style.display = 'none';
    if (this.dom.customerSection) this.dom.customerSection.style.display = 'none';
    if (this.dom.kioskSection) this.dom.kioskSection.style.display = 'none';
    if (this.dom.treasurySection) this.dom.treasurySection.style.display = 'none';

    if (this.state.mode === 'smart') {
      if (this.dom.smartSection) this.dom.smartSection.style.display = 'block';
      this.renderSmartView();
    } else if (this.state.mode === 'kiosk') {
      if (this.dom.kioskSection) this.dom.kioskSection.style.display = 'block';
      this.renderKioskActiveSplit();
    } else if (this.state.mode === 'treasury') {
      if (this.dom.treasurySection) this.dom.treasurySection.style.display = 'block';
      this.renderTreasuryView();
    } else {
      if (this.dom.customerSection) this.dom.customerSection.style.display = 'block';
      this.renderCustomerSplits();
    }
  }

  calculateAndRender() {
    // 1. Calculate Sequential splits
    const calc = this.splitEngine.calculateSplits(
      this.state.totalAmount,
      this.state.splitLimit,
      this.state.merchant
    );

    // Retain completed states if total didn't change radically
    if (this.state.currentCalculation && 
        this.state.currentCalculation.totalAmount === calc.totalAmount &&
        this.state.currentCalculation.splits.length === calc.splits.length) {
      calc.splits.forEach((s, idx) => {
        const prev = this.state.currentCalculation.splits[idx];
        if (prev && prev.status === 'completed') {
          s.status = 'completed';
          s.paidAt = prev.paidAt;
          s.utr = prev.utr;
        }
      });
    }
    this.state.currentCalculation = calc;

    // 2. Calculate 1-Scan 1-PIN Treasury Smart Master Plan
    const prevSmartSettled = this.state.smartPlan && this.state.smartPlan.status === 'completed' && this.state.smartPlan.totalAmount === this.state.totalAmount;
    
    const smartPlan = this.splitEngine.calculateSmartMasterPlan(
      this.state.totalAmount,
      this.state.splitLimit,
      {
        primaryVpa: this.state.merchant.vpa,
        secondaryVpa: this.state.merchant.secondaryVpa,
        name: this.state.merchant.name,
        accounts: this.state.accounts,
        routingRule: this.state.routingRule,
        note: 'Treasury Split Settlement'
      }
    );

    if (prevSmartSettled) {
      this.splitEngine.executeSmartSplit(smartPlan);
    }
    this.state.smartPlan = smartPlan;

    // Determine current active split for sequential mode
    const firstPendingIdx = calc.splits.findIndex(s => s.status !== 'completed');
    this.state.activeSplitIndex = firstPendingIdx === -1 ? calc.splits.length - 1 : firstPendingIdx;

    this.updateProgress();

    // Sync 3D Hardware Soundbox LCD Display
    if (this.dom.soundboxLcdAmount) {
      this.dom.soundboxLcdAmount.textContent = smartPlan.totalAmount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }
    if (this.dom.soundboxLcdStatus) {
      this.dom.soundboxLcdStatus.textContent = smartPlan.status === 'completed' ? 'RECEIVED & SPLIT' : 'AWAITING 1-PIN PAYMENT';
    }

    // Sync Customer Smartphone Simulator
    this.syncCustomerPhoneScreen();

    // Render active view
    if (this.state.mode === 'smart') {
      this.renderSmartView();
    } else if (this.state.mode === 'kiosk') {
      this.renderKioskActiveSplit();
    } else if (this.state.mode === 'treasury') {
      this.renderTreasuryView();
    } else {
      this.renderCustomerSplits();
    }
  }

  renderSmartView() {
    const plan = this.state.smartPlan;
    if (!plan || !this.dom.smartSection) return;

    // Total Amount Display
    if (this.dom.smartMasterAmountDisplay) {
      this.dom.smartMasterAmountDisplay.textContent = plan.totalAmount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    // Master Unified QR Code (SVG)
    if (this.dom.smartMasterQrContainer && plan.masterQr) {
      const qrUrl = `/api/qr?text=${encodeURIComponent(plan.masterQr.upiUrl)}&size=240`;
      this.dom.smartMasterQrContainer.innerHTML = `
        <img src="${qrUrl}" alt="1-Scan 1-PIN Master QR" style="width: 240px; height: 240px;" />
      `;
    }

    // UPI Deep-link Button
    if (this.dom.smartMasterUpiBtn && plan.masterQr) {
      this.dom.smartMasterUpiBtn.href = plan.masterQr.upiUrl;
      this.dom.smartMasterUpiBtn.innerHTML = `🚀 Open in UPI App (Pay ${this.formatCurrency(plan.totalAmount)})`;
    }

    // Parts Count Badge
    if (this.dom.smartPartsCountBadge) {
      const count = plan.summary.totalSplits;
      this.dom.smartPartsCountBadge.textContent = `${count.toLocaleString('en-IN')} Auto-Split Parts`;
    }

    // Dynamic Parts Grid
    if (this.dom.smartPartsContainer) {
      if (!plan.splits || plan.splits.length === 0) {
        this.dom.smartPartsContainer.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">
            Enter an amount to see the auto-division plan.
          </div>
        `;
      } else {
        const isAllSettled = plan.status === 'completed';
        let html = '';

        // Executive Ledger Banner for High Volume
        if (plan.isHighVolume) {
          html += `
            <div class="card" style="grid-column: 1 / -1; background: linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(99, 102, 241, 0.08)); border-color: rgba(6, 182, 212, 0.3); padding: 1.25rem;">
              <div class="flex-between" style="margin-bottom: 0.75rem;">
                <span class="badge badge-success font-bold" style="padding: 0.3rem 0.7rem; font-size: 0.8rem;">
                  ⚡ High-Volume Treasury Ledger (${plan.summary.totalSplits.toLocaleString('en-IN')} Total Splits)
                </span>
                <span class="text-xs text-muted">Auto-Optimized O(1) Engine</span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin-bottom: 1rem;">
                <div style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: var(--radius-sm); border-left: 3px solid var(--cyan);">
                  <div class="text-xs text-muted">Standard ₹${plan.summary.chunkAmount} Chunks</div>
                  <div style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin: 0.25rem 0;">
                    ${plan.summary.fullChunkCount.toLocaleString('en-IN')} Chunks
                  </div>
                  <div class="text-xs text-muted">₹${plan.summary.totalFromFullChunks.toLocaleString('en-IN')} Settled</div>
                </div>
                ${plan.summary.remainderAmount > 0 ? `
                <div style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: var(--radius-sm); border-left: 3px solid var(--primary-light);">
                  <div class="text-xs text-muted">Remaining Balance</div>
                  <div style="font-size: 1.15rem; font-weight: 700; color: var(--primary-light); margin: 0.25rem 0;">
                    ₹${plan.summary.remainderAmount.toLocaleString('en-IN')}
                  </div>
                  <div class="text-xs text-muted">Final Balance Chunk</div>
                </div>
                ` : ''}
                <div style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: var(--radius-sm); border-left: 3px solid var(--indigo);">
                  <div class="text-xs text-muted">Treasury Accounts</div>
                  <div style="font-size: 1rem; font-weight: 700; color: var(--text-main); margin: 0.25rem 0;">
                    ${plan.accounts.length} Active Bank Nodes
                  </div>
                  <div class="text-xs text-muted">Strategy: ${this.state.routingRule === 'round_robin' ? 'Round-Robin' : 'Limit Cap'}</div>
                </div>
              </div>
              <p class="text-xs text-muted" style="line-height: 1.5;">
                🛡️ <strong>Single PIN Advantage:</strong> Authorize only <strong>once</strong> for ₹${plan.totalAmount.toLocaleString('en-IN')}. All <strong>${plan.summary.totalSplits.toLocaleString('en-IN')}</strong> parts will be auto-divided across bank nodes upon arrival. Sample parts preview below:
              </p>
            </div>
          `;
        }

        html += plan.splits.map((split, idx) => {
          const isSettled = split.status === 'completed' || isAllSettled;
          return `
            <div class="smart-part-card ${isSettled ? 'settled' : ''}" id="smart-part-${idx}">
              <div class="part-header">
                <span class="part-label">${split.label}</span>
                <span class="part-badge ${split.isRemainder ? 'remainder' : 'chunk'}">
                  ${split.badge}
                </span>
              </div>
              <div class="part-amount">
                <span class="rupee">₹</span>${split.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div class="part-dest-box">
                <div class="part-dest-title">Receiving Bank Node:</div>
                <div style="font-weight: 600; color: var(--text-main); margin: 0.15rem 0;">
                  🏦 ${split.recipientName}
                </div>
                <div class="part-dest-vpa">${split.recipientVpa}</div>
              </div>
              <div class="part-status-row">
                <span class="badge ${isSettled ? 'badge-success' : 'badge-warning'}">
                  ${isSettled ? '✓ RECEIVED & CREDITED' : '⏳ Awaiting 1-PIN Auth'}
                </span>
                ${isSettled && split.utr ? `<span class="text-xs text-muted">UTR: <strong>${split.utr}</strong></span>` : ''}
              </div>
            </div>
          `;
        }).join('');

        this.dom.smartPartsContainer.innerHTML = html;
      }
    }

    // Settlement Result Banner
    if (this.dom.smartSettlementBanner) {
      if (plan.status === 'completed') {
        this.dom.smartSettlementBanner.style.display = 'flex';
        if (this.dom.smartSettlementSubtitle) {
          this.dom.smartSettlementSubtitle.textContent = `Total bill ₹${plan.totalAmount.toLocaleString('en-IN')} divided and received across destination bank nodes with 1 PIN.`;
        }
      } else {
        this.dom.smartSettlementBanner.style.display = 'none';
      }
    }
  }

  // Interactive PIN Modal Handlers
  openPinModal() {
    if (!this.state.smartPlan || this.state.smartPlan.totalAmount <= 0) {
      alert('Please enter a valid bill amount first.');
      return;
    }
    this.state.enteredPin = '';
    this.updatePinDots();
    if (this.dom.pinModalAmount) {
      this.dom.pinModalAmount.textContent = this.state.smartPlan.totalAmount.toLocaleString('en-IN', {
        minimumFractionDigits: 2
      });
    }
    if (this.dom.pinMerchantName) {
      this.dom.pinMerchantName.textContent = this.state.merchant.name;
    }
    if (this.dom.pinStatusMsg) {
      this.dom.pinStatusMsg.style.display = 'none';
      this.dom.pinStatusMsg.textContent = '';
    }
    if (this.dom.submitPinBtn) {
      this.dom.submitPinBtn.disabled = false;
      this.dom.submitPinBtn.textContent = '✓ Authorize & Execute Split';
    }
    if (this.dom.pinModal) {
      this.dom.pinModal.style.display = 'flex';
    }
    this.soundbox.playBeep();
  }

  closePinModal() {
    if (this.dom.pinModal) {
      this.dom.pinModal.style.display = 'none';
    }
  }

  handlePinKey(key) {
    if (key === 'clear') {
      this.state.enteredPin = '';
    } else if (key === 'back') {
      this.state.enteredPin = this.state.enteredPin.slice(0, -1);
    } else if (typeof key === 'string' && key.length === 1 && key >= '0' && key <= '9') {
      if (this.state.enteredPin.length < 6) {
        this.state.enteredPin += key;
        this.soundbox.playBeep();
      }
    }
    this.updatePinDots();

    if (this.state.enteredPin.length === 6) {
      setTimeout(() => this.submitPin(), 200);
    }
  }

  updatePinDots() {
    if (!this.dom.pinDotsRow) return;
    const dots = this.dom.pinDotsRow.querySelectorAll('.pin-dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('filled', idx < this.state.enteredPin.length);
    });
  }

  submitPin() {
    if (!this.state.smartPlan) return;

    if (this.dom.pinStatusMsg) {
      this.dom.pinStatusMsg.style.display = 'block';
      this.dom.pinStatusMsg.style.color = 'var(--cyan)';
      this.dom.pinStatusMsg.innerHTML = '<span class="pulse-dot"></span> Authenticating with NPCI UPI 2FA...';
    }
    if (this.dom.submitPinBtn) {
      this.dom.submitPinBtn.disabled = true;
    }

    setTimeout(() => {
      if (this.dom.pinStatusMsg) {
        this.dom.pinStatusMsg.style.color = 'var(--success)';
        this.dom.pinStatusMsg.innerHTML = '✓ 1-PIN Approved! Dividing payment on receipt...';
      }

      // Execute Smart Split division
      this.splitEngine.executeSmartSplit(this.state.smartPlan);

      // Trigger multi-part soundbox voice announcement
      this.soundbox.announceSmartSplit(
        this.state.smartPlan.splits,
        this.state.smartPlan.totalAmount
      );

      // Trigger Floating NPCI Simulated Bank Credit Alerts & record audit
      const plan = this.state.smartPlan;
      const orderId = 'ORD_' + Math.floor(10000 + Math.random() * 90000);
      const alertSamples = plan.splits.slice(0, 3);

      alertSamples.forEach((s, idx) => {
        setTimeout(() => {
          this.showBankCreditAlert(s.recipientName, s.amount, s.utr, s.recipientVpa);
        }, (idx + 1) * 350);
      });

      // Update Bank Inflows in State & Storage
      plan.splits.forEach(s => {
        const acc = this.state.accounts.find(a => a.vpa === s.recipientVpa);
        if (acc) {
          acc.todayUsed = parseFloat(((acc.todayUsed || 0) + s.amount).toFixed(2));
        }

        // Add to reconciliation audit log
        this.state.reconciliationLog.unshift({
          txRef: plan.masterTxnId,
          orderId: orderId,
          splitPart: s.label,
          accountName: s.recipientName,
          bankCode: s.bankCode || 'UPI',
          vpa: s.recipientVpa,
          amount: s.amount,
          utr: s.utr,
          timestamp: new Date().toLocaleTimeString('en-IN')
        });
      });

      // Keep last 50 audit records
      this.state.reconciliationLog = this.state.reconciliationLog.slice(0, 50);
      localStorage.setItem('splitpay_audit_log', JSON.stringify(this.state.reconciliationLog));
      localStorage.setItem('splitpay_treasury_accounts', JSON.stringify(this.state.accounts));

      // Trigger Confetti Celebration
      this.triggerConfetti();

      // Sync 3D Soundbox LCD Display
      if (this.dom.soundboxLcdStatus) {
        this.dom.soundboxLcdStatus.textContent = 'ALL PARTS CREDITED';
      }

      // Sync Customer Smartphone Simulator with Success Screen
      this.showPhoneSuccessScreen(plan);

      // Render updated UI
      setTimeout(() => {
        this.closePinModal();
        this.renderSmartView();
        this.updateProgress();

        // Prompt to view settlement slip
        setTimeout(() => {
          this.showSmartReceipt();
        }, 1200);
      }, 700);

    }, 600);
  }

  showBankCreditAlert(bankName, amount, utr, vpa) {
    const container = document.getElementById('bankAlertsContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'bank-alert-toast';
    const nowStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const shortAcc = vpa ? vpa.split('@')[0].slice(-4) : '4821';
    
    toast.innerHTML = `
      <div class="toast-icon">🔔</div>
      <div class="toast-content">
        <div class="toast-title">
          <span>${bankName || 'Bank'} Credit Alert</span>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="toast-time">${nowStr}</span>
            <button class="toast-close-btn" onclick="this.closest('.bank-alert-toast').remove()" title="Dismiss">✕</button>
          </div>
        </div>
        <div class="toast-msg">
          A/C XX${shortAcc} credited by <strong>₹${Number(amount).toLocaleString('en-IN')}</strong> via UPI Ref <strong>${utr}</strong>. Bal: ₹${(Math.floor(50000 + Math.random() * 50000)).toLocaleString('en-IN')}.00
        </div>
      </div>
    `;

    container.prepend(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 350);
    }, 6000);
  }

  resetSmartPayment() {
    if (this.state.smartPlan) {
      this.state.smartPlan.status = 'awaiting_payment';
      this.state.smartPlan.splits.forEach(s => {
        s.status = 'pending';
        s.paidAt = null;
      });
      this.renderSmartView();
      this.updateProgress();
      this.soundbox.playBeep();
    }
  }

  showSmartReceipt() {
    if (this.state.smartPlan && window.ReceiptManager) {
      window.ReceiptManager.renderReceiptModal(this.state.smartPlan);
    }
  }

  updateProgress() {
    const calc = this.state.currentCalculation;
    if (!calc) return;

    const completedSplits = calc.splits.filter(s => s.status === 'completed');
    const completedAmount = completedSplits.reduce((acc, s) => acc + s.amount, 0);
    const total = calc.totalAmount;
    const percent = total > 0 ? Math.round((completedAmount / total) * 100) : 0;

    if (this.dom.progressFill) this.dom.progressFill.style.width = `${percent}%`;
    if (this.dom.progressPercentage) this.dom.progressPercentage.textContent = `${percent}% Settled`;
    if (this.dom.progressText) {
      this.dom.progressText.textContent = `Paid: ${this.formatCurrency(completedAmount)} / ${this.formatCurrency(total)}`;
    }
    if (this.dom.totalBillDisplay) {
      this.dom.totalBillDisplay.textContent = this.formatCurrency(total);
    }
    if (this.dom.splitsCountBadge) {
      this.dom.splitsCountBadge.textContent = `${calc.splits.length} Splits`;
    }
  }

  renderCustomerSplits() {
    const calc = this.state.currentCalculation;
    if (!calc || !this.dom.splitsContainer) return;

    if (calc.splits.length === 0) {
      this.dom.splitsContainer.innerHTML = `
        <div class="text-center" style="padding: 3rem; color: var(--text-muted);">
          Please enter an amount to view UPI splits.
        </div>
      `;
      return;
    }

    let html = '';
    calc.splits.forEach((split, idx) => {
      const isCompleted = split.status === 'completed';
      const isActive = idx === this.state.activeSplitIndex && !isCompleted;
      const isPending = !isCompleted && !isActive;

      let cardClass = 'split-card';
      if (isCompleted) cardClass += ' completed';
      if (isActive) cardClass += ' active pulse-border';
      if (isPending) cardClass += ' pending';

      html += `
        <div class="${cardClass}" id="split-card-${idx}">
          <div class="split-card-header">
            <div>
              <span class="split-seq-badge">Split #${idx + 1} of ${calc.splits.length}</span>
              <h3 style="font-size: 1.15rem; font-weight: 700; margin-top: 0.25rem;">
                ${split.label}
              </h3>
            </div>
            <span class="badge ${isCompleted ? 'badge-success' : (isActive ? 'badge-primary' : 'badge-warning')}">
              ${isCompleted ? '✓ PAID' : (isActive ? '👉 ACTIVE NOW' : 'PENDING')}
            </span>
          </div>

          <div class="split-card-body">
            <div class="qr-code-frame">
              ${isCompleted ? `
                <div class="qr-settled-overlay">
                  <div class="checkmark-circle">✓</div>
                  <div class="font-bold text-success" style="margin-top: 0.5rem;">Settled</div>
                </div>
              ` : (isActive ? `
                <img src="/api/qr?text=${encodeURIComponent(split.upiUrl)}&size=200" alt="UPI QR for ₹${split.amount}" />
              ` : `
                <div style="width: 180px; height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.2); border-radius: 8px; color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 1rem;">
                  <span>⏳ QR Code</span>
                  <span style="font-size: 0.7rem; margin-top: 0.25rem;">Activates when previous split is paid</span>
                </div>
              `)}
            </div>

            <div class="split-info-pane">
              <div class="split-amount-display">
                <span class="rupee">₹</span>${split.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div class="text-xs text-muted" style="margin-bottom: 0.75rem;">
                ${split.isRemainder ? 'Remaining balance settlement' : `Standard max chunk of ₹${calc.splitLimit}`}
              </div>

              ${isCompleted ? `
                <div class="text-xs text-muted">UTR: ${split.utr}</div>
                <button class="btn btn-outline btn-full" onclick="app.reopenSplit(${idx})">
                  Reset Split #${idx + 1}
                </button>
              ` : `
                <a href="${split.upiUrl}" class="btn btn-primary btn-full upi-direct-btn">
                  🚀 Pay ₹${split.amount.toFixed(0)} with UPI App
                </a>

                <div class="upi-app-triggers">
                  <a href="${split.upiUrl}" class="app-pill"><span>⚡</span> GPay</a>
                  <a href="${split.upiUrl}" class="app-pill"><span>🟣</span> PhonePe</a>
                  <a href="${split.upiUrl}" class="app-pill"><span>🔵</span> Paytm</a>
                  <a href="${split.upiUrl}" class="app-pill"><span>🇮🇳</span> BHIM</a>
                </div>

                <div class="flex-between" style="gap: 0.5rem; margin-top: 0.25rem;">
                  <button class="btn btn-success btn-full" onclick="app.markSplitPaid(${idx})">
                    ✓ Mark as Paid
                  </button>
                  <button class="btn btn-secondary btn-full" onclick="app.simulatePayment(${idx})">
                    ⚡ Auto-Simulate
                  </button>
                </div>
              `}
            </div>
          </div>
        </div>
      `;
    });

    this.dom.splitsContainer.innerHTML = html;
  }

  renderKioskActiveSplit() {
    const calc = this.state.currentCalculation;
    if (!calc || calc.splits.length === 0) return;

    const allCompleted = calc.splits.every(s => s.status === 'completed');

    if (allCompleted) {
      this.dom.kioskSplitTitle.textContent = `All Splits Settled!`;
      this.dom.kioskAmountDisplay.innerHTML = `<span class="rupee">₹</span>${calc.totalAmount.toLocaleString('en-IN')}`;
      this.dom.kioskQrContainer.innerHTML = `
        <div class="text-center" style="padding: 2rem;">
          <div style="font-size: 3.5rem;">🎉</div>
          <h3 class="text-success font-bold" style="margin-top: 0.5rem;">Settlement Complete</h3>
          <p class="text-muted" style="margin-bottom: 1.5rem;">All ${calc.splits.length} split payments received in full.</p>
          <button class="btn btn-primary" onclick="ReceiptManager.renderReceiptModal(app.state.currentCalculation)">
            🧾 View & Print Receipt
          </button>
        </div>
      `;
      this.dom.kioskStatusBadge.innerHTML = `<span class="pulse-dot"></span> 100% Settled`;
      this.dom.kioskNextHint.textContent = 'All payments received.';
      return;
    }

    const activeSplit = calc.splits[this.state.activeSplitIndex] || calc.splits[0];
    const qrUrl = `/api/qr?text=${encodeURIComponent(activeSplit.upiUrl)}&size=300`;

    this.dom.kioskSplitTitle.textContent = `SCANNER ACTIVE: ${activeSplit.label}`;
    this.dom.kioskAmountDisplay.innerHTML = `<span class="rupee">₹</span>${activeSplit.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    
    this.dom.kioskQrContainer.innerHTML = `
      <img src="${qrUrl}" alt="Scan to pay ${activeSplit.label}" />
    `;

    this.dom.kioskStatusBadge.innerHTML = `<span class="pulse-dot"></span> Waiting for ₹${activeSplit.amount} Payment`;

    if (this.state.activeSplitIndex < calc.splits.length - 1) {
      const nextSplit = calc.splits[this.state.activeSplitIndex + 1];
      this.dom.kioskNextHint.textContent = `Next up: ${nextSplit.label} (₹${nextSplit.amount.toFixed(2)})`;
    } else {
      this.dom.kioskNextHint.textContent = `This is the final payment to clear the total bill.`;
    }
  }

  markSplitPaid(index) {
    const calc = this.state.currentCalculation;
    if (!calc || !calc.splits[index]) return;

    const split = calc.splits[index];
    split.status = 'completed';
    split.paidAt = new Date().toISOString();

    // Trigger bank credit alert
    this.showBankCreditAlert(split.recipientName || 'HDFC Bank', split.amount, split.utr, this.state.merchant.vpa);

    // Soundbox Announcement
    const isLast = calc.splits.every(s => s.status === 'completed');
    this.soundbox.announcePayment(split.amount, isLast);

    if (isLast) {
      this.triggerConfetti();
      setTimeout(() => {
        window.ReceiptManager.renderReceiptModal(calc);
      }, 1000);
    } else {
      this.state.activeSplitIndex = index + 1;
    }

    this.updateProgress();
    this.renderCustomerSplits();
    if (this.state.mode === 'kiosk') {
      this.renderKioskActiveSplit();
    }
  }

  simulatePayment(index) {
    this.soundbox.playBeep();
    const card = document.getElementById(`split-card-${index}`);
    if (card) {
      card.style.transform = 'scale(0.98)';
      setTimeout(() => { card.style.transform = 'none'; }, 200);
    }

    setTimeout(() => {
      this.markSplitPaid(index);
    }, 800);
  }

  reopenSplit(index) {
    const calc = this.state.currentCalculation;
    if (calc && calc.splits[index]) {
      calc.splits[index].status = 'pending';
      this.state.activeSplitIndex = index;
      this.updateProgress();
      this.renderCustomerSplits();
      if (this.state.mode === 'kiosk') {
        this.renderKioskActiveSplit();
      }
    }
  }

  resetAllSplits() {
    if (this.state.currentCalculation) {
      this.state.currentCalculation.splits.forEach(s => s.status = 'pending');
      this.state.activeSplitIndex = 0;
      this.updateProgress();
      this.renderCustomerSplits();
      if (this.state.mode === 'kiosk') {
        this.renderKioskActiveSplit();
      }
    }
  }

  // =========================================================================
  // TREASURY & ANALYTICS RENDERING
  // =========================================================================
  renderTreasuryView() {
    if (!this.dom.treasurySection) return;

    // 1. KPI Ribbon Calculation
    let totalVolume = 0;
    let totalSplits = this.state.reconciliationLog.length;
    this.state.accounts.forEach(a => {
      totalVolume += (a.todayUsed || 0);
    });

    const activeBanksCount = this.state.accounts.filter(a => a.active).length;
    const mdrSaved = (totalVolume * 0.02).toFixed(2); // 2% typical gateway MDR

    if (this.dom.kpiTotalVolume) this.dom.kpiTotalVolume.textContent = this.formatCurrency(totalVolume);
    if (this.dom.kpiTotalSplits) this.dom.kpiTotalSplits.textContent = `${totalSplits} Cleared`;
    if (this.dom.kpiActiveBanks) this.dom.kpiActiveBanks.textContent = `${activeBanksCount} Accounts`;
    if (this.dom.kpiMdrSavings) this.dom.kpiMdrSavings.textContent = this.formatCurrency(mdrSaved);

    // 2. Render Allocation Bars
    this.renderTreasuryAllocationBars(totalVolume);

    // 3. Render Bank Accounts Cards Grid
    this.renderTreasuryAccounts();

    // 4. Render Reconciliation Audit Table
    this.renderAuditTable();
  }

  renderTreasuryAllocationBars(totalVolume) {
    if (!this.dom.treasuryAllocationBars) return;

    const colors = ['#10b981', '#06b6d4', '#6366f1', '#f59e0b', '#ec4899'];
    let html = '';

    this.state.accounts.forEach((acc, idx) => {
      const vol = acc.todayUsed || 0;
      const pct = totalVolume > 0 ? Math.round((vol / totalVolume) * 100) : 0;
      const color = colors[idx % colors.length];

      html += `
        <div class="alloc-item">
          <div class="alloc-header">
            <div>
              <strong>${acc.name}</strong> (${acc.bankCode || acc.bank})
            </div>
            <div class="font-bold text-mono">
              ${this.formatCurrency(vol)} <span class="text-muted">(${pct}%)</span>
            </div>
          </div>
          <div class="alloc-bar-track">
            <div class="alloc-bar-fill" style="width: ${pct}%; background: ${color};"></div>
          </div>
        </div>
      `;
    });

    this.dom.treasuryAllocationBars.innerHTML = html;
  }

  renderTreasuryAccounts() {
    if (!this.dom.treasuryAccountsGrid) return;

    let html = '';
    this.state.accounts.forEach((acc, idx) => {
      const used = acc.todayUsed || 0;
      const cap = acc.dailyLimit || 100000;
      const utilPct = Math.min(100, Math.round((used / cap) * 100));

      html += `
        <div class="account-card ${acc.active ? '' : 'inactive'}" id="acc-card-${acc.id}">
          <div class="acc-card-top">
            <div>
              <div class="font-bold" style="font-size: 1rem; color: var(--text-main);">${acc.name}</div>
              <div class="text-xs text-muted text-mono" style="margin-top: 0.15rem;">${acc.vpa}</div>
            </div>
            <span class="acc-badge">${acc.bankCode || 'UPI'}</span>
          </div>

          <div style="margin-top: 0.5rem;">
            <div class="flex-between text-xs">
              <span class="text-muted">Daily Limit Utilization:</span>
              <strong class="${utilPct > 80 ? 'text-warning' : 'text-success'}">${this.formatCurrency(used)} / ${this.formatCurrency(cap)} (${utilPct}%)</strong>
            </div>
            <div class="utilization-track">
              <div class="utilization-fill" style="width: ${utilPct}%; ${utilPct > 80 ? 'background: var(--warning);' : ''}"></div>
            </div>
          </div>

          <div class="flex-between" style="margin-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.65rem;">
            <label class="toggle-switch-label" style="font-size: 0.78rem;">
              <input type="checkbox" ${acc.active ? 'checked' : ''} onchange="app.toggleAccountActive('${acc.id}')">
              <span>${acc.active ? 'Active Routing Node' : 'Paused'}</span>
            </label>
            <button class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.72rem; color: #ef4444;" onclick="app.deleteAccount('${acc.id}')" title="Delete account node">
              ✕ Remove
            </button>
          </div>
        </div>
      `;
    });

    this.dom.treasuryAccountsGrid.innerHTML = html;
  }

  renderAuditTable() {
    if (!this.dom.auditTableBody) return;

    if (this.state.reconciliationLog.length === 0) {
      this.dom.auditTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted" style="padding: 2rem;">
            No transactions recorded yet. Complete a payment to view audit logs.
          </td>
        </tr>
      `;
      return;
    }

    const html = this.state.reconciliationLog.map(r => `
      <tr>
        <td>
          <div class="font-bold text-mono">${r.txRef}</div>
          <div class="text-xs text-muted">${r.orderId}</div>
        </td>
        <td>
          <span class="badge badge-primary">${r.splitPart}</span>
        </td>
        <td>
          <div class="font-bold">${r.accountName}</div>
          <div class="text-xs text-muted text-mono">${r.vpa} (UTR: ${r.utr})</div>
        </td>
        <td class="text-right font-bold text-mono">
          ${this.formatCurrency(r.amount)}
        </td>
        <td class="text-center">
          <span class="badge badge-success">00 - APPROVED</span>
        </td>
        <td class="text-right text-xs text-muted">
          ${r.timestamp}
        </td>
      </tr>
    `).join('');

    this.dom.auditTableBody.innerHTML = html;
  }

  openAddBankModal() {
    if (this.dom.addBankModal) {
      this.dom.addBankModal.style.display = 'flex';
      this.soundbox.playBeep();
    }
  }

  closeAddBankModal() {
    if (this.dom.addBankModal) {
      this.dom.addBankModal.style.display = 'none';
    }
  }

  handleAddBankSubmit() {
    const select = document.getElementById('newBankSelect');
    const labelInput = document.getElementById('newAccountLabel');
    const vpaInput = document.getElementById('newAccountVpa');
    const limitInput = document.getElementById('newDailyLimit');

    if (!labelInput || !vpaInput || !limitInput) return;

    const bankCode = select.value;
    const name = labelInput.value.trim();
    const vpa = vpaInput.value.trim();
    const dailyLimit = parseFloat(limitInput.value) || 100000;

    const newAcc = {
      id: 'acc_' + Date.now(),
      name: `${name} (${bankCode})`,
      bank: select.options[select.selectedIndex].text,
      bankCode: bankCode,
      vpa: vpa,
      dailyLimit: dailyLimit,
      todayUsed: 0,
      active: true
    };

    this.state.accounts.push(newAcc);
    localStorage.setItem('splitpay_treasury_accounts', JSON.stringify(this.state.accounts));

    this.closeAddBankModal();
    this.soundbox.playBeep();
    this.renderTreasuryView();
    this.calculateAndRender();

    labelInput.value = '';
    vpaInput.value = '';
  }

  toggleAccountActive(id) {
    const acc = this.state.accounts.find(a => a.id === id);
    if (acc) {
      acc.active = !acc.active;
      localStorage.setItem('splitpay_treasury_accounts', JSON.stringify(this.state.accounts));
      this.soundbox.playBeep();
      this.renderTreasuryView();
      this.calculateAndRender();
    }
  }

  deleteAccount(id) {
    if (this.state.accounts.length <= 1) {
      alert('You must keep at least 1 destination bank account.');
      return;
    }
    if (confirm('Are you sure you want to remove this bank account node?')) {
      this.state.accounts = this.state.accounts.filter(a => a.id !== id);
      localStorage.setItem('splitpay_treasury_accounts', JSON.stringify(this.state.accounts));
      this.soundbox.playBeep();
      this.renderTreasuryView();
      this.calculateAndRender();
    }
  }

  exportAuditCsv() {
    if (window.ReceiptManager) {
      window.ReceiptManager.exportReconciliationCsv(this.state.reconciliationLog);
      this.soundbox.playBeep();
    }
  }

  copyTreasuryDigest() {
    let totalVolume = 0;
    this.state.accounts.forEach(a => totalVolume += (a.todayUsed || 0));

    const breakdownText = this.state.accounts
      .filter(a => (a.todayUsed || 0) > 0)
      .map(a => `• ${a.name}: ₹${Number(a.todayUsed).toLocaleString('en-IN')}`)
      .join('\n');

    const summary = {
      totalVolume: totalVolume,
      totalSplits: this.state.reconciliationLog.length,
      activeBanks: this.state.accounts.filter(a => a.active).length,
      savings: (totalVolume * 0.02).toFixed(2),
      bankBreakdown: breakdownText
    };

    if (window.ReceiptManager) {
      window.ReceiptManager.copyWhatsAppDigest(summary);
      this.soundbox.playBeep();
    }
  }

  testWebhookDispatch() {
    const urlInput = this.dom.webhookEndpointInput;
    const webhookUrl = urlInput ? urlInput.value.trim() : 'https://merchant.example.com/api/v1/webhook';
    
    fetch('/api/webhook/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: webhookUrl,
        session: {
          txRef: this.state.smartPlan?.masterTxnId || 'MST_TEST_DISPATCH',
          totalAmount: this.state.totalAmount,
          status: 'settled',
          splitsCount: this.state.smartPlan?.summary?.totalSplits || 2,
          destinationBanks: this.state.accounts.map(a => a.bankCode)
        }
      })
    })
    .then(r => r.json())
    .then(res => {
      if (this.dom.webhookResultBox && this.dom.webhookPayloadCode) {
        this.dom.webhookResultBox.style.display = 'block';
        if (this.dom.webhookDeliveryTime) {
          this.dom.webhookDeliveryTime.textContent = `Dispatched at ${new Date(res.deliveredAt).toLocaleTimeString()}`;
        }
        this.dom.webhookPayloadCode.textContent = JSON.stringify(res, null, 2);
        this.soundbox.playBeep();
      }
    })
    .catch(err => {
      alert('Webhook dispatch test failed: ' + err.message);
    });
  }

  // Camera QR Scanner using html5-qrcode
  toggleCameraScanner() {
    if (this.state.scannerActive) {
      this.stopCameraScanner();
    } else {
      this.startCameraScanner();
    }
  }

  startCameraScanner() {
    if (!window.Html5Qrcode) {
      alert('QR Scanner library is loading. Please try again.');
      return;
    }

    this.dom.scannerContainer.style.display = 'block';
    this.dom.scannerToggleBtn.textContent = '⏹️ Stop Camera';
    this.state.scannerActive = true;

    this.qrScanner = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 220, height: 220 } };

    this.qrScanner.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        this.onQrCodeScanned(decodedText);
      },
      () => {}
    ).catch(err => {
      console.warn('Camera failed to start:', err);
      alert('Camera access unavailable. You can use the "Upload QR Image" option instead.');
      this.stopCameraScanner();
    });
  }

  stopCameraScanner() {
    if (this.qrScanner) {
      this.qrScanner.stop().then(() => {
        this.qrScanner.clear();
        this.qrScanner = null;
      }).catch(() => {});
    }
    this.dom.scannerContainer.style.display = 'none';
    this.dom.scannerToggleBtn.textContent = '📷 Open Camera Scanner';
    this.state.scannerActive = false;
  }

  handleQrFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!window.Html5Qrcode) {
      alert('QR Scanner library not ready.');
      return;
    }

    const html5QrCode = new Html5Qrcode("reader");
    html5QrCode.scanFile(file, true)
      .then(decodedText => {
        this.onQrCodeScanned(decodedText);
      })
      .catch(() => {
        alert('Could not decode a valid QR code from this image. Please try another image.');
      });
  }

  onQrCodeScanned(rawText) {
    this.soundbox.playBeep();
    const parsed = this.splitEngine.parseUpiUrl(rawText);

    if (parsed) {
      if (parsed.vpa) this.state.merchant.vpa = parsed.vpa;
      if (parsed.name) this.state.merchant.name = parsed.name;
      if (parsed.amount && parsed.amount > 0) {
        this.state.totalAmount = parsed.amount;
        this.dom.totalAmountInput.value = parsed.amount;
        this.state.addedItems = [{ id: 'scanned_' + Date.now(), amount: parsed.amount, label: 'Scanned QR' }];
        this.renderAddedItems();
      }

      this.stopCameraScanner();
      this.calculateAndRender();
      alert(`Scanned successfully!\nMerchant: ${this.state.merchant.name}\nVPA: ${this.state.merchant.vpa}\nAmount: ₹${this.state.totalAmount}`);
    } else {
      alert('Scanned payload is not a valid UPI QR code.');
    }
  }

  triggerConfetti() {
    const canvas = this.dom.confettiCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#10b981', '#06b6d4', '#6366f1', '#f59e0b', '#ec4899', '#ffffff'];

    for (let i = 0; i < 120; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 50,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 5 + 3,
        rot: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10
      });
    }

    let frame = 0;
    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      pieces.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      if (frame < 180) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    this.soundbox.playCelebrationSound();
    animate();
  }

  formatCurrency(amt) {
    return '₹' + Number(amt || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // ================= VOICE HANDS-FREE ASSISTANT =================
  initVoiceCommands() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported by your current browser. Please try Google Chrome or Microsoft Edge.');
      return;
    }

    if (this._isListening && this._recognition) {
      this._recognition.stop();
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = this.soundbox.voiceLang === 'hi' ? 'hi-IN' : 'en-IN';

      recognition.onstart = () => {
        this._isListening = true;
        if (this.dom.voiceCommandBtn) this.dom.voiceCommandBtn.classList.add('listening');
        if (this.dom.voiceFeedbackPill) this.dom.voiceFeedbackPill.style.display = 'inline-flex';
        if (this.dom.voiceFeedbackText) this.dom.voiceFeedbackText.textContent = 'Listening for hands-free command...';
        this.soundbox.playBeep();
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim().toLowerCase();
        this.handleVoiceCommand(transcript);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        if (this.dom.voiceFeedbackText) {
          this.dom.voiceFeedbackText.textContent = `Mic status: ${event.error}`;
        }
        setTimeout(() => this.stopVoiceCommands(), 2000);
      };

      recognition.onend = () => {
        this.stopVoiceCommands();
      };

      this._recognition = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition initiation error:', err);
    }
  }

  stopVoiceCommands() {
    this._isListening = false;
    if (this.dom.voiceCommandBtn) this.dom.voiceCommandBtn.classList.remove('listening');
    setTimeout(() => {
      if (this.dom.voiceFeedbackPill && !this._isListening) {
        this.dom.voiceFeedbackPill.style.display = 'none';
      }
    }, 2500);
  }

  handleVoiceCommand(transcript) {
    if (this.dom.voiceFeedbackText) {
      this.dom.voiceFeedbackText.textContent = `Heard: "${transcript}"`;
    }

    const extractNumber = (str) => {
      const match = str.match(/\d+(\.\d+)?/);
      return match ? parseFloat(match[0]) : null;
    };

    // 1. Pay / Authorize command
    if (transcript.includes('pay') || transcript.includes('authorize') || transcript.includes('भुगतान') || transcript.includes('split now')) {
      this.openPinModal();
      return;
    }

    // 2. Clear command
    if (transcript.includes('clear') || transcript.includes('reset') || transcript.includes('हटाओ') || transcript.includes('साफ')) {
      this.handleClearAmount();
      return;
    }

    // 3. Replay Soundbox announcement
    if (transcript.includes('replay') || transcript.includes('repeat') || transcript.includes('दोबारा') || transcript.includes('soundbox')) {
      this.soundbox.replayLastAnnouncement();
      return;
    }

    // 4. Language switch
    if (transcript.includes('hindi') || transcript.includes('हिन्दी')) {
      this.soundbox.voiceLang = 'hi';
      if (this.dom.langToggleBtn) this.dom.langToggleBtn.textContent = 'हिन्दी';
      this.soundbox.replayLastAnnouncement();
      return;
    }
    if (transcript.includes('english')) {
      this.soundbox.voiceLang = 'en';
      if (this.dom.langToggleBtn) this.dom.langToggleBtn.textContent = 'EN';
      this.soundbox.replayLastAnnouncement();
      return;
    }

    // 5. Add amount (e.g. "add 500", "plus 1000", "add 1999")
    if (transcript.includes('add') || transcript.includes('plus') || transcript.includes('जोड़ो') || transcript.includes('+')) {
      const num = extractNumber(transcript);
      if (num && num > 0) {
        this.handleQuickAdd(num);
        return;
      }
    }

    // 6. Set bill / split amount (e.g. "split 3800", "bill 5000", "amount 1999")
    const num = extractNumber(transcript);
    if (num && num > 0) {
      this.dom.totalAmountInput.value = num;
      this.state.totalAmount = num;
      this.state.addedItems = [{ id: 'voice_' + Date.now(), amount: num, label: 'Voice Command' }];
      this.renderAddedItems();
      this.soundbox.playBeep();
      this.calculateAndRender();
    }
  }

  // ================= CUSTOMER SMARTPHONE SIMULATOR =================
  togglePhoneMirror() {
    if (!this.dom.phoneMirrorModal) return;
    const isHidden = this.dom.phoneMirrorModal.style.display === 'none' || !this.dom.phoneMirrorModal.style.display;
    if (isHidden) {
      this.dom.phoneMirrorModal.style.display = 'flex';
      this.startPhoneClock();
      this.syncCustomerPhoneScreen();
      this.resetPhoneScreen();
    } else {
      this.closePhoneMirror();
    }
  }

  closePhoneMirror(event) {
    if (event && event.target && event.target !== this.dom.phoneMirrorModal && !event.target.classList.contains('phone-back-btn')) {
      return;
    }
    if (this.dom.phoneMirrorModal) {
      this.dom.phoneMirrorModal.style.display = 'none';
    }
    if (this._phoneClockInterval) {
      clearInterval(this._phoneClockInterval);
      this._phoneClockInterval = null;
    }
  }

  startPhoneClock() {
    const updateTime = () => {
      if (this.dom.phoneLiveClock) {
        const now = new Date();
        this.dom.phoneLiveClock.textContent = now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      }
    };
    updateTime();
    if (this._phoneClockInterval) clearInterval(this._phoneClockInterval);
    this._phoneClockInterval = setInterval(updateTime, 1000);
  }

  syncCustomerPhoneScreen() {
    const plan = this.state.smartPlan;
    if (!plan) return;

    if (this.dom.phoneAmountVal) {
      this.dom.phoneAmountVal.textContent = plan.totalAmount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    if (this.dom.phonePayBtnAmount) {
      this.dom.phonePayBtnAmount.textContent = plan.totalAmount.toLocaleString('en-IN', {
        maximumFractionDigits: 0
      });
    }

    if (this.dom.phoneMerchantName) {
      this.dom.phoneMerchantName.textContent = this.state.merchant.name || 'Satnam Enterprise';
    }

    if (this.dom.phoneMerchantVpa) {
      this.dom.phoneMerchantVpa.textContent = this.state.merchant.vpa || 'satnam.store@okhdfcbank';
    }

    if (this.dom.phoneSplitHint) {
      if (plan.summary.totalSplits > 1) {
        const chunkPart = `₹${plan.summary.chunkAmount.toLocaleString('en-IN')}`;
        const remainderPart = plan.summary.remainderAmount > 0 ? ` + ₹${plan.summary.remainderAmount.toLocaleString('en-IN')}` : '';
        this.dom.phoneSplitHint.textContent = `⚡ 1-PIN Auto-Split (${plan.summary.totalSplits} parts: ${chunkPart}${remainderPart})`;
      } else {
        this.dom.phoneSplitHint.textContent = `⚡ Direct Single Settlement`;
      }
    }
  }

  handlePhonePayClick() {
    this.soundbox.playBeep();
    this.openPinModal();
  }

  showPhoneSuccessScreen(plan) {
    if (!plan || !this.dom.phoneSuccessOverlay) return;

    if (this.dom.phonePaidSuccessAmount) {
      this.dom.phonePaidSuccessAmount.textContent = plan.totalAmount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    if (this.dom.phoneSuccessUtrText) {
      this.dom.phoneSuccessUtrText.textContent = `UPI Ref: ${plan.masterTxnId}`;
    }

    if (this.dom.phoneSuccessSplits) {
      const parts = plan.splits.slice(0, 4);
      let html = parts.map(s => `
        <div class="phone-split-success-item">
          <span>${s.label}: ₹${s.amount.toLocaleString('en-IN')}</span>
          <span class="text-success">✓ A/C ${s.recipientName ? s.recipientName.split(' ')[0] : 'Bank'}</span>
        </div>
      `).join('');

      if (plan.splits.length > 4) {
        html += `<div class="text-xs text-muted text-center" style="margin-top: 0.25rem;">+ ${plan.splits.length - 4} more parts split across banks</div>`;
      }

      this.dom.phoneSuccessSplits.innerHTML = html;
    }

    this.dom.phoneSuccessOverlay.style.display = 'flex';
  }

  resetPhoneScreen() {
    if (this.dom.phoneSuccessOverlay) {
      this.dom.phoneSuccessOverlay.style.display = 'none';
    }
  }

  // ================= ENTERPRISE GATEWAY & PIPELINE CONTROLLER =================
  fetchMerchantConfig() {
    fetch('/api/v1/merchant/config')
      .then(r => r.json())
      .then(res => {
        if (res.success && res.merchant) {
          const m = res.merchant;
          this.state.merchant.name = m.name;
          this.state.merchant.gateway = m.active_gateway || 'sandbox';
          this.updateGatewayBadge(m.active_gateway);
          if (this.dom.gatewaySelect) this.dom.gatewaySelect.value = m.active_gateway || 'sandbox';
          if (this.dom.gatewayAppIdInput) this.dom.gatewayAppIdInput.value = m.gateway_app_id || '';
          this.onGatewaySelectChange(m.active_gateway);
        }
      })
      .catch(() => {});
  }

  updateGatewayBadge(gateway) {
    const isLive = gateway && gateway !== 'sandbox';
    if (this.dom.activeGatewayDot) {
      this.dom.activeGatewayDot.className = isLive ? 'pulse-dot-green' : 'pulse-dot';
    }
    if (this.dom.activeGatewayText) {
      const names = {
        cashfree: '🟢 Cashfree Live',
        razorpay: '🟢 Razorpay Live',
        direct_bank: '🏦 Direct Bank Live',
        sandbox: '🟡 Sandbox Mode'
      };
      this.dom.activeGatewayText.textContent = names[gateway] || '🟡 Sandbox Mode';
    }
  }

  openGatewayConfigModal() {
    if (this.dom.gatewayConfigModal) {
      this.dom.gatewayConfigModal.style.display = 'flex';
    }
  }

  closeGatewayConfigModal(e) {
    if (e && e.target && e.target !== this.dom.gatewayConfigModal && !e.target.classList.contains('modal-close-btn')) return;
    if (this.dom.gatewayConfigModal) {
      this.dom.gatewayConfigModal.style.display = 'none';
    }
  }

  onGatewaySelectChange(val) {
    const isLive = val && val !== 'sandbox';
    if (this.dom.liveCredentialsFields) {
      this.dom.liveCredentialsFields.style.display = isLive ? 'block' : 'none';
    }
    if (this.dom.webhookIngressUrl) {
      const origin = window.location.origin;
      this.dom.webhookIngressUrl.value = `${origin}/api/v1/webhooks/incoming/${val || 'cashfree'}`;
    }
  }

  saveGatewayConfig(e) {
    if (e) e.preventDefault();
    const gateway = this.dom.gatewaySelect ? this.dom.gatewaySelect.value : 'sandbox';
    const appId = this.dom.gatewayAppIdInput ? this.dom.gatewayAppIdInput.value.trim() : '';
    const secretKey = this.dom.gatewaySecretKeyInput ? this.dom.gatewaySecretKeyInput.value.trim() : '';
    const webhookSecret = this.dom.gatewayWebhookSecretInput ? this.dom.gatewayWebhookSecretInput.value.trim() : '';

    fetch('/api/v1/merchant/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        active_gateway: gateway,
        gateway_app_id: appId,
        gateway_secret_key: secretKey,
        gateway_webhook_secret: webhookSecret
      })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          this.updateGatewayBadge(gateway);
          this.soundbox.playBeep();
          alert(`Pipeline Mode Updated to: ${gateway.toUpperCase()}!`);
          this.closeGatewayConfigModal();
          this.calculateAndRender();
        }
      })
      .catch(err => {
        alert('Failed to save gateway config: ' + err.message);
      });
  }

  copyWebhookUrl() {
    if (this.dom.webhookIngressUrl) {
      navigator.clipboard.writeText(this.dom.webhookIngressUrl.value).then(() => {
        alert('Webhook Ingress URL copied to clipboard!\nPaste this into your Cashfree/Razorpay webhook settings.');
      }).catch(() => {
        this.dom.webhookIngressUrl.select();
        document.execCommand('copy');
        alert('Webhook URL copied!');
      });
    }
  }

  // ================= COMMERCIAL SAAS & ROI CALCULATOR =================
  openPricingModal() {
    if (this.dom.saasPricingModal) {
      this.dom.saasPricingModal.style.display = 'flex';
      this.calculateRoiSavings(this.dom.roiVolumeInput ? this.dom.roiVolumeInput.value : 500000);
    }
  }

  closePricingModal(e) {
    if (e && e.target && e.target !== this.dom.saasPricingModal && !e.target.classList.contains('modal-close-btn')) return;
    if (this.dom.saasPricingModal) {
      this.dom.saasPricingModal.style.display = 'none';
    }
  }

  calculateRoiSavings(volume) {
    const vol = Math.max(0, parseFloat(volume) || 0);
    const mdrSaved = Math.round(vol * 0.011); // 1.1% interchange saved by keeping chunks <= 1999
    const subCost = 499;
    const netProfit = Math.max(0, mdrSaved - subCost);

    if (this.dom.roiMdrSaved) {
      this.dom.roiMdrSaved.textContent = `₹${mdrSaved.toLocaleString('en-IN')} / mo`;
    }
    if (this.dom.roiNetSaved) {
      this.dom.roiNetSaved.textContent = `+₹${netProfit.toLocaleString('en-IN')} / mo`;
    }
  }

  subscribePlan(planName, amount) {
    fetch('/api/v1/subscriptions/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planName, amount })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          this.triggerConfetti();
          alert(`🎉 Subscription Activated!\nPlan: ${planName}\nStatus: Active for 30 Days.`);
          this.closePricingModal();
        }
      })
      .catch(err => {
        alert('Subscription error: ' + err.message);
      });
  }
}

// Global bootstrap
document.addEventListener('DOMContentLoaded', () => {
  window.app = new SplitPayApp();
  window.app.init();
});
