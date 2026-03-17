import { Client } from 'ssh2';
import type { HttpExecutor, HttpRequestOptions, HttpResponse } from './HttpExecutor';
import type { NameValue, JsonValue } from '$lib/types';
import sshConfig from '$lib/data/sys/ssh.json';

/**
 * SSH経由でリモートサーバー上で curl コマンドを実行するエグゼキューター
 */
export class SSHCurlExecutor implements HttpExecutor {
    async execute(options: HttpRequestOptions): Promise<HttpResponse> {
        return new Promise((resolve, reject) => {
            const conn = new Client();

            conn.on('ready', () => {
                let curlCmd = `curl -i -sS -X ${options.method} "${options.url}"`;
                
                // Content-Type 判定用のヘッダー正規化
                const headerObj = Object.fromEntries(
                    options.headers.map((h: NameValue) => [h.name.toLowerCase(), h.value])
                );

                options.headers.forEach(h => {
                    curlCmd += ` -H "${h.name}: ${h.value}"`;
                });

                // ボディの構築ロジック (JSON対応)
                if (options.method !== 'GET' && options.body) {
                    let bodyStr = "";
                    const isJson = headerObj['content-type']?.includes('application/json');
                    
                    if (options.isUrlEncoded && Array.isArray(options.body)) {
                        bodyStr = (options.body as NameValue[])
                            .map(item => `${encodeURIComponent(item.name)}=${encodeURIComponent(item.value)}`)
                            .join('&');
                    } 
                    else if (Array.isArray(options.body)) {
                        if (isJson) {
                            const jsonObject = Object.fromEntries((options.body as NameValue[]).map(b => [b.name, b.value]));
                            bodyStr = JSON.stringify(jsonObject);
                        } else {
                            bodyStr = JSON.stringify(options.body);
                        }
                    } 
                    else if (typeof options.body === 'object') {
                        bodyStr = JSON.stringify(options.body as Record<string, JsonValue>);
                    } 
                    else {
                        bodyStr = options.body as string;
                    }
                    
                    // シェルエスケープ処理
                    curlCmd += ` --data '${bodyStr.replace(/'/g, "'\\''")}'`;
                }

                conn.exec(curlCmd, (err, stream) => {
                    if (err) return reject(err);
                    
                    let stdoutData = '';
                    let stderrData = '';

                    stream.on('data', (d: Buffer) => { stdoutData += d.toString(); });
                    stream.stderr.on('data', (d: Buffer) => { stderrData += d.toString(); });

                    // code を使って終了ステータスをチェックするように修正
                    stream.on('close', (code: number) => {
                        conn.end();
                        
                        if (code !== 0 && stdoutData.length === 0) {
                            console.error(`[SSH ERROR] Exit Code: ${code}, Stderr: ${stderrData}`);
                            resolve({ status: 500, headers: [], body: `SSH/Curl Error (Code ${code}): ${stderrData}` });
                        } else {
                            resolve(this.parseCurlResponse(stdoutData));
                        }
                    });
                });
            }).on('error', (err) => {
                reject(new Error(`SSH Connection Failed: ${err.message}`));
            }).connect({
                host: sshConfig.host,
                port: sshConfig.port,
                username: sshConfig.username,
                password: sshConfig.password
            });
        });
    }

    /**
     * curl -i の出力を解析して HttpResponse に変換する
     */
    private parseCurlResponse(raw: string): HttpResponse {
        if (!raw) return { status: 500, headers: [], body: "Empty response from remote server" };

        const separator = raw.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n';
        const splitIndex = raw.indexOf(separator);
        
        let headerPart = "";
        let bodyPart = "";

        if (splitIndex === -1) {
            headerPart = raw;
            bodyPart = "";
        } else {
            headerPart = raw.substring(0, splitIndex);
            bodyPart = raw.substring(splitIndex + separator.length);
        }

        const headerLines = headerPart.split(/\r?\n/);
        const statusLine = headerLines[0] || "";
        const status = parseInt(statusLine.split(' ')[1]) || 200;

        const headers = headerLines.slice(1).map(line => {
            const [name, ...val] = line.split(': ');
            return { name: (name || "").trim(), value: val.join(': ').trim() };
        }).filter(h => h.name !== "");

        return { status, headers, body: bodyPart };
    }
}