import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';
import { createClientDataJSON, createAuthData, createAttestationObjectNone } from '$lib/server/fido/fido-protocol';
import { fromBase64URL } from '$lib/server/fido/fido-utils';
import { loadExternalJson } from '$lib/server/util/file-loader'; // ✅ 共通関数をインポート
import type { FidoProfile, KeyMasterConfig } from '$lib/types';

/**
 * JWK の座標 (x, y) を 32バイトにパディングする
 */
function pad32(arr: Uint8Array): Uint8Array {
  if (arr.length === 32) return arr;
  const padded = new Uint8Array(32);
  if (arr.length < 32) {
    padded.set(arr, 32 - arr.length);
  } else {
    return arr.slice(arr.length - 32);
  }
  return padded;
}

/**
 * FIDO 登録用 Attestation 生成エンドポイント
 * 外部の data/fido フォルダを参照し、ポータブルに動作します。
 */
export async function POST({ request }) {
  try {
    const { 
        challenge, 
        rpId, 
        origin, 
        keyFileName, 
        type = "webauthn.create", 
        flagsOverride, 
        signCountOverride 
    } = await request.json();

    if (!keyFileName) return json({ error: "keyFileName is required" }, { status: 400 });

    // 💡 修正ポイント: 共通 loader で key_master.json を取得
    const keyMaster = loadExternalJson<KeyMasterConfig>('data/fido/key_master.json');
    if (!keyMaster) {
        return json({ error: "key_master.json not found in external data folder" }, { status: 500 });
    }

    const activeProfile = keyMaster.activeProfile as "ios" | "android";
    const profile: FidoProfile = keyMaster[activeProfile];
    if (!profile) return json({ error: `Profile ${activeProfile} not found` }, { status: 500 });

    // 💡 修正ポイント: 外部パス解決 (配布パッケージ直下の data/ を参照)
    const keyPath = path.resolve(process.cwd(), 'data', 'fido', 'key', keyFileName);
    if (!fs.existsSync(keyPath)) {
        return json({ error: `Key file not found: ${keyPath}` }, { status: 404 });
    }

    const record = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));

    // Origin の決定
    let finalOrigin = origin || "http://localhost:5173";
    if (activeProfile === 'android' && profile.hash) {
      finalOrigin = profile.hash;
    } else if (activeProfile === 'ios') {
      finalOrigin = profile.origin || rpId || origin || finalOrigin; 
    }

    const clientDataJSON = createClientDataJSON(type, challenge, finalOrigin);
    const credentialIdBytes = fromBase64URL(record.credentialId);
    
    // 公開鍵 (COSE形式) の組み立て
    const xBytes = pad32(fromBase64URL(record.publicKeyJwk.x));
    const yBytes = pad32(fromBase64URL(record.publicKeyJwk.y));
    
    const fixedHeader = new Uint8Array([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01]);
    const xPrefix = new Uint8Array([0x21, 0x58, 0x20]);
    const yPrefix = new Uint8Array([0x22, 0x58, 0x20]);
    
    const publicKeyCose = new Uint8Array(fixedHeader.length + xPrefix.length + xBytes.length + yPrefix.length + yBytes.length);
    let offset = 0;
    publicKeyCose.set(fixedHeader, offset); offset += fixedHeader.length;
    publicKeyCose.set(xPrefix, offset); offset += xPrefix.length;
    publicKeyCose.set(xBytes, offset); offset += xBytes.length;
    publicKeyCose.set(yPrefix, offset); offset += yPrefix.length;
    publicKeyCose.set(yBytes, offset);

    // 認証データ (authData) の生成
    const authData = await createAuthData(rpId, profile.defaultFlags, profile.aaguid, credentialIdBytes, publicKeyCose);

    // ✅ UIからの手動上書きがある場合、バイナリを直接操作
    if (flagsOverride !== undefined || signCountOverride !== undefined) {
      if (flagsOverride !== undefined) {
        authData[32] = flagsOverride & 0xff;
      }
      if (signCountOverride !== undefined) {
        authData[33] = (signCountOverride >> 24) & 0xff;
        authData[34] = (signCountOverride >> 16) & 0xff;
        authData[35] = (signCountOverride >> 8) & 0xff;
        authData[36] = signCountOverride & 0xff;
      }
    }

    // AttestationObject の最終構成 (none 形式)
    const attestationObject = createAttestationObjectNone(authData);

    return json({
      clientDataJSON,
      attestationObject,
      rawId: record.credentialId,
      id: record.credentialId,
      type: "public-key"
    });

  } catch (e: unknown) {
    console.error("[FIDO GENERATE ERROR]", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return json({ error: errorMessage }, { status: 500 });
  }
}