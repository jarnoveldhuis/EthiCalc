// Check for CI or Vercel environments
const isCi = process.env.CI !== undefined;
const isVercel = process.env.VERCEL !== undefined;

// Skip husky installation in CI environments or Vercel
if (isCi || isVercel) {
  console.log('🚫 Skipping husky setup in CI/Vercel environment');
  process.exit(0);
}

try {
  // Check if .git directory exists (husky only works in git repos)
  const fs = require('fs');
  if (!fs.existsSync('.git')) {
    console.log('⚠️ No .git directory found, skipping husky setup');
    process.exit(0);
  }

  // Otherwise, continue with husky setup
  console.log('🐶 Setting up husky hooks...');
  const { execSync } = require('child_process');
  execSync('npx husky install', { stdio: 'inherit' });
  console.log('✅ Husky setup complete');
} catch (error) {
  console.error('❌ Husky setup failed:', error);
  // Don't fail the build if husky setup fails
  process.exit(0);
}