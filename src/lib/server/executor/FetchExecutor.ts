import type { HttpExecutor, HttpRequestOptions, HttpResponse } from './HttpExecutor';
import type { NameValue, JsonValue } from '$lib/types';
import { setGlobalDispatcher, ProxyAgent, Agent } from 'undici';

// ============================================================================
// グローバル通信エージェントの設定 (Node.js 18+ / undici 対応)
// ============================================================================
// 環境変数からプロキシURLを取得します（大文字・小文字の両方に対応）
const proxyUrl = process.env.HTTP_PROXY || process.env.http_proxy || process.env.HTTPS_PROXY || process.env.https_proxy;

if (proxyUrl) {
    // プロキシ環境変数が存在する場合、undiciの全通信をプロキシ経由に強制
    setGlobalDispatcher(new ProxyAgent({
        uri: proxyUrl
    }));
} else {
    // プロキシが存在しない場合のデフォルトエージェント
    setGlobalDispatcher(new Agent());
}

/**
 * 標準の Fetch API を使用してHTTP通信を実行するクラス
 */
export class FetchExecutor implements HttpExecutor {
    /**
     * SvelteKitが拡張した特別なfetch関数、または標準のグローバルfetchを保持
     */
    private svelteFetch: typeof fetch;

    /**
     * コンストラクタ
     * @param customFetch SvelteKitの `+server.ts` や `load` 関数から渡される専用の `fetch` を受け取ります。
     * 指定されない場合は、Node.js標準の `globalThis.fetch` にフォールバックします。
     */
    constructor(customFetch?: typeof fetch) {
        this.svelteFetch = customFetch || globalThis.fetch;
    }

    /**
     * 指定されたオプションに基づいてHTTPリクエストを実行します。
     * @param options メソッド、URL、ヘッダー、ボディなどのリクエスト情報
     * @returns 統一されたHttpResponseオブジェクトを返すPromise
     */
    async execute(options: HttpRequestOptions): Promise<HttpResponse> {
        const { method, url, headers, body, isUrlEncoded } = options;

        // 【修正】同名のヘッダーが上書きされて消えるバグを防ぐため、Headersオブジェクトを使用
        const fetchHeaders = new Headers();
        headers.forEach((h: NameValue) => {
            fetchHeaders.append(h.name.toLowerCase(), h.value);
        });

        // fetchのリクエストオプションを構築 (固定のUser-Agentを廃止し、引数のヘッダーを純粋に適用)
        const fetchOptions: RequestInit = {
            method,
            headers: fetchHeaders
        };

        // GET, HEADメソッド以外で送信データ(body)が存在する場合のデータ構築ロジック
        if (method !== 'GET' && method !== 'HEAD' && body) {
            if (isUrlEncoded && Array.isArray(body)) {
                // form-urlencoded (x-www-form-urlencoded) 形式で送信する場合
                const params = new URLSearchParams();
                (body as NameValue[]).forEach(b => params.append(b.name, b.value));
                fetchOptions.body = params.toString();
            } else if (Array.isArray(body)) {
                // NameValue配列をJSONオブジェクトに変換して送信する場合
                const jsonObject = Object.fromEntries((body as NameValue[]).map(b => [b.name, b.value]));
                fetchOptions.body = JSON.stringify(jsonObject);
            } else if (typeof body === 'object') {
                // すでにオブジェクト型の場合はそのままJSON文字列化
                fetchOptions.body = JSON.stringify(body as Record<string, JsonValue>);
            } else {
                // 文字列等の場合はそのままボディにセット
                fetchOptions.body = body as string;
            }
        }

        // デバッグ用：送信直前のリクエスト内容をコンソールに出力
        console.log('\x1b[36m[FetchExecutor] >>> OUTGOING REQUEST >>>\x1b[0m');
        console.log(`\x1b[36mMethod:\x1b[0m ${method}`);
        console.log(`\x1b[36mURL:\x1b[0m ${url}`);
        
        try {
            // リクエストの実行 (Node標準のfetchではなく、SvelteKitの恩恵を受けたfetchを優先)
            const response = await this.svelteFetch(url, fetchOptions);
            const resBody = await response.text();
            
            // fetch APIのHeadersオブジェクトを、システム共通のNameValue配列形式に変換
            const resHeaders: NameValue[] = [];
            response.headers.forEach((value, name) => resHeaders.push({ name, value }));

            // 成功・エラーに関わらず、システム共通のレスポンス形式で返却
            return {
                status: response.status,
                headers: resHeaders,
                body: resBody
            };
        } catch (error) {
            // 通信レイヤーでの致命的なエラー（ネットワーク断など）をキャッチしてログ出力
            console.error('\x1b[31m[FetchExecutor] Connection Error:\x1b[0m', error);
            throw error;
        }
    }
}