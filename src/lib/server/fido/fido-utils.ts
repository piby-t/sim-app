/**
 * バイナリを Base64URL 文字列に変換する
 */
export function toBase64URL(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Base64URL 文字列をバイナリ (Uint8Array) に戻す
 */
export function fromBase64URL(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const paddedBase64 = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(paddedBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * AAGUID (UUID文字列) を 16バイトの Uint8Array に変換する
 */
export function aaguidToBytes(aaguid: string): Uint8Array {
  const hex = aaguid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16) || 0;
  }
  return bytes;
}