import { toBase64URL, fromBase64URL } from './fido-utils';
import type { CredentialRecord, KeyMasterConfig } from '$lib/types';

/**
 * 鍵ペアを生成し、保存用レコードとCOSE形式の公開鍵を返却する
 */
export async function generateAndSaveCredential(
  rpId: string,
  user: { id: string; name: string; displayName: string },
  config: KeyMasterConfig
): Promise<{ credentialId: Uint8Array; publicKeyCose: Uint8Array; record: CredentialRecord }> {
  
  const profile = config[config.activeProfile];

  // 1. 鍵ペアの生成 (抽出可能に設定)
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  ) as CryptoKeyPair;

  // 2. Credential ID の生成 (32バイト乱数)
  const credentialId = crypto.getRandomValues(new Uint8Array(32));

  // 3. 鍵をJWK形式でエクスポート (保存・座標抽出用)
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);

  // 4. JWK から X座標と Y座標を取り出し、FIDO 用の COSE 形式に変換
  const xBytes = fromBase64URL(publicKeyJwk.x!);
  const yBytes = fromBase64URL(publicKeyJwk.y!);
  const publicKeyCose = encodeCoseES256(xBytes, yBytes);

  // 5. 保存用レコードの作成
  // ✅ 修正: key_master.json の flags をすべてそのまま出力するように変更
  const record: CredentialRecord = {
    credentialId: toBase64URL(credentialId),
    rpId,
    userId: user.id,
    userName: user.name,
    displayName: user.displayName,
    privateKeyJwk: privateKeyJwk as JsonWebKey,
    publicKeyJwk: publicKeyJwk as JsonWebKey,
    signCount: 0,
    // 互換性のための個別プロパティ保持
    backupEligibility: profile.defaultFlags.be,
    backupState: profile.defaultFlags.bs,
    // ✅ 追加: マスタの flags をオブジェクトごとコピー
    flags: { ...profile.defaultFlags },
    createdAt: Date.now(),
    lastUsedAt: null
  };

  return { credentialId, publicKeyCose, record };
}

/**
 * [内部関数] X座標とY座標(それぞれ32バイト)から ES256(-7) の COSE マップを構築する
 */
function encodeCoseES256(x: Uint8Array, y: Uint8Array): Uint8Array {
  // COSE Map(5要素) のヘッダーと固定情報
  // 0xa5 (Map 5)
  // 0x01, 0x02       -> kty (1): EC2 (2)
  // 0x03, 0x26       -> alg (3): ES256 (-7)
  // 0x20, 0x01       -> crv (-1): P-256 (1)
  const fixedHeader = new Uint8Array([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01]);
  
  // X座標データの CBOR Prefix: 0x21 (キー:-2), 0x58 0x20 (値:32バイトのバイナリ)
  const xPrefix = new Uint8Array([0x21, 0x58, 0x20]);
  
  // Y座標データの CBOR Prefix: 0x22 (キー:-3), 0x58 0x20 (値:32バイトのバイナリ)
  const yPrefix = new Uint8Array([0x22, 0x58, 0x20]);

  // 全体を1つのバイナリに結合する
  const buffer = new Uint8Array(fixedHeader.length + xPrefix.length + x.length + yPrefix.length + y.length);
  
  let offset = 0;
  buffer.set(fixedHeader, offset); offset += fixedHeader.length;
  buffer.set(xPrefix, offset); offset += xPrefix.length;
  buffer.set(x, offset); offset += x.length;
  buffer.set(yPrefix, offset); offset += yPrefix.length;
  buffer.set(y, offset);

  return buffer;
}