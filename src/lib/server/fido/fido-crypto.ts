import { toBase64URL, fromBase64URL } from './fido-utils';
import type { CredentialRecord, KeyMasterConfig } from '$lib/types';

/**
 * 【FIDO2 鍵生成シミュレーション】
 * 認証器内部で新しい鍵ペアを生成し、サーバーへ送る公開鍵(COSE)と
 * シミュレーターが保持する秘密鍵情報を構築します。
 * * @param rpId - サービスを識別するID（通常はドメイン名）。署名時に一致確認が行われる。
 * @param user - ユーザー情報。サーバー側でのアカウント紐付けに使用される。
 * @param config - マスタ設定。生成される鍵のデフォルトフラグ（UV/UP/BE等）を制御。
 */
export async function generateAndSaveCredential(
  rpId: string,
  user: { id: string; name: string; displayName: string },
  config: KeyMasterConfig
): Promise<{ credentialId: Uint8Array; publicKeyCose: Uint8Array; record: CredentialRecord }> {
  
  const profile = config[config.activeProfile];

  // 1. Web Crypto API を用いた鍵ペアの生成
  // FIDO2/WebAuthn で最も一般的に利用される ES256 (ECDSA over P-256) を採用。
  // "extractable: true" とすることで、秘密鍵を JWK 形式でエクスポート可能にし、シミュレーターで再利用可能にする。
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  ) as CryptoKeyPair;

  // 2. Credential ID の生成
  // 本来は認証器が内部で生成する一意の識別子。ここでは32バイトのセキュアな乱数を使用。
  const credentialId = crypto.getRandomValues(new Uint8Array(32));

  // 3. 鍵データのエクスポート
  // 秘密鍵(JWK)は将来の「署名(Assertion)」シミュレーションで使用。
  // 公開鍵(JWK)からは、FIDO仕様で定義された COSE 形式に変換するための X/Y 座標を抽出。
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);

  // 4. 公開鍵を FIDO 標準の COSE (CBOR Object Signing and Encryption) 形式に変換
  // WebAuthn では公開鍵を JWK ではなく、バイナリ効率の良い COSE 形式でサーバーへ送信する。
  const xBytes = fromBase64URL(publicKeyJwk.x!);
  const yBytes = fromBase64URL(publicKeyJwk.y!);
  const publicKeyCose = encodeCoseES256(xBytes, yBytes);

  // 5. シミュレーター用データベース（JSONファイル）へ保存するレコードの作成
  // 本物の認証器の内部ストレージに保存されるデータに相当。
  const record: CredentialRecord = {
    credentialId: toBase64URL(credentialId),
    rpId,
    userId: user.id,
    userName: user.name,
    displayName: user.displayName,
    privateKeyJwk: privateKeyJwk as JsonWebKey,
    publicKeyJwk: publicKeyJwk as JsonWebKey,
    signCount: 0, // FIDOのクローン検知用カウンター。初回は0。

    // Authenticator Data Flags
    // 鍵の特性（バックアップ可能か、UV済みか等）を管理。
    // key_master.json のプロファイル設定を継承。
    backupEligibility: profile.defaultFlags.be,
    backupState: profile.defaultFlags.bs,
    flags: { ...profile.defaultFlags },

    createdAt: Date.now(),
    lastUsedAt: null
  };

  return { credentialId, publicKeyCose, record };
}

/**
 * [内部関数] ES256 (-7) 公開鍵を COSE 形式 (CBORバイナリ) にエンコードする
 * * FIDO2仕様における ES256 公開鍵の構造 (CBOR Map):
 * 1 (kty)  : 2 (EC2)
 * 3 (alg)  : -7 (ES256)
 * -1 (crv) : 1 (P-256)
 * -2 (x)   : [32バイトバイナリ]
 * -3 (y)   : [32バイトバイナリ]
 */
function encodeCoseES256(x: Uint8Array, y: Uint8Array): Uint8Array {
  // --- COSE Map ヘッダー ---
  // 0xa5: 5つの要素を持つ CBOR Map
  // 0x01, 0x02:  key 1 (kty) -> value 2 (EC2)
  // 0x03, 0x26:  key 3 (alg) -> value -7 (ES256) ※CBORの負の整数エンコード
  // 0x20, 0x01:  key -1 (crv) -> value 1 (P-256) ※0x20はマイナス記号に相当
  const fixedHeader = new Uint8Array([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01]);
  
  // --- X座標セクション ---
  // 0x21: key -2 (x)
  // 0x58, 0x20: Byte String (長さ32)
  const xPrefix = new Uint8Array([0x21, 0x58, 0x20]);
  
  // --- Y座標セクション ---
  // 0x22: key -3 (y)
  // 0x58, 0x20: Byte String (長さ32)
  const yPrefix = new Uint8Array([0x22, 0x58, 0x20]);

  // 全バイナリの連結
  const buffer = new Uint8Array(fixedHeader.length + xPrefix.length + x.length + yPrefix.length + y.length);
  
  let offset = 0;
  buffer.set(fixedHeader, offset); offset += fixedHeader.length;
  buffer.set(xPrefix, offset); offset += xPrefix.length;
  buffer.set(x, offset); offset += x.length;
  buffer.set(yPrefix, offset); offset += yPrefix.length;
  buffer.set(y, offset);

  return buffer;
}