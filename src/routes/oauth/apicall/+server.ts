import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SimHttp } from '$lib/util/sim-http';
import { HistoryManager } from '$lib/server/history-manager';
import { SessionContext } from '$lib/server/session-context';
import type { SimRes, SimReq } from '$lib/types';
import { ExecutorFactory } from '$lib/server/executor/ExecutorFactory';

import * as jose from 'jose';
import fs from 'fs';
import path from 'path';

/**
 * API実行エンドポイント (POST)
 * クライアントからのリクエストを受け取り、適切な Executor で実行、
 * 結果を解析して履歴とセッションコンテキストに保存します。
 */
export const POST: RequestHandler = async ({ request, cookies, locals, fetch }) => {
    // セッションIDの特定
    const simses = locals.simses || cookies.get('simses') || 'default-session';
    
    let requestData;
    try {
        requestData = await request.json();
    } catch {
        return json({ success: false, error: "Invalid JSON" }, { status: 400 });
    }

    const { method, url, headers, body, isUrlEncoded } = requestData;

    // 実行前リクエスト情報の構築
    const simReq: SimReq = {
        kind: "API",
        method,
        url,
        header: headers,
        body: body
    };

    const simHttp = new SimHttp(simReq);
    let simRes: SimRes;

    try {
        // 1. Executor（Fetch または SSHCurl）の生成と実行
        // SvelteKit 専用の fetch をファクトリに渡す
        const executor = ExecutorFactory.create(fetch);
        const response = await executor.execute({
            method,
            url,
            headers,
            body,
            isUrlEncoded
        });

        const status = response.status;
        const resHeaders = response.headers;
        const resBody = response.body;

        let accessToken = "";
        let refreshToken = "";
        let idToken = "";

        // 2. レスポンスボディからトークン類を抽出してコンテキストを更新
        try {
            const jsonRes = JSON.parse(resBody);
            accessToken = jsonRes.access_token || "";
            refreshToken = jsonRes.refresh_token || "";
            idToken = jsonRes.id_token || "";
            
            // 次のAPIリクエストで使えるように自動保存
            if (accessToken) SessionContext.setValue(simses, 'accessToken', accessToken);
            if (refreshToken) SessionContext.setValue(simses, 'refreshToken', refreshToken);
            if (idToken) SessionContext.setValue(simses, 'idToken', idToken);
        } catch { /* JSONでない場合はスキップ */ }

        // 3. IDトークンの解析と検証 (OIDCの場合)
        if (idToken) {
            let isValid = false;
            let headerObj = {};
            let payloadObj = {};
            let signature = "";

            try {
                // ローカルの公開鍵セット (svk.json) を使用して署名検証を試行
                const jwksPath = path.resolve('src/lib/data/oauth/svk.json');
                const jwks = JSON.parse(fs.readFileSync(jwksPath, 'utf-8'));
                const JWKS = jose.createLocalJWKSet(jwks);
                
                const { payload, protectedHeader } = await jose.jwtVerify(idToken, JWKS);
                headerObj = protectedHeader;
                payloadObj = payload;
                signature = idToken.split('.')[2];
                isValid = true;
            } catch {
                // 検証失敗時はデコードのみ行う
                try {
                    const parts = idToken.split('.');
                    const decode = (str: string) => Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
                    headerObj = JSON.parse(decode(parts[0]));
                    payloadObj = JSON.parse(decode(parts[1]));
                    signature = parts[2] || "";
                } catch { /* デコード失敗 */ }
            }

            // OIDC用レスポンス構造の作成
            simRes = {
                kind: "OIDC",
                status,
                header: resHeaders,
                body: resBody,
                accessToken,
                refreshToken,
                idToken,
                idTokenHeader: JSON.stringify(headerObj, null, 2),
                idTokenPayload: JSON.stringify(payloadObj, null, 2),
                idTokensignature: signature,
                idTokenDecoded: JSON.stringify(payloadObj, null, 2),
                idTokenValid: isValid
            };
        } else if (accessToken) {
            // 通常のOAuth2トークンレスポンス
            simRes = {
                kind: "TOKEN",
                status,
                header: resHeaders,
                body: resBody,
                accessToken,
                refreshToken
            };
        } else {
            // 一般的なAPIレスポンス
            simRes = {
                kind: "API",
                status,
                header: resHeaders,
                body: resBody,
                accessToken: "",
                refreshToken: ""
            };
        }

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[ERROR] +server.ts:", msg);
        simRes = {
            kind: "API",
            status: 500,
            header: [],
            body: `Execution Error: ${msg}`,
            accessToken: "",
            refreshToken: ""
        };
    }

    // 4. 通信結果を履歴マネージャーへ登録
    simHttp.setResponse(simRes);
    HistoryManager.addRecord(simses, simHttp);

    return json({ success: true });
};