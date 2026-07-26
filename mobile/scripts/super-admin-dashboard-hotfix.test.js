const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'components', 'SchoolHero.js');
const src = fs.readFileSync(file, 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

assert(!src.includes('s.id === active.id'), 'SchoolHero never dereferences active.id when active may be null');
assert(src.includes('active?.id'), 'SchoolHero compares selected branch with a null-safe active school id');
assert(src.includes('{isSwitchable ? ('), 'branch-switcher modal renders only when switching is available');

if (process.exitCode) process.exit(process.exitCode);
