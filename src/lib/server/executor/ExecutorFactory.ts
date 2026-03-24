import fs from 'fs';
import path from 'path';
import { FetchExecutor } from './FetchExecutor';
import { SSHCurlExecutor } from './SSHCurlExecutor';
import type { HttpExecutor } from './HttpExecutor';

/**
 * HTTPリクエスト実行クラスを生成するファクトリ
 * * 実行時にプロジェクトルートの data/sys/ssh.json を読み込み、
 * 標準の Fetch API を使うか、SSH経由で curl を使うかを動的に決定します。
 */
export class ExecutorFactory {
    /**
     * 現在の設定に適した HttpExecutor のインスタンスを返します。
     * @param svelteFetch SvelteKit が提供する特別な fetch 関数 (オプション)
     * @returns {HttpExecutor} 実行環境に応じたエグゼキューター
     */
    static create(svelteFetch?: typeof fetch): HttpExecutor {
        // --- 設定ファイルの動的読み込み ---
        const configPath = path.resolve(process.cwd(), 'data/sys/ssh.json');
        let sshuse = false;

        try {
            if (fs.existsSync(configPath)) {
                const rawData = fs.readFileSync(configPath, 'utf-8');
                const sshConfig = JSON.parse(rawData);
                sshuse = !!sshConfig.sshuse;
            } else {
                console.warn(`[Factory] Config not found at ${configPath}. Using default (FetchMode).`);
            }
        } catch (err) {
            console.error('[Factory] Failed to read or parse ssh.json:', err);
            // エラー時は安全のために標準 Fetch モードをデフォルトとする
        }

        // --- モードの決定 ---
        if (sshuse) {
            // SSH経由で curl を実行するモード
            // サーバーサイドから直接アクセスできないプライベートネットワークへのリクエストに使用
            console.log('[Factory] Mode: SSHCurlExecutor');
            return new SSHCurlExecutor();
        }

        // 標準的な HTTP Fetch を使用するモード
        // SvelteKit サーバーから直接宛先にアクセス可能な場合に使用
        console.log('[Factory] Mode: FetchExecutor');
        return new FetchExecutor(svelteFetch);
    }
}