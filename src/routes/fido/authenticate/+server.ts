import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'fs';
import path from 'path';
import { webcrypto } from 'node:crypto';
import keyMasterJson from '$lib/data/fido/key_master.json';
import type { KeyMasterConfig, CredentialRecord } from '$lib/types';

const crypto = webcrypto as unknown as Crypto;
const keyMaster = keyMasterJson as unknown as KeyMasterConfig;

function toBase64URL(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function createClientDataJSON(type: string, challenge: string, origin: string): string {
    return toBase64URL(new TextEncoder().encode(JSON.stringify({ type, challenge, origin, crossOrigin: false })));
}

function toAsn1Der(rawSignature: ArrayBuffer): Uint8Array {
    const raw = new Uint8Array(rawSignature);
    const r = raw.slice(0, 32); const s = raw.slice(32, 64);
    function fmt(b: Uint8Array) {
        let st = 0; while (st < b.length && b[st] === 0) st++;
        let res = st === b.length ? new Uint8Array([0x00]) : b.slice(st);
        if (res[0] >= 0x80) { const p = new Uint8Array(res.length + 1); p.set(res, 1); res = p; }
        return res;
    }
    const rA = fmt(r); const sA = fmt(s);
    const der = new Uint8Array(rA.length + sA.length + 6);
    der[0] = 0x30; der[1] = der.length - 2; der[2] = 0x02; der[3] = rA.length;
    der.set(rA, 4); der[rA.length + 4] = 0x02; der[rA.length + 5] = sA.length;
    der.set(sA, rA.length + 6);
    return der;
}

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { challenge, rpId, origin, keyFileName, flagsOverride, signCountOverride } = await request.json();

        const keyPath = path.join(process.cwd(), 'src', 'lib', 'data', 'fido', 'key', keyFileName);
        const record = JSON.parse(fs.readFileSync(keyPath, 'utf-8')) as CredentialRecord;
        const profile = keyMaster[keyMaster.activeProfile];

        let finalOrigin = profile.origin || rpId || origin || "http://localhost:5173";
        if (keyMaster.activeProfile === 'android' && profile.hash) finalOrigin = profile.hash;

        const clientDataJSON = createClientDataJSON("webauthn.get", challenge, finalOrigin);
        
        // 画面からの入力を優先（未指定ならデフォルト値）
        const flagsValue = flagsOverride ?? 0x05;
        const sCount = signCountOverride ?? ((record.signCount || 0) + 1);

        const rpIdHash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rpId || "localhost")));
        const flags = new Uint8Array([flagsValue]);
        const sBytes = new Uint8Array([(sCount >>> 24) & 0xff, (sCount >>> 16) & 0xff, (sCount >>> 8) & 0xff, sCount & 0xff]);

        const authData = new Uint8Array(37);
        authData.set(rpIdHash, 0); authData.set(flags, 32); authData.set(sBytes, 33);

        const clientDataHash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(atob(clientDataJSON.replace(/-/g, '+').replace(/_/g, '/')))));
        const dataToSign = new Uint8Array(37 + 32);
        dataToSign.set(authData, 0); dataToSign.set(clientDataHash, 37);

        const privateKey = await crypto.subtle.importKey("jwk", record.privateKeyJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
        const sigRaw = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, dataToSign);

        return json({
            clientDataJSON,
            authenticatorData: toBase64URL(authData),
            signature: toBase64URL(toAsn1Der(sigRaw)),
            userHandle: toBase64URL(new TextEncoder().encode(record.userId)),
            rawId: record.credentialId, id: record.credentialId, type: "public-key"
        });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return json({ error: errorMessage }, { status: 500 });
    }
};