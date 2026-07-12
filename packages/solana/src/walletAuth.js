import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import crypto from "crypto";

export function createLinkMessage({ appName, userId, nonce, cluster }) {
  return [
    `${appName} — Link Solana wallet`,
    `User ID: ${userId}`,
    `Nonce: ${nonce}`,
    `Cluster: ${cluster}`,
    `Issued: ${new Date().toISOString()}`,
  ].join("\n");
}

export function generateNonce() {
  return crypto.randomBytes(16).toString("hex");
}

export function verifyWalletSignature({ publicKeyBase58, message, signatureBase58 }) {
  try {
    const publicKey = new PublicKey(publicKeyBase58);
    const messageBytes =
      typeof message === "string" ? new TextEncoder().encode(message) : message;
    const signature = bs58.decode(signatureBase58);
    const valid = nacl.sign.detached.verify(
      messageBytes,
      signature,
      publicKey.toBytes()
    );
    return { valid, publicKey: publicKey.toBase58() };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

export function isValidPublicKey(address) {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}
