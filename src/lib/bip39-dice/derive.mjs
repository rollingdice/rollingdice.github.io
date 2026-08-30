import { entropyToMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

// BIP-39: entropy bytes -> mnemonic words (space-separated), English.
// @scure/bip39 is the audited reference implementation of the BIP-39 encoding.

/**
 * The hashed construction, 100-dice variant:
 *   rollString (string of digits 1-6) -> SHA-256 -> entropy bytes -> BIP-39 mnemonic.
 * For 12 words (128 bits) use the first 16 bytes of the digest;
 * for 24 words (256 bits) use all 32 bytes.
 * Deterministic and verifiable: same roll string always yields the same seed.
 */
export async function deriveSeed(rollString, wordCount = 12) {
  if (wordCount !== 12 && wordCount !== 24) {
    throw new Error('wordCount must be 12 or 24');
  }
  if (!/^[1-6]+$/.test(rollString) || rollString.length < 1) {
    throw new Error('rollString must be a non-empty string of digits 1-6');
  }
  // SHA-256 over the ASCII digits, exactly as typed.
  const hashBytes = await sha256(new TextEncoder().encode(rollString));
  const entropy = wordCount === 12 ? hashBytes.slice(0, 16) : hashBytes;
  const mnemonic = entropyToMnemonic(entropy, wordlist);
  return { entropyHex: toHex(entropy), mnemonic };
}

async function sha256(bytes) {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return new Uint8Array(digest);
  }
  // Insecure context (http://<LAN-IP>, file://): crypto.subtle is unavailable.
  // Fall back to the audited pure-JS SHA-256 from @noble/hashes (same author as
  // @scure/bip39). Deterministic, zero network, honors ADR-0004.
  const { sha256: nobleSha256 } = await import('@noble/hashes/sha2.js');
  return nobleSha256(bytes);
}

function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Self-test: reproduce the published test vectors from the reference page
 * (kdmukai-bot.github.io/seedsigner-ai-analysis/dice/standard.html#hash).
 * 50 rolls -> 12 words, 99 rolls -> 24 words.
 */
export const TEST_VECTORS = [
  {
    rolls: '65515223131652132161133154444123616466443112153441',
    words: 12,
    entropyHex: '6cb09af855050dcde6fe2adc3181c250',
    mnemonic: 'hole luggage safe present express tragic orbit shed switch metal identify path',
  },
  {
    rolls: '655152231316521321611331544441236164664431121534415633526456254462245546236542364246312613322234612',
    words: 24,
    entropyHex: '51531761ec7a738946e0b9f46bb11320a695495430e345c14f01ad8b3b898a6d',
    mnemonic: 'eyebrow obvious such suggest poet seven breeze blame virtual frown dynamic donor harsh pigeon express broccoli easy apology scatter force recipe shadow claim radio',
  },
];

export async function checkVectors() {
  const results = [];
  for (const v of TEST_VECTORS) {
    const { entropyHex, mnemonic } = await deriveSeed(v.rolls, v.words);
    results.push({
      words: v.words,
      entropyOk: entropyHex === v.entropyHex,
      mnemonicOk: mnemonic === v.mnemonic,
    });
  }
  const ok = results.every((r) => r.entropyOk && r.mnemonicOk);
  if (!ok) {
    throw new Error(`BIP-39 vector check failed: ${JSON.stringify(results)}`);
  }
  return results;
}
