import fs from 'fs';
import path from 'path';
import { Client } from 'ssh2';
import type { HttpExecutor, HttpRequestOptions, HttpResponse } from './HttpExecutor';
import type { NameValue, JsonValue } from '$lib/types';

// SSH設定用の型定義を追加
interface SSHConfig {
    sshuse?: boolean;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    privateKeyPath?: string;
}

/**
 * SSH経由でリモートサーバー上で curl コマンドを実行するエグゼキューター
 */
export class SSHCurlExecutor implements HttpExecutor {
    /**
     * 設定ファイルを動的に読み込む内部メソッド
     * any を排除し、SSHConfig 型を返却するように修正
     */
    private loadConfig(): SSHConfig {
        const configPath = path.resolve(process.cwd(), 'data/sys/ssh.json');
        try {
            if (fs.existsSync(configPath)) {
                const content = fs.readFileSync(configPath, 'utf-8');
                return JSON.parse(content) as SSHConfig;
            }
        } catch (err) {
            console.error('[SSHCurlExecutor] Failed to load ssh.json:', err);
        }
        return {}; // 読み込めない場合は空のオブジェクトを返す
    }

    async execute(options: HttpRequestOptions): Promise<HttpResponse> {
        const sshConfig = this.loadConfig();

        return new Promise((resolve, reject) => {
            const conn = new Client();

            conn.on('ready', () => {
                let curlCmd = `curl -i -sS -X ${options.method} "${options.url}"`;
                
                const headerObj = Object.fromEntries(
                    options.headers.map((h: NameValue) => [h.name.toLowerCase(), h.value])
                );

                options.headers.forEach(h => {
                    curlCmd += ` -H "${h.name}: ${h.value}"`;
                });

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
                    
                    curlCmd += ` --data '${bodyStr.replace(/'/g, "'\\''")}'`;
                }

                conn.exec(curlCmd, (err, stream) => {
                    if (err) return reject(err);
                    
                    let stdoutData = '';
                    let stderrData = '';

                    stream.on('data', (d: Buffer) => { stdoutData += d.toString(); });
                    stream.stderr.on('data', (d: Buffer) => { stderrData += d.toString(); });

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
                // 型定義があるため、プロパティ補完が効き、実行時エラーを防げます
                host: sshConfig.host || '127.0.0.1',
                port: sshConfig.port || 22,
                username: sshConfig.username || 'root',
                password: sshConfig.password,
                privateKey: sshConfig.privateKeyPath 
                    ? fs.readFileSync(path.resolve(process.cwd(), sshConfig.privateKeyPath)) 
                    : undefined
            });
        });
    }

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