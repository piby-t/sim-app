import { toBase64URL, aaguidToBytes } from './fido-utils';
import type { FidoFlags } from '$lib/types';

/**
 * 【Client Data JSON の生成】
 * ブラウザが作成する JSON オブジェクト。
 * チャレンジ、オリジン、および動作タイプ（登録/認証）が含まれ、
 * これに対する署名を行うことでフィッシング攻撃を防ぎます。
 */
export function createClientDataJSON(type: string, challenge: string, origin: string): string {
  const clientData = { type, challenge, origin };
  // 文字列を UTF-8 エンコードし、Base64URL 形式で出力
  return toBase64URL(new TextEncoder().encode(JSON.stringify(clientData)));
}

/**
 * 【Authenticator Data (authData) の生成】
 * 認証器が生成するバイナリデータ。
 * 誰が(rpIdHash)、どのような状態で(flags)、どの鍵で(attestedCredentialData)
 * 登録しようとしているかの情報を連結したものです。
 * * [バイナリ構造]
 * 1. rpIdHash (32byte): RP ID の SHA-256 ハッシュ
 * 2. flags (1byte): UP, UV, AT 等のビットフラグ
 * 3. signCount (4byte): 署名回数（登録時は通常 0）
 * 4. attestedCredentialData: (ATフラグが1の場合のみ存在)
 * - aaguid (16byte): デバイス識別子
 * - credIdLen (2byte): 鍵IDの長さ
 * - credentialId (可変): 鍵ID本体
 * - publicKeyCose (可変): 公開鍵本体
 */
export async function createAuthData(
  rpId: string,
  flagsConfig: FidoFlags,
  aaguidStr: string,
  credentialId: Uint8Array,
  publicKeyCose: Uint8Array
): Promise<Uint8Array> {
  // RP ID のハッシュ化。ブラウザは自身が現在いるオリジンとこれが一致するか検証する。
  const rpIdHash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rpId)));

  // フラグのビット演算
  // 0x01: UP (User Present) - ユーザーが物理的に操作したか
  // 0x04: UV (User Verified) - PINや生体認証で本人確認したか
  // 0x40: AT (Attested Credential Data) - 鍵データが含まれているか（登録時は必須）
  let flagsValue = 0;
  if (flagsConfig.up) flagsValue |= 0x01;
  if (flagsConfig.uv) flagsValue |= 0x04;
  if (flagsConfig.be) flagsValue |= 0x08;
  if (flagsConfig.bs) flagsValue |= 0x10;
  if (flagsConfig.at) flagsValue |= 0x40;
  const flags = new Uint8Array([flagsValue]);

  // signCount: 4バイトのビッグエンディアン。クローン検知用。
  const signCount = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
  
  // aaguid: 認証器のモデルを識別するID。シミュレーターでは固定値やランダム値。
  const aaguid = aaguidToBytes(aaguidStr);

  // credentialId の長さを 2バイト(16bit) で表現
  const credIdLen = new Uint8Array(2);
  credIdLen[0] = (credentialId.length >> 8) & 0xff;
  credIdLen[1] = credentialId.length & 0xff;

  // 各パーツを連結
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

/**
 * 【Attestation Object (fmt: none) の生成】
 * authData と登録証明(Attestation)を統合した CBOR Map オブジェクト。
 * ここでは「none」形式（証明を必要としない自己署名に近い形式）をシミュレート。
 * * [CBOR Map 構造]
 * {
 * "fmt": "none",
 * "attStmt": {},
 * "authData": <バイナリデータ>
 * }
 */
export function createAttestationObjectNone(authData: Uint8Array): string {
  // 0xa3: 3つの要素を持つ CBOR Map
  const prefix = new Uint8Array([0xa3]);
  
  // "fmt": "none" セクション
  // 0x63: 3バイトの文字列 "fmt", 0x64: 4バイトの文字列 "none"
  const fmtPart = new Uint8Array([0x63, ...new TextEncoder().encode("fmt"), 0x64, ...new TextEncoder().encode("none")]);
  
  // "attStmt": {} セクション
  // none形式の場合、証明文(attStmt)は空のマップ 0xa0 となる
  // 0x67: 7バイトの文字列 "attStmt"
  const attPart = new Uint8Array([0x67, ...new TextEncoder().encode("attStmt"), 0xa0]);
  
  // "authData" セクション
  // 0x68: 8バイトの文字列 "authData"
  const authKeyPart = new Uint8Array([0x68, ...new TextEncoder().encode("authData")]);
  
  // バイナリデータの長さプレフィックス (CBOR Byte String)
  // 0x58: 長さが1バイト(255以下)で続く, 0x59: 長さが2バイトで続く
  let authDataLenPrefix: Uint8Array;
  if (authData.length <= 255) {
    authDataLenPrefix = new Uint8Array([0x58, authData.length]);
  } else {
    authDataLenPrefix = new Uint8Array([0x59, authData.length >> 8, authData.length & 0xff]);
  }

  // 全パーツの結合
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