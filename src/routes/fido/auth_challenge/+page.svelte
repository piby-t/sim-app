<script lang="ts">
  /**
   * @file FIDO Auth Challenge (Assertion) Request Page
   * @description サーバーから認証用チャレンジを取得するための設定画面。
   * 既存の鍵情報をパラメータとして埋め込み、WebAuthnの `allowCredentials` に相当するデータを準備します。
   */
  import { Container, Row, Col, Card, CardBody, CardHeader, Button, Table, Badge } from "@sveltestrap/sveltestrap";
  import { getContext, untrack, onMount } from "svelte";
  import { SvelteURLSearchParams } from "svelte/reactivity";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { SERVER_CONTEXT_NAME, CLIENT_CONTEXT_NAME } from "$lib/state/StateConst";
  
  import ArrayText2 from "$lib/components/ArrayText2.svelte";
  import SelectArrayText2 from "$lib/components/SelectArrayText2.svelte";
  import ClientBasic from "$lib/components/ClientBasic.svelte";
  import KeyFileSelector from "$lib/components/KeyFileSelector.svelte";
  import ApiCatalogSelector from "$lib/components/ApiCatalogSelector.svelte";

  import type { SelectArrayText2State } from "$lib/state/SelectArrayText2State.svelte";
  import type { NameValue, ApiDefinition, SelectArrayText2Props, CredentialRecord } from "$lib/types";
  import type { PageData } from "./$types";

  // JSON定義から初期プリセットをロード
  import serverJson from "$lib/data/oauth/server.json"; 
  import clientJson from "$lib/data/oauth/client.json";
  import staticJson from "$lib/data/oauth/static.json";

  let { data }: { data: PageData } = $props();

  // フォームリセット時などに使用する、クリーンな初期データ作成関数
  const createFreshStatic = () => structuredClone(staticJson.list) as NameValue[];
  const createFreshServer = () => structuredClone(serverJson.list) as SelectArrayText2Props[];
  const createFreshClient = () => structuredClone(clientJson.list) as SelectArrayText2Props[];

  // --- リアクティブステート ($state) ---
  let selectedApi = $state<ApiDefinition | null>(null); // 実行対象のAPI定義
  let selectedKeyFile = $state("");                     // 選択された既存鍵のファイル名
  let serverPresets = $state(createFreshServer());      // サーバー接続先設定
  let clientPresets = $state(createFreshClient());      // クライアント(認証器)設定
  let staticPresets = $state(createFreshStatic());      // 画面固有の固定変数
  let secretBase64 = $state("");                        // Client Secret 等の計算結果
  let sessionValues = $state<NameValue[]>([]);          // 前画面等から引き継いだ動的セッション変数

  // サーバーサイドから渡された「鍵ファイルリスト」と「鍵の内容」を派生
  const keyFiles = $derived(data.keyFiles || []);
  const keyContents = $derived(data.keyContents as Record<string, CredentialRecord> || {});

  onMount(() => {
    /**
     * ページ読み込み時のステート初期化ロジック
     * 以前のセッション情報をクリアし、最新の context を反映します。
     */
    const hardReset = () => {
      sessionValues = structuredClone(data.sessionContext) || [];
      serverPresets = createFreshServer();
      clientPresets = createFreshClient();
      staticPresets = createFreshStatic();
    };
    untrack(() => hardReset());
    const handlePageShow = (event: PageTransitionEvent) => { if (event.persisted) hardReset(); };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  });

  // グローバルなコンテキスト（設定の共通状態）を取得
  const serverState = getContext<SelectArrayText2State>(SERVER_CONTEXT_NAME);
  const clientState = getContext<SelectArrayText2State>(CLIENT_CONTEXT_NAME);
  
  // 現在のセレクトボックス選択状況に応じた詳細データを取得
  const selectedServerData = $derived(serverPresets.find((p) => p.label === serverState.value));
  const selectedClientData = $derived(clientPresets.find((p) => p.label === clientState.value));

  /**
   * 【パラメータ集約ロジック】
   * テンプレート置換で使用するすべての変数をひとつの辞書にまとめます。
   * 特に `key.xxx` 形式で既存の鍵情報を利用できるようにするのがこの画面の肝です。
   */
  let allParams = $derived.by(() => {
    const params: Record<string, string> = {};
    
    // 1. セッション値（前工程のレスポンス等）
    sessionValues.forEach((v) => { if (v.name) params[v.name] = v.value; });
    
    // 2. 選択された鍵ファイルの内容を "key.xxx" として展開
    // 認証時にサーバーへ「この ID の鍵で署名する予定です」と伝える(allowCredentials)ために使用。
    if (selectedKeyFile && keyContents[selectedKeyFile]) {
      const k = keyContents[selectedKeyFile];
      const targetKeys: (keyof CredentialRecord)[] = ['credentialId', 'rpId', 'userId', 'userName', 'displayName'];
      targetKeys.forEach(prop => { if (k[prop] !== undefined) params[`key.${prop}`] = String(k[prop]); });
    }
    
    // 3. 各種プリセット設定
    selectedServerData?.items.forEach((i) => { if (i.name) params[i.name] = i.value; });
    selectedClientData?.items.forEach((i) => { if (i.name) params[i.name] = i.value; });
    staticPresets.forEach((i) => { if (i.name) params[i.name] = i.value; });
    if (secretBase64) params['secret_base64'] = secretBase64;
    
    return params;
  });

  /**
   * 【テンプレート置換エンジン】
   * 文字列、配列、オブジェクト内の `${var}` または `#{var}` を allParams の値で再帰的に置換します。
   */
  function processTemplate(input: unknown): unknown {
    if (typeof input === 'string') {
      return input.replace(/\${([\w.-]+)}|#{([\w.-]+)}/g, (match, p1, p2) => {
        const key = p1 || p2;
        return allParams[key] !== undefined ? allParams[key] : match;
      });
    }
    if (Array.isArray(input)) return input.map(item => processTemplate(item));
    if (input !== null && typeof input === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
        out[k] = processTemplate(v);
      }
      return out;
    }
    return input;
  }

  // API定義に基づき、パラメータ置換後の最終的な URL を算出
  let resolvedUrl = $derived.by(() => {
    if (!selectedApi) return "";
    let baseUrl = String(processTemplate(selectedApi.url));
    if (selectedApi.queries && selectedApi.queries.length > 0) {
      const params = new SvelteURLSearchParams();
      selectedApi.queries.forEach(q => { if (q.name) params.append(q.name, String(processTemplate(q.value))); });
      baseUrl += (baseUrl.includes('?') ? '&' : '?') + params.toString();
    }
    return baseUrl;
  });

  // ヘッダーとボディの動的解決
  let resolvedHeaders = $derived(selectedApi?.headers.map((h: NameValue) => ({ name: h.name, value: String(processTemplate(h.value)) })) || []);
  let isUrlEncoded = $derived(resolvedHeaders.find(h => h.name.toLowerCase() === 'content-type')?.value.includes('application/x-www-form-urlencoded'));
  let resolvedBody = $derived.by(() => (!selectedApi || selectedApi.method === 'GET' || !selectedApi.body) ? null : processTemplate(selectedApi.body));

  /**
   * API実行処理
   * 解決された電文（URL/Header/Body）をサーバー側のプロキシへ送信し、
   * 次の「署名生成」ステップに必要なチャレンジデータを取得します。
   */
  async function handleExecute() {
    if (!browser || !selectedApi) return;
    const payload = { method: selectedApi.method, url: resolvedUrl, headers: resolvedHeaders, body: resolvedBody, isUrlEncoded };
    try {
      const response = await fetch('/fido/auth_challenge_call', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (response.ok) { 
        // 成功したら結果画面（通常はセッションに書き込まれた内容を確認する画面）へ遷移
        // eslint-disable-next-line svelte/no-navigation-without-resolve
        await goto('/fido/auth_challenge_result'); 
      } 
      else { alert(`API Error: ${response.status}`); }
    } catch (err) { alert(`Network Error: ${err}`); }
  }
</script>

<Container fluid class="mt-3 pb-4">
  <Row class="g-3">
    <Col md="6">
      <Card class="shadow-sm border-0">
        <CardHeader class="bg-teal text-white py-2">
          <h6 class="mb-0 fw-bold small"><i class="bi bi-fingerprint me-2"></i>Auth Challenge リクエスト設定</h6>
        </CardHeader>
        <CardBody>
          <div class="mb-3">
            <h6 class="text-teal small fw-bold mb-1">API カタログ</h6>
            <ApiCatalogSelector apiCatalog={data.apiCatalog} bind:selectedApi />
          </div>

          <div class="mb-3 pb-3 border-bottom">
            <h6 class="text-teal small fw-bold mb-2"><i class="bi bi-key-fill me-1"></i>対象とする鍵 (allowCredentials 用)</h6>
            <KeyFileSelector keyFiles={keyFiles} bind:selectedKeyFile={selectedKeyFile} />
          </div>

          <div class="mb-3 pb-2 border-bottom">
            <h6 class="text-teal small fw-bold mb-1"><i class="bi bi-clock-history me-1"></i>Session Context</h6>
            <ArrayText2 bind:items={sessionValues} />
          </div>

          <div class="mb-3"><h6 class="text-teal mb-1 small fw-bold">RPサーバー設定</h6><SelectArrayText2 bind:presets={serverPresets} bind:selectedLabel={serverState.value} /></div>
          <div class="mb-3"><h6 class="text-teal mb-1 small fw-bold">クライアント設定</h6><SelectArrayText2 bind:presets={clientPresets} bind:selectedLabel={clientState.value} /><ClientBasic clientData={selectedClientData} bind:result={secretBase64} /></div>
          <div class="mb-1"><h6 class="text-teal mb-1 small fw-bold">Static設定 (共通変数)</h6><ArrayText2 bind:items={staticPresets} /></div>
        </CardBody>
      </Card>
    </Col>

    <Col md="6">
      <Card class="shadow-sm border-dark h-100 sticky-top" style="top: 1rem;">
        <CardHeader class="bg-dark text-white py-2 d-flex justify-content-between align-items-center">
          <h6 class="mb-0 fw-bold small">送信電文プレビュー</h6>
          {#if selectedApi}<Badge color="warning" class="text-dark">{selectedApi.method}</Badge>{/if}
        </CardHeader>
        <CardBody class="bg-light p-3 font-monospace overflow-auto">
          {#if selectedApi}
            <div class="mb-3 border-bottom pb-1"><div class="fw-bold small text-muted">URL</div><div class="text-break text-primary small">{resolvedUrl}</div></div>
            <div class="mb-3">
              <div class="fw-bold small border-bottom mb-1 text-muted">Headers</div>
              <Table size="sm" class="bg-white border mb-0 small">
                <tbody>
                  {#each resolvedHeaders as h, i (`${h.name}-${i}`)}
                    <tr><td class="fw-bold" style="width:35%">{h.name}</td><td class="text-break">{h.value}</td></tr>
                  {/each}
                </tbody>
              </Table>
            </div>
            {#if selectedApi.method !== 'GET'}
              <div class="mb-3 border-bottom pb-1"><div class="fw-bold small text-muted">Body</div><pre class="p-2 bg-white border rounded small"><code>{typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody, null, 2)}</code></pre></div>
            {/if}
            <div class="d-grid mt-4"><Button color="teal" size="lg" class="fw-bold shadow" onclick={handleExecute}><i class="bi bi-lightning-fill me-2"></i>Auth Challenge 取得実行</Button></div>
          {:else}
            <div class="py-5 text-center text-muted small">APIを選択してください</div>
          {/if}
        </CardBody>
      </Card>
    </Col>
  </Row>
</Container>