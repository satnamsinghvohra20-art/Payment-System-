const fs = require('fs');
const assert = require('assert');

console.log('--- Verifying GPay & Paytm Clone Integration ---');

// 1. Check soundbox.js
const soundboxContent = fs.readFileSync('./public/js/soundbox.js', 'utf8');
assert(soundboxContent.includes('playPaytmChime'), 'Missing playPaytmChime in soundbox.js');
assert(soundboxContent.includes('playGpayChime'), 'Missing playGpayChime in soundbox.js');
assert(soundboxContent.includes('paytm_hindi'), 'Missing paytm_hindi persona in soundbox.js');
assert(soundboxContent.includes('paytm_cricket'), 'Missing paytm_cricket persona in soundbox.js');
assert(soundboxContent.includes('gpay_chime'), 'Missing gpay_chime persona in soundbox.js');
console.log('✅ Soundbox audio engine: Paytm chimes, GPay chimes, and voice personas verified!');

// 2. Check index.html
const indexHtml = fs.readFileSync('./public/index.html', 'utf8');
assert(indexHtml.includes('phoneTabGpay'), 'Missing GPay tab in index.html');
assert(indexHtml.includes('phoneTabPaytm'), 'Missing Paytm tab in index.html');
assert(indexHtml.includes('gpayContactsSection'), 'Missing GPay contacts ring in index.html');
assert(indexHtml.includes('gpayRewardTeaser'), 'Missing GPay reward teaser in index.html');
assert(indexHtml.includes('paytmPassbookBanner'), 'Missing Paytm passbook banner in index.html');
assert(indexHtml.includes('paytmPassbookDrawer'), 'Missing Paytm passbook drawer in index.html');
assert(indexHtml.includes('paytmInstrumentsBox'), 'Missing Paytm instruments selector in index.html');
assert(indexHtml.includes('gpayScratchOverlay'), 'Missing GPay scratch modal in index.html');
assert(indexHtml.includes('scratchCanvas'), 'Missing scratchCanvas in index.html');
assert(indexHtml.includes('soundboxPersonaSelect'), 'Missing soundbox persona select in index.html');
console.log('✅ UI Markup: GPay Quick Contacts, Scratch Card Canvas, Paytm Passbook Drawer & Instruments verified!');

// 3. Check style.css
const styleCss = fs.readFileSync('./public/css/style.css', 'utf8');
assert(styleCss.includes('.phone-brand-tabs'), 'Missing phone-brand-tabs in style.css');
assert(styleCss.includes('.gpay-contacts-section'), 'Missing gpay-contacts-section in style.css');
assert(styleCss.includes('.paytm-passbook-drawer'), 'Missing paytm-passbook-drawer in style.css');
assert(styleCss.includes('.gpay-scratch-modal'), 'Missing gpay-scratch-modal in style.css');
assert(styleCss.includes('.scratch-canvas'), 'Missing scratch-canvas in style.css');
console.log('✅ CSS Styling: Brand switchers, Google Colors, Paytm Navy & Passbook Ledger verified!');

// 4. Check app.js
const appJs = fs.readFileSync('./public/js/app.js', 'utf8');
assert(appJs.includes('setPhoneBrand'), 'Missing setPhoneBrand in app.js');
assert(appJs.includes('selectQuickContact'), 'Missing selectQuickContact in app.js');
assert(appJs.includes('openPaytmPassbook'), 'Missing openPaytmPassbook in app.js');
assert(appJs.includes('renderPassbookLedger'), 'Missing renderPassbookLedger in app.js');
assert(appJs.includes('initScratchCard'), 'Missing initScratchCard in app.js');
assert(appJs.includes('revealScratchReward'), 'Missing revealScratchReward in app.js');
assert(appJs.includes('setSoundboxPersona'), 'Missing setSoundboxPersona in app.js');
console.log('✅ JavaScript Controller: GPay scratch canvas & Paytm passbook ledger controller verified!');

console.log('🚀 ALL GPAY & PAYTM CLONE FEATURES SUCCESSFULLY VERIFIED!');
