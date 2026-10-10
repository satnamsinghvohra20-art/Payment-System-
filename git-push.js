const { execSync } = require('child_process');

try {
  console.log('Staging files...');
  execSync('git add -A', { stdio: 'inherit' });
  
  console.log('Committing changes...');
  execSync('git commit -m "feat: add full bank account linking, SMS device binding, check balance with MPIN, and connected payment debiting"', { stdio: 'inherit' });
  
  console.log('Pushing to GitHub...');
  const out = execSync('git push origin main', { encoding: 'utf8' });
  console.log('Push Result:', out);
  console.log('SUCCESS: Pushed to GitHub successfully!');
} catch (err) {
  console.error('Git error:', err.message);
  process.exit(1);
}
