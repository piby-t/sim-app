import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';
import keyMaster from '$lib/data/fido/key_master.json';
import { createClientDataJSON, createAuthData, createAttestationObjectNone } from '$lib/server/fido/fido-protocol';
import { fromBase64URL } from '$lib/server/fido/fido-utils';
import type { FidoProfile, KeyMasterConfig } from '$lib/types';

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

export async function POST({ request }) {
  try {
    // ✅ 追加：UIから送られる override 値を受け取る
    const { challenge, rpId, origin, keyFileName, type = "webauthn.create", flagsOverride, signCountOverride } = await request.json();

    if (!keyFileName) return json({ error: "keyFileName is required" }, { status: 400 });

    const keyPath = path.join(process.cwd(), 'src', 'lib', 'data', 'fido', 'key', keyFileName);
    if (!fs.existsSync(keyPath)) return json({ error: "Key file not found" }, { status: 404 });

    const record = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
    
    const activeProfile = keyMaster.activeProfile as "ios" | "android";
    const profile: FidoProfile = (keyMaster as KeyMasterConfig)[activeProfile];

    let finalOrigin = origin || "http://localhost:5173";
    if (activeProfile === 'android' && profile.hash) {
      finalOrigin = profile.hash;
    } else if (activeProfile === 'ios') {
      finalOrigin = profile.origin || rpId || origin || finalOrigin; 
    }

    const clientDataJSON = createClientDataJSON(type, challenge, finalOrigin);
    const credentialIdBytes = fromBase64URL(record.credentialId);
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

    // 一旦標準データで作成
    const authData = await createAuthData(rpId, profile.defaultFlags, profile.aaguid, credentialIdBytes, publicKeyCose);

    // ✅ 追加：フラグやSignCountが手動で上書きされた場合、バイナリを直接書き換える
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

    // 書き換わった authData で Attestation を再構成
    const attestationObject = createAttestationObjectNone(authData);

    return json({
      clientDataJSON,
      attestationObject,
      rawId: record.credentialId,
      id: record.credentialId,
      type: "public-key"
    });

  } catch (e: unknown) {
    console.error("Generate Error:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return json({ error: errorMessage }, { status: 500 });
  }
}