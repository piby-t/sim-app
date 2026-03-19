<script lang="ts">
  import { Container, Row, Col, Card, CardBody, CardHeader, Button, Table, Badge } from "@sveltestrap/sveltestrap";
  import { getContext, untrack, onMount } from "svelte";
  import { SvelteURLSearchParams } from "svelte/reactivity";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { SERVER_CONTEXT_NAME, CLIENT_CONTEXT_NAME } from "$lib/state/StateConst";
  
  import ArrayText2 from "$lib/components/ArrayText2.svelte";
  import SelectArrayText2 from "$lib/components/SelectArrayText2.svelte";
  import ClientBasic from "$lib/components/ClientBasic.svelte";
  import ApiCatalogSelector from "$lib/components/ApiCatalogSelector.svelte";

  import { resolveDeep } from "$lib/util/resolver";
  import type { SelectArrayText2State } from "$lib/state/SelectArrayText2State.svelte";
  import type { NameValue, ApiDefinition, SelectArrayText2Props, JsonValue } from "$lib/types";
  import type { PageData } from "./$types";

  import serverJson from "$lib/data/oauth/server.json"; 
  import clientJson from "$lib/data/oauth/client.json";
  import staticJson from "$lib/data/oauth/static.json";

  let { data }: { data: PageData } = $props();

  const createFreshStatic = () => structuredClone(staticJson.list) as NameValue[];
  const createFreshServer = () => structuredClone(serverJson.list) as SelectArrayText2Props[];
  const createFreshClient = () => structuredClone(clientJson.list) as SelectArrayText2Props[];

  let selectedApi = $state<ApiDefinition | null>(null);
  let serverPresets = $state(createFreshServer());
  let clientPresets = $state(createFreshClient());
  let staticPresets = $state(createFreshStatic());
  let secretBase64 = $state("");
  let sessionValues = $state<NameValue[]>([]);

  onMount(() => {
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

  const serverState = getContext<SelectArrayText2State>(SERVER_CONTEXT_NAME);
  const clientState = getContext<SelectArrayText2State>(CLIENT_CONTEXT_NAME);
  let selectedServerData = $derived(serverPresets.find((p) => p.label === serverState.value));
  let selectedClientData = $derived(clientPresets.find((p) => p.label === clientState.value));

  let allParams = $derived.by(() => {
    const params: Record<string, string> = {};
    sessionValues.forEach((v) => { params[v.name] = v.value; });
    selectedServerData?.items.forEach((i) => { if (i.name) params[i.name] = i.value; });
    selectedClientData?.items.forEach((i) => { if (i.name) params[i.name] = i.value; });
    staticPresets.forEach((i) => { if (i.name) params[i.name] = i.value; });
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
      selectedApi.queries.forEach(q => { if (q.name) params.append(q.name, String(processTemplate(q.value))); });
      baseUrl += (baseUrl.includes('?') ? '&' : '?') + params.toString();
    }
    return baseUrl;
  });

  let resolvedHeaders = $derived(selectedApi?.headers.map((h: NameValue) => ({ name: h.name, value: processTemplate(h.value) })) || []);
  let isUrlEncoded = $derived(resolvedHeaders.find(h => h.name.toLowerCase() === 'content-type')?.value.includes('application/x-www-form-urlencoded'));
  let resolvedBody = $derived.by(() => (!selectedApi || selectedApi.method === 'GET') ? null : processTemplate(selectedApi.body));

  async function handleExecute() {
    if (!browser || !selectedApi) return;
    const payload = { method: selectedApi.method, url: resolvedUrl, headers: resolvedHeaders, body: resolvedBody, isUrlEncoded };
    try {
      const response = await fetch('/fido/key_challenge_call', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (response.ok) { 
        // eslint-disable-next-line svelte/no-navigation-without-resolve
        await goto('/fido/key_challenge_result'); 
      }
      else { alert(`API Error: ${response.status}`); }
    } catch (err) { alert(`Network Error: ${err}`); }
  }
</script>

<Container fluid class="mt-3 pb-4">
  <Row class="g-3">
    <Col md="6">
      <Card class="shadow-sm border-0">
        <CardHeader class="bg-indigo text-white py-2">
          <h6 class="mb-0 fw-bold small"><i class="bi bi-shield-lock me-2"></i>FIDO Challenge リクエスト設定</h6>
        </CardHeader>
        <CardBody>
          <div class="mb-3">
            <h6 class="text-indigo small fw-bold mb-1">API カタログ</h6>
            <ApiCatalogSelector apiCatalog={data.apiCatalog} bind:selectedApi />
          </div>
          <div class="mb-3 pb-2 border-bottom">
            <h6 class="text-indigo small fw-bold mb-1"><i class="bi bi-clock-history me-1"></i>Session Context</h6>
            <ArrayText2 bind:items={sessionValues} />
          </div>
          <div class="mb-3"><h6 class="text-indigo mb-1 small fw-bold">RPサーバー設定</h6><SelectArrayText2 bind:presets={serverPresets} bind:selectedLabel={serverState.value} /></div>
          <div class="mb-3"><h6 class="text-indigo mb-1 small fw-bold">クライアント設定</h6><SelectArrayText2 bind:presets={clientPresets} bind:selectedLabel={clientState.value} /><ClientBasic clientData={selectedClientData} bind:result={secretBase64} /></div>
          <div class="mb-1"><h6 class="text-indigo mb-1 small fw-bold">Static設定 (共通変数)</h6><ArrayText2 bind:items={staticPresets} /></div>
        </CardBody>
      </Card>
    </Col>

    <Col md="6">
      <Card class="shadow-sm border-dark h-100">
        <CardHeader class="bg-dark text-white py-2 d-flex justify-content-between align-items-center">
          <h6 class="mb-0 fw-bold small">送信電文プレビュー</h6>
          {#if selectedApi}<Badge color="warning" class="text-dark">{selectedApi.method}</Badge>{/if}
        </CardHeader>
        <CardBody class="bg-light p-3 font-monospace">
          {#if selectedApi}
            <div class="mb-3">
              <div class="fw-bold small border-bottom mb-1 text-muted">URL</div>
              <div class="text-break text-primary small">{resolvedUrl}</div>
            </div>
            <div class="mb-3">
              <div class="fw-bold small border-bottom mb-1 text-muted">Headers</div>
              <Table size="sm" class="bg-white border mb-0 small">
                <tbody>
                  {#each resolvedHeaders as h (h.name)}
                    <tr><td class="fw-bold" style="width:35%">{h.name}</td><td class="text-break">{h.value}</td></tr>
                  {/each}
                </tbody>
              </Table>
            </div>
            {#if selectedApi.method !== 'GET'}
              <div class="mb-3 border-bottom pb-1"><div class="fw-bold small text-muted">Body</div><pre class="p-2 bg-white border rounded small"><code>{typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody, null, 2)}</code></pre></div>
            {/if}
            <div class="d-grid mt-4"><Button color="indigo" size="lg" class="fw-bold shadow" onclick={handleExecute}><i class="bi bi-lightning-fill me-2"></i>Challenge 取得実行</Button></div>
          {:else}
            <div class="py-5 text-center text-muted small">APIを選択してください</div>
          {/if}
        </CardBody>
      </Card>
    </Col>
  </Row>
</Container>

<style>
  :global(.bg-indigo) { background-color: #6610f2 !important; }
  :global(.text-indigo) { color: #6610f2 !important; }
  pre { white-space: pre-wrap; word-break: break-all; font-size: 0.75rem; }
</style>