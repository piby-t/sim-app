import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'fs';
import path from 'path';
import { webcrypto } from 'node:crypto';
import keyMaster from '$lib/data/fido/key_master.json';
import type { FidoProfile, KeyMasterConfig } from '$lib/types';

// Node.jsのWeb Crypto APIを使用
const crypto = webcrypto as unknown as Crypto;

/**
 * バイナリデータ(ArrayBuffer)を Base64URL 形式の文字列に変換します。
 */
function toBase64URL(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * ブラウザが本来生成する clientDataJSON をエミュレートします。
 */
function createClientDataJSON(type: string, challenge: string, origin: string): string {
    const payload = {
        type: type,
        challenge: challenge,
        origin: origin,
        crossOrigin: false
    };
    return toBase64URL(new TextEncoder().encode(JSON.stringify(payload)));
}

/**
 * Raw署名データを ASN.1 DER形式に変換します。
 */
function toAsn1Der(rawSignature: ArrayBuffer): Uint8Array {
    const raw = new Uint8Array(rawSignature);
    const r = raw.slice(0, 32);
    const s = raw.slice(32, 64);

    function formatInteger(bytes: Uint8Array) {
        let start = 0;
        while (start < bytes.length && bytes[start] === 0) start++;
        if (start === bytes.length) return new Uint8Array([0x00]);
        let res = bytes.slice(start);
        if (res[0] >= 0x80) {
            const padded = new Uint8Array(res.length + 1);
            padded[0] = 0x00;
            padded.set(res, 1);
            res = padded;
        }
        return res;
    }

    const rAsn1 = formatInteger(r);
    const sAsn1 = formatInteger(s);

    const seqLength = rAsn1.length + sAsn1.length + 4;
    const der = new Uint8Array(seqLength + 2);
    der[0] = 0x30;
    der[1] = seqLength;
    der[2] = 0x02;
    der[3] = rAsn1.length;
    der.set(rAsn1, 4);
    
    const offset = 4 + rAsn1.length;
    der[offset] = 0x02;
    der[offset + 1] = sAsn1.length;
    der.set(sAsn1, offset + 2);

    return der;
}

/**
 * FIDO 認証 (Assertion / Login) 用の署名データ生成エンドポイント
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const { challenge, rpId, origin, keyFileName } = await request.json();

        if (!keyFileName) return json({ error: "keyFileName is required" }, { status: 400 });

        // 1. 登録済みの鍵ファイルを読み込み
        const keyPath = path.join(process.cwd(), 'src', 'lib', 'data', 'fido', 'key', keyFileName);
        if (!fs.existsSync(keyPath)) return json({ error: "Key file not found" }, { status: 404 });

        const record = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));

        // 2. プロファイル設定の取得と Origin の決定
        const activeProfile = keyMaster.activeProfile as "ios" | "android";
        const profile: FidoProfile = (keyMaster as KeyMasterConfig)[activeProfile];

        let finalOrigin = origin || "http://localhost:5173";
        
        if (activeProfile === 'android' && profile.hash) {
            finalOrigin = profile.hash;
        } else if (activeProfile === 'ios') {
            // key_master.json の origin を優先。未定義なら rpId かリクエストの origin を使用
            finalOrigin = profile.origin || rpId || origin || finalOrigin;
        }

        // 3. clientDataJSON の構築
        const clientDataJSON = createClientDataJSON("webauthn.get", challenge, finalOrigin);
        
        // 4. authenticatorData の構築
        const rpIdHash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rpId || "localhost")));
        const flags = new Uint8Array([0x05]); // UP + UV
        
        record.signCount = (record.signCount || 0) + 1;
        fs.writeFileSync(keyPath, JSON.stringify(record, null, 2));

        const signCountBytes = new Uint8Array([
            (record.signCount >>> 24) & 0xff,
            (record.signCount >>> 16) & 0xff,
            (record.signCount >>> 8) & 0xff,
            record.signCount & 0xff
        ]);

        const authData = new Uint8Array(rpIdHash.length + flags.length + signCountBytes.length);
        authData.set(rpIdHash, 0);
        authData.set(flags, rpIdHash.length);
        authData.set(signCountBytes, rpIdHash.length + flags.length);

        // 5. 署名対象データの構築と署名実行
        const clientDataHash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(atob(clientDataJSON.replace(/-/g, '+').replace(/_/g, '/')))));
        const dataToSign = new Uint8Array(authData.length + clientDataHash.length);
        dataToSign.set(authData, 0);
        dataToSign.set(clientDataHash, authData.length);

        const privateKey = await crypto.subtle.importKey(
            "jwk",
            record.privateKeyJwk,
            { name: "ECDSA", namedCurve: "P-256" },
            false,
            ["sign"]
        );

        const signatureRaw = await crypto.subtle.sign(
            { name: "ECDSA", hash: { name: "SHA-256" } },
            privateKey,
            dataToSign
        );

        const signatureDer = toAsn1Der(signatureRaw);
        const userHandle = toBase64URL(new TextEncoder().encode(record.userId));

        // 6. 最終的なWebAuthnレスポンスオブジェクトの返却
        return json({
            clientDataJSON,
            authenticatorData: toBase64URL(authData),
            signature: toBase64URL(signatureDer),
            userHandle,
            rawId: record.credentialId,
            id: record.credentialId,
            type: "public-key"
        });

    } catch (e: unknown) {
        console.error("Authenticate Error:", e);
        const errorMessage = e instanceof Error ? e.message : String(e);
        return json({ error: errorMessage }, { status: 500 });
    }
};