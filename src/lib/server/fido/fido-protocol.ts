import { toBase64URL, aaguidToBytes } from './fido-utils';
import type { FidoFlags } from '$lib/types';

export function createClientDataJSON(type: string, challenge: string, origin: string): string {
  const clientData = { type, challenge, origin };
  return toBase64URL(new TextEncoder().encode(JSON.stringify(clientData)));
}

export async function createAuthData(
  rpId: string,
  flagsConfig: FidoFlags,
  aaguidStr: string,
  credentialId: Uint8Array,
  publicKeyCose: Uint8Array
): Promise<Uint8Array> {
  const rpIdHash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rpId)));

  let flagsValue = 0;
  if (flagsConfig.up) flagsValue |= 0x01;
  if (flagsConfig.uv) flagsValue |= 0x04;
  if (flagsConfig.be) flagsValue |= 0x08;
  if (flagsConfig.bs) flagsValue |= 0x10;
  if (flagsConfig.at) flagsValue |= 0x40;
  const flags = new Uint8Array([flagsValue]);

  const signCount = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
  const aaguid = aaguidToBytes(aaguidStr);

  const credIdLen = new Uint8Array(2);
  credIdLen[0] = (credentialId.length >> 8) & 0xff;
  credIdLen[1] = credentialId.length & 0xff;

  const authData = new Uint8Array(
    rpIdHash.length + flags.length + signCount.length + 
    aaguid.length + credIdLen.length + credentialId.length + publicKeyCose.length
  );

  let offset = 0;
  authData.set(rpIdHash, offset); offset += rpIdHash.length;
  authData.set(flags, offset); offset += flags.length;
  authData.set(signCount, offset); offset += signCount.length;
  authData.set(aaguid, offset); offset += aaguid.length;
  authData.set(credIdLen, offset); offset += credIdLen.length;
  authData.set(credentialId, offset); offset += credentialId.length;
  authData.set(publicKeyCose, offset);

  return authData;
}

export function createAttestationObjectNone(authData: Uint8Array): string {
  const prefix = new Uint8Array([0xa3]);
  const fmtPart = new Uint8Array([0x63, ...new TextEncoder().encode("fmt"), 0x64, ...new TextEncoder().encode("none")]);
  
  // ★ここを 0x68 から 0x67 に修正 ("attStmt"は7文字)
  const attPart = new Uint8Array([0x67, ...new TextEncoder().encode("attStmt"), 0xa0]);
  const authKeyPart = new Uint8Array([0x68, ...new TextEncoder().encode("authData")]);
  
  let authDataLenPrefix: Uint8Array;
  if (authData.length <= 255) {
    authDataLenPrefix = new Uint8Array([0x58, authData.length]);
  } else {
    authDataLenPrefix = new Uint8Array([0x59, authData.length >> 8, authData.length & 0xff]);
  }

  const combined = new Uint8Array(
    prefix.length + fmtPart.length + attPart.length + authKeyPart.length + authDataLenPrefix.length + authData.length
  );

  let offset = 0;
  combined.set(prefix, offset); offset += prefix.length;
  combined.set(fmtPart, offset); offset += fmtPart.length;
  combined.set(attPart, offset); offset += attPart.length;
  combined.set(authKeyPart, offset); offset += authKeyPart.length;
  combined.set(authDataLenPrefix, offset); offset += authDataLenPrefix.length;
  combined.set(authData, offset);

  return toBase64URL(combined);
}