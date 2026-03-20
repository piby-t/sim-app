/**
 * 【Base64URL エンコード】
 * FIDO2/WebAuthn 仕様で規定されたデータ転送形式。
 * 通常の Base64 から、URL で特別な意味を持つ文字 (+, /) を置換し、
 * 末尾のパディング (=) を除去した形式です。
 * * @param buffer - エンコード対象のバイナリデータ (Uint8Array または ArrayBuffer)
 * @returns Base64URL 形式の文字列
 */
export function toBase64URL(buffer: ArrayBuffer | Uint8Array): string {
  // 入力を一貫して Uint8Array として扱う
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  // 1. btoa で標準 Base64 に変換
  // 2. '+' を '-' に、'/' を '_' に置換 (URLセーフ化)
  // 3. '=' を除去 (パディングなし)
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * 【Base64URL デコード】
 * サーバーから送られてきた Base64URL 文字列を、
 * 署名検証などで利用可能なバイナリ形式 (Uint8Array) に復元します。
 * * @param base64url - デコード対象の Base64URL 文字列
 * @returns 復元されたバイナリデータ
 */
export function fromBase64URL(base64url: string): Uint8Array {
  // 1. URLセーフな文字を標準 Base64 に戻す
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  
  // 2. Base64 は 4 文字単位である必要があるため、不足分を '=' でパディング
  const pad = base64.length % 4;
  const paddedBase64 = pad ? base64 + "=".repeat(4 - pad) : base64;
  
  // 3. atob でバイナリ文字列に変換
  const binary = atob(paddedBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 【AAGUID 文字列のバイナリ変換】
 * AAGUID (Authenticator Attestation GUID) は、認証器のモデルを識別する 128bit の識別子です。
 * * 仕様上、Authenticator Data (authData) 内には、ハイフンなしの 16バイト・バイナリ
 * として埋め込む必要があるため、UUID 形式の文字列から変換を行います。
 * * @param aaguid - UUID 形式の文字列 (例: "00000000-0000-0000-0000-000000000000")
 * @returns 16バイトのバイナリデータ
 */
export function aaguidToBytes(aaguid: string): Uint8Array {
  // ハイフンを除去して 32文字の 16進数文字列にする
  const hex = aaguid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  
  // 2文字ずつ読み取って数値 (Byte) に変換
  for (let i = 0; i < 16; i++) {
    // substring で 2bit ずつ切り出し、16進数としてパース
    // パース失敗時は FIDO 仕様に基づき 0x00 で埋める
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16) || 0;
  }
  return bytes;
}