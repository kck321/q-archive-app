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

export interface CryptoWallet {
  /** Ticker shown on the chip, e.g. "BTC". */
  symbol: string
  /** Full name shown under it. */
  name: string
  /** Network/notes shown as a caution line — important where a coin has several chains. */
  network: string
  /** Your receiving address. EMPTY = coin hidden from the page. */
  address: string
}

export const CRYPTO_WALLETS: CryptoWallet[] = [
  { symbol: 'BTC',  name: 'Bitcoin',   network: 'Bitcoin network (BTC) only',        address: '' },
  { symbol: 'ETH',  name: 'Ethereum',  network: 'Ethereum mainnet (ERC-20)',         address: '' },
  { symbol: 'SOL',  name: 'Solana',    network: 'Solana network only',               address: '' },
  { symbol: 'XMR',  name: 'Monero',    network: 'Monero network only',               address: '' },
  { symbol: 'LTC',  name: 'Litecoin',  network: 'Litecoin network only',             address: '' },
  { symbol: 'USDT', name: 'Tether',    network: 'Ethereum mainnet (ERC-20) only',    address: '' },
]

/** Only wallets you have actually filled in. */
export function activeWallets(): CryptoWallet[] {
  return CRYPTO_WALLETS.filter(w => w.address.trim().length > 0)
}
