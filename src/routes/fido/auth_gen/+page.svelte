<script lang="ts">
  /**
   * FIDO 認証 (Login) のリクエスト設定および実行画面コンポーネント
   * APIの選択、環境変数の適用、FIDO署名データの生成、最終的なAPI実行を管理します。
   */
  import { 
    Container, Row, Col, Card, CardBody, CardHeader, 
    Button, Table, Badge 
  } from "@sveltestrap/sveltestrap";
  import { getContext, untrack, onMount } from "svelte";
  import { SvelteURLSearchParams } from "svelte/reactivity";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { SERVER_CONTEXT_NAME, CLIENT_CONTEXT_NAME } from "$lib/state/StateConst";
  
  import ArrayText2 from "$lib/components/ArrayText2.svelte";
  import SelectArrayText2 from "$lib/components/SelectArrayText2.svelte";
  import KeyFileSelector from "$lib/components/KeyFileSelector.svelte";
  import ClientBasic from "$lib/components/ClientBasic.svelte"; // ✅ 追加: クライアントBase64生成用

  import { resolveDeep } from "$lib/util/resolver";
  import type { SelectArrayText2State } from "$lib/state/SelectArrayText2State.svelte";
  import type { NameValue, ApiDefinition, SelectArrayText2Props, JsonValue } from "$lib/types";
  import type { PageData } from "./$types";

  import serverJson from "$lib/data/oauth/server.json"; 
  import clientJson from "$lib/data/oauth/client.json";
  import staticJson from "$lib/data/oauth/static.json";

  let { data }: { data: PageData } = $props();

  // プリセットデータの初期化
  const createFreshStatic = () => structuredClone(staticJson.list) as NameValue[];
  const createFreshServer = () => structuredClone(serverJson.list) as SelectArrayText2Props[];
  const createFreshClient = () => structuredClone(clientJson.list) as SelectArrayText2Props[];

  // 画面の主要な状態管理 (State)
  let selectedApi = $state<ApiDefinition | null>(null);
  let selectedKeyFile = $state(""); // 初期値は空にして KeyFileSelector に復元を任せる
  let serverPresets = $state(createFreshServer());
  let clientPresets = $state(createFreshClient());
  let staticPresets = $state(createFreshStatic());
  let secretBase64 = $state("");
  let sessionValues = $state<NameValue[]>([]);

  // FIDOの署名生成によって得られた動的データとエラー情報
  let genData = $state<Record<string, string>>({});
  let genError = $state<string | null>(null);

  /**
   * コンポーネントのマウント時およびページ遷移の復元時における状態の初期化
   */
  onMount(() => {
    const hardReset = () => {
      sessionValues = structuredClone(data.sessionContext) || [];
      serverPresets = createFreshServer();
      clientPresets = createFreshClient();
      staticPresets = createFreshStatic();
    };
    untrack(() => hardReset());

    // bfcache (ブラウザの戻る・進む) 対応
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) hardReset();
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  });

  // 共通状態（Context）からの設定値取得
  const serverState = getContext<SelectArrayText2State>(SERVER_CONTEXT_NAME);
  const clientState = getContext<SelectArrayText2State>(CLIENT_CONTEXT_NAME);

  const keyFiles = $derived(data.keyFiles || []);

  let selectedServerData = $derived(serverPresets.find((p) => p.label === serverState.value));
  let selectedClientData = $derived(clientPresets.find((p) => p.label === clientState.value));

  /**
   * 電文プレースホルダーを置換するための全パラメータ辞書を作成します。
   */
  let allParams = $derived.by(() => {
    const params: Record<string, string> = {};
    sessionValues.forEach((v) => { if (v.name) params[v.name] = v.value; });
    
    if (selectedKeyFile) params['selected_key_user_id'] = selectedKeyFile.replace('.json', '');
    
    selectedServerData?.items.forEach((i) => { if (i.name) params[i.name] = i.value; });
    selectedClientData?.items.forEach((i) => { if (i.name) params[i.name] = i.value; });
    staticPresets.forEach((i) => { if (i.name) params[i.name] = i.value; });
    
    if (secretBase64) params['secret_base64'] = secretBase64;
    
    for (const [k, v] of Object.entries(genData)) {
      params[`auth.${k}`] = String(v);
    }
    return params;
  });

  function processTemplate<T>(input: T): T {
    if (input === null || input === undefined) return input;
    
    const resolved = resolveDeep(input as JsonValue, allParams);
    
    const fallbackReplace = (obj: unknown): unknown => {
      if (typeof obj === 'string') {
        return obj.replace(/#{([\w.-]+)}/g, (match, key) => {
          return allParams[key] !== undefined ? allParams[key] : match;
        });
      }
      if (Array.isArray(obj)) return obj.map(fallbackReplace);
      if (obj !== null && typeof obj === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          out[k] = fallbackReplace(v);
        }
        return out;
      }
      return obj;
    };

    return fallbackReplace(resolved) as T;
  }

  // URLとクエリパラメータを安全に結合するロジック (Svelte 5 準拠)
  let resolvedUrl = $derived.by(() => {
    if (!selectedApi) return "";
    
    // ベースURLを置換
    let baseUrl = String(processTemplate(selectedApi.url));

    // queries が定義されていれば SvelteURLSearchParams で安全にエンコードして結合
    if (selectedApi.queries && selectedApi.queries.length > 0) {
      const params = new SvelteURLSearchParams();
      
      selectedApi.queries.forEach(q => {
        if (q.name) {
          const resolvedValue = String(processTemplate(q.value));
          params.append(q.name, resolvedValue);
        }
      });
      
      const queryString = params.toString();
      if (queryString) {
        baseUrl += (baseUrl.includes('?') ? '&' : '?') + queryString;
      }
    }
    return baseUrl;
  });

  let resolvedHeaders = $derived(
    selectedApi?.headers.map((h: NameValue) => ({ 
      name: h.name, value: processTemplate(h.value) 
    })) || []
  );

  let isUrlEncoded = $derived(
    resolvedHeaders.find(h => h.name.toLowerCase() === 'content-type')?.value.includes('application/x-www-form-urlencoded')
  );

  let resolvedBody = $derived.by(() => {
    if (!selectedApi || selectedApi.method === 'GET') return null;
    return processTemplate(selectedApi.body);
  });

  /**
   * ローカルの鍵ファイルを使用し、バックエンド経由でFIDOの署名データ(Assertion)を生成します。
   */
  async function triggerFidoGeneration() {
    if (!browser) return; // SSR時の不正なfetch実行を防止
    if (!selectedApi) { genData = {}; genError = null; return; }

    const bodyStr = JSON.stringify(selectedApi.body || "");
    const urlStr = selectedApi.url || "";
    
    if (!bodyStr.includes('#{auth.') && !urlStr.includes('#{auth.')) {
      genData = {}; genError = null; return;
    }

    if (!selectedKeyFile) {
      genError = "鍵ファイルが選択されていません。左側のパネルで鍵を選択してください。";
      genData = {}; return;
    }

    genError = null;
    
    const challengeObj = sessionValues.find(v => v.name === 'challenge');
    const rpIdObj = sessionValues.find(v => v.name === 'rpId') || sessionValues.find(v => v.name === 'clientid');
    const originObj = sessionValues.find(v => v.name === 'origin');

    const challenge = challengeObj ? challengeObj.value : '';
    const rpId = rpIdObj ? rpIdObj.value : 'localhost';
    const origin = originObj ? originObj.value : 'http://localhost:5173';

    try {
      const res = await fetch('/fido/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge, rpId, origin, keyFileName: selectedKeyFile, type: 'webauthn.get' })
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 150)}`);
      }

      const responseData = await res.json();
      if (responseData.error) {
        genError = `サーバーエラー: ${responseData.error}`; genData = {};
      } else {
        genData = responseData;
      }
    } catch (err) {
      genError = `通信失敗: バックエンドAPI(/fido/authenticate) が見つからないかエラーです。詳細: ${err}`;
      genData = {};
    }
  }

  $effect(() => {
    const api = selectedApi;
    const key = selectedKeyFile;
    const sv = sessionValues;
    if (api && key && sv) { untrack(() => triggerFidoGeneration()); }
  });

  /**
   * 構築されたリクエスト情報をもとに、実際のAPI通信処理を実行します。
   */
  async function handleExecute() {
    if (!browser) return; // SSR時の不正なfetch実行を防止
    if (!selectedApi) return;
    
    if (Object.keys(genData).length === 0) {
      await triggerFidoGeneration();
    }

    const bodyStr = typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody);
    
    if (bodyStr?.includes('#{auth.') || resolvedUrl.includes('#{auth.')) {
      if (!genError) {
        genError = "FIDOデータの置換に失敗しました。";
      }
      return;
    }

    const payload = { 
      method: selectedApi.method, url: resolvedUrl, headers: resolvedHeaders, body: resolvedBody,
      isUrlEncoded: isUrlEncoded, keyFile: selectedKeyFile 
    };

    try {
      const response = await fetch('/fido/key_challenge_call', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        // eslint-disable-next-line svelte/no-navigation-without-resolve
        await goto('/fido/auth_result');
      } else {
        // ✅ 修正: 会社環境のプロキシエラー等を確実に表示する堅牢なアラート
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        alert(`APIの実行に失敗しました。\nHTTPステータス: ${response.status}\n詳細: ${errorText.substring(0, 200)}`);
        genError = `APIの実行に失敗しました。HTTP Status: ${response.status}`;
      }
    } catch (err) {
      // ✅ 修正: ネットワークレベルの遮断エラー等を確実に表示
      console.error("Network Error:", err);
      alert(`通信エラーが発生しました。\nネットワーク接続やプロキシの設定を確認してください。\n${err}`);
      genError = `通信エラーが発生しました: ${err}`;
    }
  }
</script>

<Container fluid class="mt-3 pb-4">
  <Row class="g-3">
    <Col md="6">
      <Card class="shadow-sm border-0">
        <CardHeader class="bg-indigo text-white py-2">
          <h6 class="mb-0 fw-bold"><i class="bi bi-shield-lock me-2"></i>FIDO 認証(Login) リクエスト設定</h6>
        </CardHeader>
        <CardBody>
          
          <div class="mb-3">
            <h6 class="text-indigo small fw-bold mb-1">API カタログ</h6>
            <select class="form-select form-select-sm shadow-sm" onchange={(e) => {
              const val = e.currentTarget.value;
              if (!val) { selectedApi = null; return; }
              const [group, fileName] = val.split('|');
              selectedApi = data.apiCatalog[group].find((a: ApiDefinition) => a.fileName === fileName) || null;
            }}>
              <option value="">APIを選択してください...</option>
              {#each Object.entries(data.apiCatalog) as [group, list] (group)}
                <optgroup label={group}>
                  {#each list as api (api.fileName)}
                    <option value="{group}|{api.fileName}">{api.display || api.fileName}</option>
                  {/each}
                </optgroup>
              {/each}
            </select>
          </div>

          <div class="mb-3 pb-3 border-bottom">
            <h6 class="text-indigo small fw-bold mb-2"><i class="bi bi-key-fill me-1"></i>署名に使用する秘密鍵</h6>
            <KeyFileSelector keyFiles={keyFiles} bind:selectedKeyFile={selectedKeyFile} />
          </div>

          <div class="mb-3 pb-2 border-bottom">
            <h6 class="text-indigo small fw-bold mb-1"><i class="bi bi-clock-history me-1"></i>Session Context</h6>
            <ArrayText2 bind:items={sessionValues} />
          </div>

          <div class="mb-3">
            <h6 class="text-indigo mb-1 small fw-bold"><i class="bi bi-server me-1"></i>RPサーバー設定</h6>
            <SelectArrayText2 bind:presets={serverPresets} bind:selectedLabel={serverState.value} />
          </div>

          <div class="mb-3 pb-3 border-bottom">
            <h6 class="text-indigo mb-1 small fw-bold"><i class="bi bi-laptop me-1"></i>クライアント設定</h6>
            <SelectArrayText2 bind:presets={clientPresets} bind:selectedLabel={clientState.value} />
            <ClientBasic clientData={selectedClientData} bind:result={secretBase64} />
          </div>

          <div class="mb-1">
            <h6 class="text-indigo mb-1 small fw-bold"><i class="bi bi-gear-fill me-1"></i>Static設定 (共通変数)</h6>
            <ArrayText2 bind:items={staticPresets} />
          </div>
        </CardBody>
      </Card>
    </Col>

    <Col md="6">
      <Card class="shadow-sm border-dark h-100 sticky-top" style="top: 1rem; max-height: calc(100vh - 2rem); overflow-y: auto;">
        <CardHeader class="bg-dark text-white py-2 d-flex justify-content-between align-items-center">
          <h6 class="mb-0 fw-bold small">送信電文プレビュー</h6>
          <div>
            {#if Object.keys(genData).length > 0}
              <Badge color="success" class="me-2">署名生成OK</Badge>
            {/if}
            {#if selectedApi}<Badge color="warning" class="text-dark">{selectedApi.method}</Badge>{/if}
          </div>
        </CardHeader>
        <CardBody class="bg-light p-3 font-monospace">
          
          {#if genError}
            <div class="alert alert-danger small py-2 mb-3 shadow-sm border-0 text-break">
              <i class="bi bi-exclamation-triangle-fill me-1"></i><strong>エラー詳細:</strong> {genError}
            </div>
          {/if}

          {#if selectedApi}
            <div class="mb-3">
              <div class="fw-bold small border-bottom mb-1 text-muted">URL</div>
              <div class="text-break text-primary small" style="font-size: 0.8rem;">{resolvedUrl}</div>
            </div>

            <div class="mb-3">
              <div class="fw-bold small border-bottom mb-1 text-muted">Headers</div>
              <Table size="sm" class="bg-white border mb-0" style="table-layout: fixed; font-size: 0.75rem;">
                <tbody>
                  {#each resolvedHeaders as h (h.name)}
                    <tr><td class="fw-bold bg-light-subtle" style="width:35%">{h.name}</td><td class="text-break">{h.value}</td></tr>
                  {/each}
                </tbody>
              </Table>
            </div>

            {#if selectedApi.method !== 'GET'}
              <div class="mb-3">
                <div class="d-flex justify-content-between align-items-end border-bottom mb-1 pb-1">
                  <div class="fw-bold small text-muted">Payload (Body)</div>
                  {#if (JSON.stringify(selectedApi.body || "").includes('#{auth.') || (selectedApi.url || "").includes('#{auth.'))}
                    <Button size="sm" color="info" outline onclick={triggerFidoGeneration}>
                      <i class="bi bi-arrow-clockwise"></i> 署名を再生成
                    </Button>
                  {/if}
                </div>
                
                {#if isUrlEncoded && Array.isArray(resolvedBody)}
                  <Table size="sm" class="bg-white border mb-0 small">
                    <tbody>
                      {#each resolvedBody as b (b.name)}
                        <tr><td class="fw-bold bg-light-subtle" style="width:35%">{b.name}</td><td class="text-break">{b.value}</td></tr>
                      {/each}
                    </tbody>
                  </Table>
                {:else if Array.isArray(resolvedBody)}
                  <Table size="sm" class="bg-white border mb-0 small">
                    <tbody>
                      {#each resolvedBody as b (b.name)}
                        <tr><td class="fw-bold bg-light-subtle" style="width:35%">{b.name}</td><td class="text-break">{b.value}</td></tr>
                      {/each}
                    </tbody>
                  </Table>
                {:else}
                  <pre class="p-2 bg-white border rounded small full-view mb-0"><code>{typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody, null, 2)}</code></pre>
                {/if}
              </div>
            {/if}

            <div class="d-grid mt-4">
              <Button class="btn-indigo btn-lg fw-bold shadow" onclick={handleExecute}>
                <i class="bi bi-lightning-fill me-2"></i>API EXECUTE
              </Button>
            </div>
          {:else}
            <div class="py-5 text-center text-muted">
              <i class="bi bi-arrow-left-circle me-2"></i>APIを選択してください
            </div>
          {/if}
        </CardBody>
      </Card>
    </Col>
  </Row>
</Container>

<style>
  :global(.bg-indigo) { background-color: #6610f2 !important; }
  :global(.text-indigo) { color: #6610f2 !important; }
  :global(.btn-indigo) { background-color: #6610f2 !important; color: white !important; }
  :global(.btn-indigo:hover) { background-color: #520dc2 !important; color: white !important; }
  
  pre.full-view { white-space: pre-wrap; word-break: break-all; font-size: 0.75rem; line-height: 1.2; }
  .text-break { word-break: break-all; }
  :global(.sticky-top) { z-index: 10; }
</style>