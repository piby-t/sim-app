<script lang="ts">
  /**
   * @file OAuth 2.0 / OIDC / FIDO2 API 実行メイン画面
   * @description 真っ当な型定義と外部データ対応を統合した完全版
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

  import { resolveDeep } from "$lib/util/resolver";
  import type { SelectArrayText2State } from "$lib/state/SelectArrayText2State.svelte";
  import type { NameValue, ApiDefinition, SelectArrayText2Props, JsonValue } from "$lib/types";
  import type { PageData } from "./$types";

  // props から data を取得
  let { data }: { data: PageData } = $props();

  /**
   * ✅ 修正: state_referenced_locally 警告対策
   * PageData 型を信頼して初期データを作成します。
   */
  const createFreshStatic = () => structuredClone(data.staticPresets.list);
  const createFreshServer = () => structuredClone(data.serverPresets.list);
  const createFreshClient = () => structuredClone(data.clientPresets.list);

  // --- リアクティブステート ---
  let selectedApi = $state<ApiDefinition | null>(null);
  let serverPresets = $state<SelectArrayText2Props[]>(createFreshServer());
  let clientPresets = $state<SelectArrayText2Props[]>(createFreshClient());
  let staticPresets = $state<NameValue[]>(createFreshStatic());
  let sessionValues = $state<NameValue[]>([]);
  let secretBase64 = $state("");

  onMount(() => {
    const hardReset = () => {
      sessionValues = structuredClone(data.sessionContext);
      serverPresets = createFreshServer();
      clientPresets = createFreshClient();
      staticPresets = createFreshStatic();
    };
    untrack(() => hardReset());
    const handlePageShow = (event: PageTransitionEvent) => { if (event.persisted) hardReset(); };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  });

  const serverState = getContext<SelectArrayText2State>(SERVER_CONTEXT_NAME);
  const clientState = getContext<SelectArrayText2State>(CLIENT_CONTEXT_NAME);

  // ✅ 修正: コールバック引数 p に型を明示 (7006 エラー解消)
  const selectedServerData = $derived(serverPresets.find((p: SelectArrayText2Props) => p.label === serverState.value));
  const selectedClientData = $derived(clientPresets.find((p: SelectArrayText2Props) => p.label === clientState.value));

  let allParams = $derived.by(() => {
    const params: Record<string, string> = {};
    // ✅ 修正: 引数 v に型を明示 (7006 エラー解消)
    sessionValues.forEach((v: NameValue) => { if (v.name) params[v.name] = v.value; });
    selectedServerData?.items.forEach((i: NameValue) => { if (i.name) params[i.name] = i.value; });
    selectedClientData?.items.forEach((i: NameValue) => { if (i.name) params[i.name] = i.value; });
    staticPresets.forEach((i: NameValue) => { if (i.name) params[i.name] = i.value; });
    if (secretBase64) params['secret_base64'] = secretBase64;
    return params;
  });

  function processTemplate<T>(input: T): T {
    if (input === null || input === undefined) return input;
    return resolveDeep(input as JsonValue, allParams) as T;
  }

  let resolvedUrl = $derived.by(() => {
    if (!selectedApi) return "";
    let baseUrl = String(processTemplate(selectedApi.url));
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
      name: h.name, 
      value: String(processTemplate(h.value)) 
    })) || []
  );

  let isUrlEncoded = $derived(
    resolvedHeaders.find(h => h.name.toLowerCase() === 'content-type')?.value.includes('application/x-www-form-urlencoded')
  );

  let resolvedBody = $derived.by(() => {
    if (!selectedApi || selectedApi.method === 'GET' || !selectedApi.body) return null;
    return processTemplate(selectedApi.body);
  });

  /**
   * API実行
   */
  async function handleExecute() {
    if (!browser || !selectedApi) return;
    
    const payload = { 
      method: selectedApi.method, 
      url: resolvedUrl, 
      headers: resolvedHeaders,
      body: resolvedBody,
      isUrlEncoded: isUrlEncoded
    };

    try {
      const response = await fetch('/oauth/apicall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        // eslint-disable-next-line svelte/no-navigation-without-resolve
        await goto('/oauth/apiresult');
      } else {
        const errorText = await response.text();
        alert(`API Error: ${response.status}\n${errorText}`);
      }
    } catch (err) {
      alert(`Network Error: ${err}`);
    }
  }
</script>

<Container fluid class="mt-3 pb-4">
  <Row class="g-3">
    <Col md="6">
      <Card class="shadow-sm border-0">
        <CardHeader class="bg-primary text-white py-2">
          <h6 class="mb-0 fw-bold small"><i class="bi bi-cpu-fill me-2"></i>APIリクエスト設定</h6>
        </CardHeader>
        <CardBody>
          <div class="mb-3">
            <h6 class="text-primary small fw-bold mb-1">APIカタログ</h6>
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
                    <option value="{group}|{api.fileName}">{api.display}</option>
                  {/each}
                </optgroup>
              {/each}
            </select>
          </div>
          <div class="mb-3 pb-2 border-bottom">
            <h6 class="text-primary small fw-bold mb-1"><i class="bi bi-clock-history me-1"></i>Session Context</h6>
            <ArrayText2 bind:items={sessionValues} />
          </div>
          <div class="mb-3">
            <h6 class="text-primary mb-1 small fw-bold">サーバー設定</h6>
            <SelectArrayText2 bind:presets={serverPresets} bind:selectedLabel={serverState.value} />
          </div>
          <div class="mb-3">
            <h6 class="text-primary mb-1 small fw-bold">クライアント設定</h6>
            <SelectArrayText2 bind:presets={clientPresets} bind:selectedLabel={clientState.value} />
            <ClientBasic clientData={selectedClientData} bind:result={secretBase64} />
          </div>
          <div class="mb-1">
            <h6 class="text-primary mb-1 small fw-bold">Static設定</h6>
            <ArrayText2 bind:items={staticPresets} />
          </div>
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
                  {#each resolvedHeaders as h (h.name)}
                    <tr><td class="fw-bold bg-light-subtle" style="width:35%">{h.name}</td><td class="text-break">{h.value}</td></tr>
                  {/each}
                </tbody>
              </Table>
            </div>
            {#if selectedApi.method !== 'GET'}
              <div class="mb-3">
                <div class="fw-bold small border-bottom mb-1 text-muted">Body</div>
                <pre class="p-2 bg-white border rounded small full-view"><code>{typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody, null, 2)}</code></pre>
              </div>
            {/if}
            <div class="d-grid mt-4"><Button color="success" size="lg" class="fw-bold shadow" onclick={handleExecute}>APIリクエスト送信</Button></div>
          {:else}
            <div class="py-5 text-center text-muted small">カタログからAPIを選択してください</div>
          {/if}
        </CardBody>
      </Card>
    </Col>
  </Row>
</Container>

<style>
  pre.full-view { white-space: pre-wrap; word-break: break-all; font-size: 0.75rem; line-height: 1.2; }
  .text-break { word-break: break-all; }
</style>