import { FetchExecutor } from './FetchExecutor';
import { SSHCurlExecutor } from './SSHCurlExecutor';
import type { HttpExecutor } from './HttpExecutor';
import sshConfig from '$lib/data/sys/ssh.json';

/**
 * HTTPリクエスト実行クラスを生成するファクトリ
 * * 設定ファイル (ssh.json) の内容に基づき、
 * 標準の Fetch API を使うか、SSH経由で curl を使うかを動的に決定します。
 */
export class ExecutorFactory {
    /**
     * 現在の設定に適した HttpExecutor のインスタンスを返します。
     * @param svelteFetch SvelteKit が提供する特別な fetch 関数 (オプション)
     * @returns {HttpExecutor} 実行環境に応じたエグゼキューター
     */
    static create(svelteFetch?: typeof fetch): HttpExecutor {
        // 設定ファイルの sshuse フラグを確認
        if (sshConfig.sshuse) {
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