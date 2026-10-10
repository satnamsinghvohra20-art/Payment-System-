/**
 * Virtual UPI Soundbox & Audio Synthesizer — Hardware Simulator & Multi-Brand Edition
 * Features authentic audio chimes (Paytm Soundbox 4G, Google Pay Celestial Chime, Standard Bell),
 * celebrity & brand voice personas (Paytm Classic Hindi, Paytm Cricket Edition, GPay Digital, English Executive),
 * volume management, announcement replay memory, and animated soundwave visualizer hooks.
 */
class Soundbox {
  constructor() {
    this.audioCtx = null;
    this.enabled = true;
    this.voiceLang = 'hi'; // 'hi' or 'en'
    this.voicePersona = 'paytm_hindi'; // 'paytm_hindi', 'paytm_cricket', 'gpay_chime', 'english', 'hindi'
    this.volume = 0.85;
    this.lastAnnouncement = null;
    this.onAudioStartCallback = null;
    this.onAudioEndCallback = null;
  }

  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setVolume(newVol) {
    this.volume = Math.max(0.1, Math.min(1.0, parseFloat(newVol) || 0.85));
    return this.volume;
  }

  setPersona(persona) {
    this.voicePersona = persona || 'paytm_hindi';
    if (persona === 'english') {
      this.voiceLang = 'en';
    } else {
      this.voiceLang = 'hi';
    }
    return this.voicePersona;
  }

  triggerVisualizer(durationMs = 2500) {
    const speaker = document.getElementById('soundboxSpeakerArea');
    const led = document.getElementById('soundboxLedRing');
    if (speaker) speaker.classList.add('playing');
    if (led) led.classList.add('playing');

    setTimeout(() => {
      if (speaker) speaker.classList.remove('playing');
      if (led) led.classList.remove('playing');
    }, durationMs);
  }

