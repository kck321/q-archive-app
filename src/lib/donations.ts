// ─── Crypto donation addresses ────────────────────────────────────────────────
//
//  👉 EDIT THIS FILE to go live. Replace each empty `address` with your own wallet.
//
// An address left empty is simply NOT rendered on the Donate page — the coin is skipped
// entirely. That is deliberate: a wrong or placeholder address sends real money to a
// wallet nobody controls and it cannot be reversed. Better to show three coins that work
// than five where two are dead.
//
// Double-check every address by pasting it back into your wallet before publishing.
// Copy/paste is the only safe way to enter these — never retype one by hand.
//
// ─── The QR codes ──────────────────────────────────────────────────────────────
// Each `qr` is an SVG GENERATED FROM the `address` string beside it, never a picture from a
// wallet app, so the two cannot say different things. To add or change one:
//
//   1. generate:  npx qrcode --output btc.svg --type svg --error-correction-level M "<address>"
//   2. PROVE IT: render the SVG and decode it back with a real decoder (jsQR), and assert the
//      decoded text equals the address character for character. A QR nobody decoded is a guess,
//      and a wrong one sends money that cannot be recalled.
//   3. drop it in src/assets/qr/ and point `qr` at it.
//
// Every code below was verified this way on 2026-08-23 — each decoded back to the exact
// address beside it, byte for byte.
//
// The addresses themselves were checked against their OWN checksums the same day, which is
// what catches a character mistyped in transit: BTC valid bech32 (hrp "bc", witness v0,
// 20-byte program), ETH valid EIP-55 casing — so the mixed case is load-bearing, never
// lower-case it — XRP valid base58check (accountID, 20-byte payload).
import btcQr from '../assets/qr/btc.svg'
import ethQr from '../assets/qr/eth.svg'
import xrpQr from '../assets/qr/xrp.svg'

export interface CryptoWallet {
  /** Ticker shown on the chip, e.g. "BTC". */
  symbol: string
  /** Full name shown under it. */
  name: string
  /** Network/notes shown as a caution line — important where a coin has several chains. */
  network: string
  /** Your receiving address. EMPTY = coin hidden from the page. */
  address: string
  /** Optional QR generated FROM `address` — see the note at the top of this file. */
  qr?: string
}

export const CRYPTO_WALLETS: CryptoWallet[] = [
  { symbol: 'BTC',  name: 'Bitcoin',   network: 'Bitcoin network (BTC) only',        address: 'bc1qcj0z5yruk5560f6sas4tuaphtdmqqum4p92x42', qr: btcQr },
  { symbol: 'ETH',  name: 'Ethereum',  network: 'Ethereum mainnet (ERC-20) only',
    address: '0xAC9dE1274D6A9D1bB4F475E757538B8df09A4fcd', qr: ethQr },
  // XRP — UNRESOLVED, owner to confirm: if this is an EXCHANGE deposit address it needs a
  // destination tag, and a tagless send to one is lost. The line below claims nothing either
  // way. Once confirmed, either append "— no destination tag needed" (self-custody XRPL
  // account) or put the tag on the page beside the address.
  { symbol: 'XRP',  name: 'XRP Ledger', network: 'XRP Ledger (XRP) only',
    address: 'rBaMkCKexmMs5YMkyQ2dit2J3uzTjAfish', qr: xrpQr },
  { symbol: 'SOL',  name: 'Solana',    network: 'Solana network only',               address: '' },
  { symbol: 'XMR',  name: 'Monero',    network: 'Monero network only',               address: '' },
  { symbol: 'LTC',  name: 'Litecoin',  network: 'Litecoin network only',             address: '' },
  { symbol: 'USDT', name: 'Tether',    network: 'Ethereum mainnet (ERC-20) only',    address: '' },
]

/** Only wallets you have actually filled in. */
export function activeWallets(): CryptoWallet[] {
  return CRYPTO_WALLETS.filter(w => w.address.trim().length > 0)
}
