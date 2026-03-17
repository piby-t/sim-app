/**
 * JSON文字列をパースし、読みやすく整形（インデント付与）して返します。
 * * @param jsonStr - 整形対象のJSON文字列
 * @returns インデントされたJSON文字列。パース失敗時は元の文字列を返します。
 */
export function formatJson(jsonStr: string | null | undefined): string {
    if (!jsonStr) return "";

    try {
        // 文字列をオブジェクトに変換
        const obj = JSON.parse(jsonStr);
        
        // 2スペースで整形して文字列に戻す
        return JSON.stringify(obj, null, 2);
    } catch {
        // JSONでない場合や壊れている場合は、そのままの文字列を返す（安全策）
        return jsonStr;
    }
}

/**
 * (おまけ) 今後、例えばBase64のデコードなどもここに追加していくと便利です
 */
export function decodeBase64(str: string): string {
    try {
        return atob(str);
    } catch {
        return str;
    }
}