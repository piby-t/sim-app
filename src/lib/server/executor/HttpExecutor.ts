import type { NameValue } from '$lib/types';

/**
 * HTTPリクエスト実行に必要なパラメータ定義
 */
export interface HttpRequestOptions {
    method: string;          // HTTPメソッド (GET, POST, etc.)
    url: string;             // 送信先URL
    headers: NameValue[];    // リクエストヘッダーの配列
    body: string | NameValue[]; // 送信データ (文字列または key-value 配列)
    isUrlEncoded: boolean;   // bodyを x-www-form-urlencoded として送るかどうかのフラグ
}

/**
 * 通信結果を保持する共通レスポンス構造
 * エグゼキューターの種類に関わらず、必ずこの形式で結果が返ります。
 */
export interface HttpResponse {
    status: number;          // HTTPステータスコード
    headers: NameValue[];    // 受信ヘッダーの配列
    body: string;            // レスポンスボディ (テキストまたはJSON文字列)
}

/**
 * HTTP実行クラスが実装すべき共通インターフェース
 * * * Fetch (標準) や SSH/Curl (特殊経路) など、
 * 異なる通信手段をポリモーフィズムによって統一的に扱うために使用します。
 */
export interface HttpExecutor {
    /**
     * 与えられたオプションに従ってリクエストを実行します。
     * @param options リクエストパラメータ
     * @returns 統一形式のレスポンス
     */
    execute(options: HttpRequestOptions): Promise<HttpResponse>;
}