<script lang="ts">
  /**
   * FIDO認証 (Login) のAPI実行結果を表示する画面コンポーネント
   * リクエストとレスポンスの生データを表示するほか、FIDO特有の難解な
   * Base64URLエンコードされたバイナリデータ (clientDataJSON, authenticatorData) を
   * デコード・解析して人間が読める形式に変換します。
   */
  import { Container, Row, Col, Card, CardHeader, CardBody, Badge, Table, Button } from '@sveltestrap/sveltestrap';
  import { goto } from '$app/navigation';
  import SimResponse from '$lib/components/SimResponse.svelte';
  import { formatJson } from '$lib/util/fmt-trans';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let record = $derived(data.record);
  let req = $derived(record?.req);
  let res = $derived(record?.res);

  // 解析したデータをテーブル表示するための型
  type ParsedRow = { label: string; value: string };
  
  // リクエストボディに含まれるFIDO認証データの構造定義
  type AuthPayload = {
    response?: {
      clientDataJSON?: string;
      authenticatorData?: string;
    }
  };

  /**
   * Base64URL形式の文字列を、バイナリ(Uint8Array)に変換します。
   * FIDOのデータは通常のBase64ではなくBase64URL形式であるため、文字の置換とパディング調整が必要です。
   */
  function decodeBase64UrlToUint8Array(base64Url: string): Uint8Array {
    try {
      const padding = '='.repeat((4 - base64Url.length % 4) % 4);
      const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
      return outputArray;
    } catch { return new Uint8Array(0); }
  }

  /**
   * バイナリデータを16進数文字列(Hex)に変換します。
   * 主に rpIdHash などのハッシュ値を画面表示するために使用します。
   */
  function toHexString(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * clientDataJSON (Base64URL) をデコードし、画面表示用の配列に変換します。
   * 中には origin や challenge の情報がJSON形式で格納されています。
   */
  function parseClientDataJSONToTable(base64Url: string): ParsedRow[] | null {
    try {
      const bytes = decodeBase64UrlToUint8Array(base64Url);
      if (bytes.length === 0) return null;
      const obj = JSON.parse(new TextDecoder().decode(bytes));
      return Object.entries(obj).map(([k, v]) => ({ label: k, value: String(v) }));
    } catch { return null; }
  }

  /**
   * authenticatorData (Base64URL形式のバイナリ) を解析し、画面表示用の配列に変換します。
   * FIDOの仕様に基づき、バイト列から rpIdHash(32), flags(1), signCount(4) を抽出します。
   */
  function parseAuthDataToTable(base64Url: string): ParsedRow[] | null {
    try {
      const authData = decodeBase64UrlToUint8Array(base64Url);
      if (authData.length < 37) return null;

      const rows: ParsedRow[] = [];
      
      // 1. rpIdHash (先頭32バイト)
      rows.push({ label: "rpIdHash", value: toHexString(authData.slice(0, 32)) });

      // 2. flags (33バイト目) とビット演算による各フラグの判定
      const flags = authData[32];
      rows.push({ label: "flags (Raw)", value: `0x${flags.toString(16).padStart(2, '0')}` });
      rows.push({ label: " ↳ UP (User Present)", value: (flags & 0x01) ? "true (1)" : "false (0)" });
      rows.push({ label: " ↳ UV (User Verified)", value: (flags & 0x04) ? "true (1)" : "false (0)" });
      rows.push({ label: " ↳ BE (Backup Eligible)", value: (flags & 0x08) ? "true (1)" : "false (0)" });
      rows.push({ label: " ↳ BS (Backup State)", value: (flags & 0x10) ? "true (1)" : "false (0)" });
      rows.push({ label: " ↳ AT (Attested Cred.)", value: (flags & 0x40) ? "true (1)" : "false (0)" });

      // 3. signCount (34〜37バイト目、4バイトのビッグエンディアン整数)
      const signCount = (authData[33] << 24) | (authData[34] << 16) | (authData[35] << 8) | authData[36];
      rows.push({ label: "signCount", value: String(signCount >>> 0) }); // >>> 0 で符号なし整数として扱う

      return rows;
    } catch { return null; }
  }

  // リクエストボディをJSONオブジェクトとしてパース（文字列で渡された場合に対応）
  let parsedBodyObj = $derived.by(() => {
    if (!req || !('body' in req) || !req.body) return null;
    try { return typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } 
    catch { return null; }
  });

  // パースしたボディから clientDataJSON を抽出し、テーブル用データに変換
  let clientDataRows = $derived.by(() => {
    if (!parsedBodyObj) return null;
    const body = parsedBodyObj as AuthPayload;
    const cdj = body.response?.clientDataJSON;
    return cdj ? parseClientDataJSONToTable(cdj) : null;
  });

  // パースしたボディから authenticatorData を抽出し、テーブル用データに変換
  let authDataRows = $derived.by(() => {
    if (!parsedBodyObj) return null;
    const body = parsedBodyObj as AuthPayload;
    const authData = body.response?.authenticatorData;
    return authData ? parseAuthDataToTable(authData) : null;
  });
</script>

<Container fluid class="mt-3 pb-5">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h4 class="mb-0 fw-bold"><i class="bi bi-check-circle-fill text-success me-2"></i>認証API 実行結果</h4>
    <Button color="secondary" outline onclick={() => {
      // eslint-disable-next-line
      goto('/fido/auth_gen');
    }}>
      <i class="bi bi-arrow-left me-1"></i> 認証画面に戻る
    </Button>
  </div>

  {#if !record}
    <Card class="text-center p-5 bg-light shadow-sm border-0">
      <div class="text-muted"><i class="bi bi-cloud-slash fs-1 d-block mb-3 opacity-25"></i>直近の実行履歴が見つかりません。</div>
    </Card>
  {:else}
    <Row class="g-3">
      <Col lg="6">
        <Card class="shadow-sm border-0 mb-3 h-100">
          <CardHeader class="bg-dark text-white py-2 d-flex align-items-center justify-content-between">
            <h6 class="mb-0 small fw-bold"><i class="bi bi-send-fill me-2"></i>送信リクエスト</h6>
            {#if req && 'method' in req}<Badge color="primary">{req.method}</Badge>{/if}
          </CardHeader>
          <CardBody class="p-3 bg-light font-monospace">
            {#if !req}
              <div class="text-center py-5 text-muted small">リクエストデータがありません</div>
            {:else}
              <div class="mb-3">
                <div class="fw-bold small border-bottom mb-1 text-muted">Endpoint URL</div>
                <div class="text-primary text-break small">{req.url}</div>
              </div>

              {#if 'body' in req && req.body}
                <div class="mb-4">
                  <div class="fw-bold small border-bottom mb-1 text-muted">Raw Payload (Body)</div>
                  <pre class="bg-white p-2 border rounded small mb-0">{formatJson(typeof req.body === 'string' ? req.body : JSON.stringify(req.body))}</pre>
                </div>

                {#if clientDataRows || authDataRows}
                  <div class="p-3 bg-white border border-info rounded shadow-sm">
                    <h6 class="fw-bold text-info mb-3 border-bottom border-info pb-2 small">
                      <i class="bi bi-table me-1"></i> FIDO Auth Payload Analysis
                    </h6>
                    
                    {#if clientDataRows}
                      <div class="mb-3">
                        <div class="fw-bold small mb-1 text-secondary">clientDataJSON (Decoded)</div>
                        <Table size="sm" bordered class="mb-0" style="table-layout: fixed; font-size: 0.75rem;">
                          <tbody>
                            {#each clientDataRows as row (row.label)}
                              <tr><td class="bg-light fw-bold" style="width: 35%;">{row.label}</td><td class="text-break">{row.value}</td></tr>
                            {/each}
                          </tbody>
                        </Table>
                      </div>
                    {/if}

                    {#if authDataRows}
                      <div>
                        <div class="fw-bold small mb-1 text-secondary">authenticatorData (Parsed)</div>
                        <Table size="sm" bordered class="mb-0" style="table-layout: fixed; font-size: 0.75rem;">
                          <tbody>
                            {#each authDataRows as row (row.label)}
                              <tr>
                                <td class="bg-light fw-bold" style="width: 35%;">{row.label}</td>
                                <td class="text-break">
                                  <span class={row.value.includes('true') ? 'text-success fw-bold' : row.value.includes('false') ? 'text-muted' : ''}>
                                    {row.value}
                                  </span>
                                </td>
                              </tr>
                            {/each}
                          </tbody>
                        </Table>
                      </div>
                    {/if}
                  </div>
                {/if}
              {/if}
            {/if}
          </CardBody>
        </Card>
      </Col>

      <Col lg="6"><SimResponse {res} /></Col>
    </Row>
  {/if}
</Container>

<style>
  pre { white-space: pre-wrap; word-break: break-all; font-size: 0.75rem; line-height: 1.3; }
  .text-break { word-break: break-all; }
</style>