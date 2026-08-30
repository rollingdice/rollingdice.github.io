// Reproduces the published BIP-39 dice test vectors from the reference page.
// Run: node scripts/check-vectors.mjs
// Requires the derive module's pure functions; @scure/bip39 needs no browser.

import { checkVectors } from '../src/lib/bip39-dice/derive.mjs';

try {
  const results = await checkVectors();
  console.log('All BIP-39 dice vectors reproduced:');
  for (const r of results) {
    console.log(`  ${r.words} words: entropy ${r.entropyOk ? 'OK' : 'FAIL'}, mnemonic ${r.mnemonicOk ? 'OK' : 'FAIL'}`);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
