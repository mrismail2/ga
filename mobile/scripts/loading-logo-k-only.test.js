const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const ok = (name, condition) => {
  if (!condition) {
    console.error(`FAIL ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${name}`);
  }
};

const appJson = JSON.parse(read('app.json'));
const loadingScreen = read('src/screens/LoadingScreen.js');
const loadingDots = read('src/components/LoadingDots.js');
const app = read('App.js');

ok('native splash uses only the final white K mark',
  appJson.expo.splash.image === './assets/kobciye-mark-white.png');
ok('obsolete full-wordmark splash asset is removed',
  !fs.existsSync(path.join(root, 'assets/splash.png')));
ok('startup LoadingScreen uses the white K mark',
  loadingScreen.includes("require('../../assets/kobciye-mark-white.png')") &&
  !loadingScreen.includes('kobciye-logo-white.png'));
ok('full-screen LoadingOverlay uses the same white K mark',
  loadingDots.includes("const K_MARK_WHITE = require('../../assets/kobciye-mark-white.png')") &&
  loadingDots.includes('<Image source={K_MARK_WHITE}') &&
  !/function LoadingOverlay[\s\S]*?<LoadingDots/.test(loadingDots));
ok('all application-level loading branches use K-logo loaders',
  app.includes('<LoadingScreen onDone={() => setLoading(false)} />') &&
  (app.match(/<LoadingOverlay \/>/g) || []).length >= 3);

if (process.exitCode) process.exit(process.exitCode);
