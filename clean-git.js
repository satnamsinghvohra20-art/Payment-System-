const { execSync } = require('child_process');

try {
  execSync('git add -A', { stdio: 'inherit' });
  execSync('git commit -m "feat(landing): add commercial public sales landing page, CSV export, and WhatsApp summary dispatcher"', { stdio: 'inherit' });
  execSync('git push origin main', { stdio: 'inherit' });
  console.log('Successfully pushed all latest features to GitHub!');
} catch (e) {
  console.log('Push error:', e.message);
}
