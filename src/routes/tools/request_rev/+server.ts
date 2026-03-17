import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SimHttp } from '$lib/util/sim-http';
import { HistoryManager } from '$lib/server/history-manager';
import type { NameValue, SimReq } from '$lib/types';

/**
 * リクエスト・キャプチャ・エンドポイント (fallback)
 * 外部から送信されたあらゆる HTTP リクエストを捕捉し、
 * 内容を解析して履歴(HistoryManager)に保存した後、表示画面へ転送します。
 */
export const fallback: RequestHandler = async ({ request, url, locals }) => {
    const simses = locals.simses;

    console.log(`\n--- [DEBUG: request_rev RECEIVE] ---`);
    console.log(`Method: ${request.method}, Session: ${simses}`);

    // 1. ヘッダー情報の抽出
    // 全てのHTTPヘッダーを NameValue ペアの配列に変換して保持します。
    const reqHeaders: NameValue[] = [];
    request.headers.forEach((value, name) => reqHeaders.push({ name, value }));

    // 2. ボディデータの解析
    // Content-Type に基づき、適切な形式（配列または文字列）でデータをパースします。
    let bodyData: string | NameValue[] = "";
    const contentType = request.headers.get('content-type') || '';

    try {
        if (contentType.includes('application/x-www-form-urlencoded')) {
            // フォーム形式：キー・バリューの配列として保持
            const formData = await request.formData();
            const pairs: NameValue[] = [];
            formData.forEach((v, k) => pairs.push({ name: k, value: v.toString() }));
            bodyData = pairs;
        } else if (contentType.includes('application/json')) {
            // JSON形式：整形済みの文字列として保持
            const json = await request.json();
            bodyData = JSON.stringify(json, null, 2);
        } else {
            // その他：プレーンテキストとして保持
            bodyData = await request.text();
        }
    } catch {
        bodyData = "[Parse Error or No Body]";
    }

    /**
     * 3. 通信データの保存
     * kind: "Display" として記録することで、表示専用ページから逆引きできるようにします。
     * 応答としては一律で 200 OK (Captured) を返したことにします。
     */
    const simReq: SimReq = {
        kind: "Display",
        method: request.method,
        url: url.toString(),
        header: reqHeaders,
        body: bodyData
    };

    const simHttp = new SimHttp(simReq);
    simHttp.setResponse({ 
        kind: "API", status: 200, header: [], body: "Captured", 
        accessToken: "", refreshToken: "" 
    });

    HistoryManager.addRecord(simses, simHttp);
    
    console.log(`Saved to history. Total count: ${HistoryManager.getHistory(simses).length}`);
    console.log(`--- [DEBUG: request_rev END] ---\n`);

    /**
     * 4. 表示用ページへリダイレクト
     * POSTリクエストの場合でも、PRG（Post-Redirect-Get）パターンを適用し、
     * ブラウザを安全に「表示画面」へ移動させます。
     * (303 Redirect を使うことで、POSTをGETに変換して遷移させます)
     */
    throw redirect(303, '/tools/request_display');
};