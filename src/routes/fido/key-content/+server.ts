import { json, error } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';

/**
 * 指定された鍵ファイルの内容を外部 data フォルダから読み取って返す
 * 配布後（build/ 実行時）も正しく動作するようにパスを修正済み
 */
export const GET = async ({ url }) => {
    const fileName = url.searchParams.get('file');
    
    if (!fileName) {
        throw error(400, 'ファイル名が指定されていません');
    }

    /**
     * 💡 修正ポイント: パス解決
     * src/lib/data ではなく、実行ルート直下の data/fido/key を参照します。
     * path.resolve を使うことで、相対パスの曖昧さを排除します。
     */
    const keyDir = path.resolve(process.cwd(), 'data', 'fido', 'key');
    const filePath = path.join(keyDir, fileName);

    // セキュリティチェック：ディレクトリトラバーサル対策（念のため）
    if (!filePath.startsWith(keyDir)) {
        throw error(403, '不正なファイルアクセスです');
    }

    if (!fs.existsSync(filePath)) {
        console.error(`[GET ERROR] File Not Found: ${filePath}`);
        throw error(404, '鍵ファイルが見つかりません');
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        // JSONとしてパースして返却
        return json(JSON.parse(content));
    } catch (e) {
        console.error(`[GET ERROR] Read Failure: ${fileName}`, e);
        throw error(500, 'ファイルの読み取りまたは解析に失敗しました');
    }
};