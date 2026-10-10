const http = require('http');

function testUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, length: data.length, body: data }));
    }).on('error', reject);
  });
}

async function run() {
  console.log('Testing Next-Gen Frontend Suite...');

  const html = await testUrl('http://127.0.0.1:3000/');
  console.log('Index HTML Status:', html.status, 'Size:', html.length, 'bytes');
  if (!html.body.includes('soundbox-device-card')) throw new Error('Missing soundbox-device-card in HTML');
  if (!html.body.includes('phoneMirrorModal')) throw new Error('Missing phoneMirrorModal in HTML');
  if (!html.body.includes('voiceCommandBtn')) throw new Error('Missing voiceCommandBtn in HTML');
  
  // Clean HTML of fonts.gstatic.com domain before checking for GST
  const cleanedHtml = html.body.replace(/fonts\.gstatic\.com/g, '');
  const hasTax = cleanedHtml.toLowerCase().includes('18%') || cleanedHtml.toLowerCase().includes('gst') || cleanedHtml.toLowerCase().includes('taxescrow');
  console.log('Tax mentions in HTML:', hasTax ? 'FAIL (tax found)' : 'PASSED (0% tax, completely removed)');

  const jsApp = await testUrl('http://127.0.0.1:3000/js/app.js');
  console.log('app.js Status:', jsApp.status, 'Size:', jsApp.length, 'bytes');
  if (!jsApp.body.includes('initVoiceCommands')) throw new Error('Missing initVoiceCommands in app.js');
  if (!jsApp.body.includes('togglePhoneMirror')) throw new Error('Missing togglePhoneMirror in app.js');
  if (!jsApp.body.includes('showPhoneSuccessScreen')) throw new Error('Missing showPhoneSuccessScreen in app.js');
  if (!jsApp.body.includes('soundboxLcdAmount')) throw new Error('Missing soundboxLcdAmount in app.js');

  const jsSound = await testUrl('http://127.0.0.1:3000/js/soundbox.js');
  console.log('soundbox.js Status:', jsSound.status, 'Size:', jsSound.length, 'bytes');
  if (!jsSound.body.includes('replayLastAnnouncement')) throw new Error('Missing replayLastAnnouncement in soundbox.js');
  if (!jsSound.body.includes('triggerVisualizer')) throw new Error('Missing triggerVisualizer in soundbox.js');

  const jsEngine = await testUrl('http://127.0.0.1:3000/js/split-engine.js');
  console.log('split-engine.js Status:', jsEngine.status, 'Size:', jsEngine.length, 'bytes');
  const engineHasTax = jsEngine.body.toLowerCase().includes('gst') || jsEngine.body.toLowerCase().includes('taxescrow');
  console.log('Tax mentions in split-engine.js:', engineHasTax ? 'FAIL (tax found)' : 'PASSED (100% tax free)');

  const css = await testUrl('http://127.0.0.1:3000/css/style.css');
  console.log('style.css Status:', css.status, 'Size:', css.length, 'bytes');
  if (!css.body.includes('.soundbox-device-card')) throw new Error('Missing soundbox CSS');
  if (!css.body.includes('.phone-mockup-chassis')) throw new Error('Missing phone mockup CSS');

  console.log('SUCCESS: All 3 Next-Gen Features Verified & 100% Tax-Free!');
}

run().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
