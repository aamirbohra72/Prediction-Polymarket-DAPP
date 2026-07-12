export { getSolanaConfig } from "./config.js";
export { getConnection, getSolanaHealth } from "./connection.js";
export {
  createLinkMessage,
  generateNonce,
  verifyWalletSignature,
  isValidPublicKey,
} from "./walletAuth.js";
export {
  MEMO_PROGRAM_ID,
  buildTradeAttestationMemo,
  submitTradeAttestation,
  explorerTxUrl,
  explorerAddressUrl,
  getSettlementKeypair,
} from "./settlement.js";
export {
  marketKeyFromId,
  marketKeyFromIdHex,
  findMarketPda,
  getProgramId,
  outcomeToChainByte,
  chainByteToOutcome,
  isProgramConfigured,
} from "./marketKey.js";

// Lazy re-exports so missing Anchor / undeployed program never crash API boot
export async function getAnchorProgram(...args) {
  const m = await import("./program.js");
  return m.getAnchorProgram(...args);
}
export async function fetchOnChainMarketAccount(...args) {
  const m = await import("./program.js");
  return m.fetchOnChainMarketAccount(...args);
}
export async function initializeMarketOnChain(...args) {
  const m = await import("./program.js");
  return m.initializeMarketOnChain(...args);
}
export async function settleMarketOnChain(...args) {
  const m = await import("./program.js");
  return m.settleMarketOnChain(...args);
}