  /**
   * Play the signature Paytm Soundbox punchy electronic chime (G5 -> C6)
   */
  playPaytmChime() {
    if (!this.enabled) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      this.triggerVisualizer(900);
      const now = this.audioCtx.currentTime;

      // Note 1: 784 Hz (G5)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(784, now);
      gain1.gain.setValueAtTime(0.35 * this.volume, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.22);

      // Note 2: 1046.5 Hz (C6) with bright presence
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.5, now + 0.12);
      gain2.gain.setValueAtTime(0.4 * this.volume, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.45);
    } catch (e) {
      console.warn('Paytm chime error:', e);
    }
  }

  /**
   * Play the authentic Google Pay Celestial Chime (Ascending D5 -> A5 -> D6 arpeggio)
   */
  playGpayChime() {
    if (!this.enabled) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      this.triggerVisualizer(1200);
      const now = this.audioCtx.currentTime;
      const notes = [
        { freq: 587.33, delay: 0.00, dur: 0.25 }, // D5
        { freq: 880.00, delay: 0.08, dur: 0.28 }, // A5
        { freq: 1174.66, delay: 0.16, dur: 0.50 } // D6 shimmer
      ];

      notes.forEach(n => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, now + n.delay);
        gain.gain.setValueAtTime(0.32 * this.volume, now + n.delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.delay + n.dur);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + n.delay);
        osc.stop(now + n.delay + n.dur);
      });
    } catch (e) {
      console.warn('GPay chime error:', e);
    }
  }

  /**
   * Play standard UPI bell chime
   */
  playChime() {
    if (this.voicePersona.startsWith('paytm')) {
      this.playPaytmChime();
      return;
    }
    if (this.voicePersona === 'gpay_chime') {
      this.playGpayChime();
      return;
    }

    if (!this.enabled) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      this.triggerVisualizer(800);
      const now = this.audioCtx.currentTime;

      // Tone 1 (High bell 880 Hz / A5)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.3 * this.volume, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Tone 2 (Harmonic bell 1320 Hz / E6)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, now + 0.12);
      gain2.gain.setValueAtTime(0.35 * this.volume, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.55);
    } catch (e) {
      console.warn('Audio synthesis error:', e);
    }
  }

  /**
   * Play success fanfare when all splits are completed
   */
  playCelebrationSound() {
    if (this.voicePersona === 'gpay_chime') {
      this.playGpayChime();
      return;
    }
    if (this.voicePersona.startsWith('paytm')) {
      this.playPaytmChime();
      return;
    }

    if (!this.enabled) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      this.triggerVisualizer(1200);
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      const now = this.audioCtx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const start = now + idx * 0.1;
        const dur = 0.4;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.25 * this.volume, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(start);
        osc.stop(start + dur);
      });
    } catch (e) {
      console.warn('Fanfare error:', e);
    }
  }

  /**
   * Play brief scan beep
   */
  playBeep() {
    if (!this.enabled) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, now);
      gain.gain.setValueAtTime(0.15 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {
      console.warn('Beep error:', e);
    }
  }

  /**
   * Announce payment arrival with voice respecting brand persona
   */
  announcePayment(amount, isFullSettlement = false) {
    this.lastAnnouncement = {
      type: 'sequential',
      amount: amount,
      isFullSettlement: isFullSettlement
    };

    this.playChime();

    if (!this.enabled || !window.speechSynthesis) return;

    setTimeout(() => {
      window.speechSynthesis.cancel();

      let text = '';
      const formattedAmount = Math.round(amount) === amount ? amount : amount.toFixed(2);

      switch (this.voicePersona) {
        case 'paytm_hindi':
          // Authentic Indian Paytm Soundbox announcement
          text = `पेटीएम पर ${formattedAmount} रुपये प्राप्त हुए।`;
          break;

        case 'paytm_cricket':
          // Viral cricket edition commentary soundbox
          text = `शानदार शॉट! चौका और छक्का! पेटीएम पर ${formattedAmount} रुपये प्राप्त हुए!`;
          break;

        case 'gpay_chime':
          // Google Pay digital assistant voice
          text = `Google Pay received ${formattedAmount} rupees successfully.`;
          break;

        case 'english':
          if (isFullSettlement) {
            text = `Payment successful! Total settlement of ${formattedAmount} rupees received in full on SplitPay.`;
          } else {
            text = `Payment of ${formattedAmount} rupees received successfully on SplitPay.`;
          }
          break;

        case 'hindi':
        default:
          if (isFullSettlement) {
            text = `बधाई हो! कुल भुगतान ${formattedAmount} रुपये सफलतापूर्वक प्राप्त हो गए हैं।`;
          } else {
            text = `स्प्लिट-पे पर ${formattedAmount} रुपये प्राप्त हुए।`;
          }
          break;
      }

      this.speakText(text);
    }, 450);
  }

  /**
   * Announce 1-PIN Auto-Split Settlement with Multi-Part Breakdown
   */
  announceSmartSplit(splits, totalAmount) {
    this.lastAnnouncement = {
      type: 'smart',
      amount: totalAmount,
      splits: splits
    };

    this.playCelebrationSound();

    if (!this.enabled || !window.speechSynthesis) return;

    setTimeout(() => {
      window.speechSynthesis.cancel();

      const roundedTotal = Math.round(totalAmount) === totalAmount ? totalAmount : totalAmount.toFixed(2);
      let text = '';

      switch (this.voicePersona) {
        case 'paytm_hindi':
          if (splits.length > 1) {
            text = `पेटीएम पर कुल ${roundedTotal} रुपये प्राप्त हुए, सुरक्षित रूप से ${splits.length} भागों में स्प्लिट होकर।`;
          } else {
            text = `पेटीएम पर ${roundedTotal} रुपये प्राप्त हुए।`;
          }
          break;

        case 'paytm_cricket':
          text = `मैच जिताऊ पारी! एक बार में पूर्ण भुगतान! पेटीएम पर ${roundedTotal} रुपये प्राप्त हुए!`;
          break;

        case 'gpay_chime':
          text = `Google Pay: Single PIN Payment Verified! Total ${roundedTotal} rupees split into ${splits.length} parts and credited to merchant accounts!`;
          break;

        case 'english':
          if (splits.length > 3) {
            text = `Single PIN Payment Verified! Total payment of ${roundedTotal} rupees automatically received and split in full across merchant accounts!`;
          } else if (splits.length > 1) {
            const partsDesc = splits.map((s, idx) => `Split ${idx + 1} of ${Math.round(s.amount)} rupees`).join(', and ');
            text = `Single PIN Payment Verified! Automatically received in parts: ${partsDesc}. Total settlement of ${roundedTotal} rupees completed!`;
          } else {
            text = `Payment verified! Total settlement of ${roundedTotal} rupees received successfully on SplitPay!`;
          }
          break;

        case 'hindi':
        default:
          if (splits.length > 3) {
            text = `एक बार पिन द्वारा भुगतान सफल! कुल ${roundedTotal} रुपये का भुगतान सफलतापूर्वक विभिन्न खातों में स्प्लिट होकर प्राप्त हो गया है।`;
          } else if (splits.length > 1) {
            const partsDesc = splits.map((s, idx) => `स्प्लिट ${idx + 1}: ${Math.round(s.amount)} रुपये`).join(', ');
            text = `एक बार पिन द्वारा भुगतान सफल! ${partsDesc} प्राप्त हुए। कुल ${roundedTotal} रुपये का पूर्ण निपटान हो गया है।`;
          } else {
            text = `भुगतान सफल! ${roundedTotal} रुपये प्राप्त हुए।`;
          }
          break;
      }

      this.speakText(text);
    }, 550);
  }

  speakText(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = this.volume;
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    const isHindiPersona = this.voicePersona === 'paytm_hindi' || this.voicePersona === 'paytm_cricket' || this.voicePersona === 'hindi';
    const voices = window.speechSynthesis.getVoices();

    if (isHindiPersona) {
      const hiVoice = voices.find(v => v.lang.includes('hi') || v.lang.includes('IN'));
      if (hiVoice) utterance.voice = hiVoice;
    } else {
      const inVoice = voices.find(v => v.lang.includes('en-IN')) || voices.find(v => v.lang.includes('en'));
      if (inVoice) utterance.voice = inVoice;
    }

    this.triggerVisualizer(3200);
    window.speechSynthesis.speak(utterance);
  }

  replayLastAnnouncement() {
    if (this.lastAnnouncement) {
      if (this.lastAnnouncement.type === 'smart') {
        this.announceSmartSplit(this.lastAnnouncement.splits, this.lastAnnouncement.amount);
      } else {
        this.announcePayment(this.lastAnnouncement.amount, this.lastAnnouncement.isFullSettlement);
      }
    } else {
      this.announcePayment(3800, true);
    }
  }
}

// Export for browser
window.Soundbox = Soundbox;
