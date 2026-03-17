import { json, error } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';

/**
 * 指定された鍵ファイルの内容を読み取って返す
 */
export const GET = async ({ url }) => {
    const fileName = url.searchParams.get('file');
    
    if (!fileName) {
        throw error(400, 'ファイル名が指定されていません');
    }

    // 鍵ファイルの保存ディレクトリ
    const filePath = path.join(process.cwd(), 'src', 'lib', 'data', 'fido', 'key', fileName);

    if (!fs.existsSync(filePath)) {
        console.error(`[File Not Found] ${filePath}`);
        throw error(404, '鍵ファイルが見つかりません');
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return json(JSON.parse(content));
    } catch (e) {
        console.error(`[Read Error] ${fileName}`, e);
        throw error(500, 'ファイルの読み取りに失敗しました');
    }
};