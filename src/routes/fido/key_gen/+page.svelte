<script lang="ts">
  /**
   * @file FIDO Request (Registration Execution) Page
   * @description 外部データ対応・型安全・警告解消済み完全版
   */
  import { Container, Row, Col, Card, CardBody, CardHeader, Button, Table, Badge } from "@sveltestrap/sveltestrap";
  import { getContext, untrack, onMount } from "svelte";
  import { SvelteURLSearchParams } from "svelte/reactivity";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { SERVER_CONTEXT_NAME, CLIENT_CONTEXT_NAME } from "$lib/state/StateConst";
  
  import ArrayText2 from "$lib/components/ArrayText2.svelte";
  import SelectArrayText2 from "$lib/components/SelectArrayText2.svelte";
  import KeyFileSelector from "$lib/components/KeyFileSelector.svelte";
  import ClientBasic from "$lib/components/ClientBasic.svelte";
  import ApiCatalogSelector from "$lib/components/ApiCatalogSelector.svelte";

  import type { SelectArrayText2State } from "$lib/state/SelectArrayText2State.svelte";
  import type { ApiDefinition, CredentialRecord, NameValue, SelectArrayText2Props } from "$lib/types";
  import type { PageData } from "./$types";

  // props から data を取得
  let { data }: { data: PageData } = $props();

  /**
   * ✅ 修正: 初期データ作成関数
   * PageData 型をそのまま信頼して参照します。
   */
  const createFreshStatic = () => structuredClone(data.staticPresets.list);
  const createFreshServer = () => structuredClone(data.serverPresets.list);
  const createFreshClient = () => structuredClone(data.clientPresets.list);

  // --- ステート管理 ---
  let selectedApi = $state<ApiDefinition | null>(null);
  let selectedKeyFile = $state(""); 
  let serverPresets = $state<SelectArrayText2Props[]>(createFreshServer());
  let clientPresets = $state<SelectArrayText2Props[]>(createFreshClient());
  let staticPresets = $state<NameValue[]>(createFreshStatic());
  let sessionValues = $state<NameValue[]>([]);
  let secretBase64 = $state(""); 

  // FIDOフラグ用状態
  let flagUP = $state(true);  
  let flagUV = $state(true); 
  let flagBE = $state(false); 
  let flagBS = $state(false); 
  let flagAT = $state(true);  
  let flagED = $state(false); 
  let manualSignCount = $state(0);
  let previousKeyFile = "";

  let genData = $state<Record<string, string>>({});
  let genError = $state<string | null>(null);

  const serverState = getContext<SelectArrayText2State>(SERVER_CONTEXT_NAME);
  const clientState = getContext<SelectArrayText2State>(CLIENT_CONTEXT_NAME);

  const keyFiles = $derived(data.keyFiles);
  const keyContents = $derived(data.keyContents as Record<string, CredentialRecord>);

  const selectedServerData = $derived(serverPresets.find((p: SelectArrayText2Props) => p.label === serverState.value));
  const selectedClientData = $derived(clientPresets.find((p: SelectArrayText2Props) => p.label === clientState.value));

  /**
   * bind_invalid_expression 回避用のアクセサ配列
   */
  const flagConfigs = $derived([
    { id: 'flagUP', label: 'UP', get val() { return flagUP }, set val(v: boolean) { flagUP = v } },
    { id: 'flagUV', label: 'UV', get val() { return flagUV }, set val(v: boolean) { flagUV = v } },
    { id: 'flagBE', label: 'BE', get val() { return flagBE }, set val(v: boolean) { flagBE = v } },
    { id: 'flagBS', label: 'BS', get val() { return flagBS }, set val(v: boolean) { flagBS = v } },
    { id: 'flagAT', label: 'AT', get val() { return flagAT }, set val(v: boolean) { flagAT = v } },
    { id: 'flagED', label: 'ED', get val() { return flagED }, set val(v: boolean) { flagED = v } }
  ]);

  let calculatedFlags = $derived(
    (flagUP ? 0x01 : 0) | (flagUV ? 0x04 : 0) | (flagBE ? 0x08 : 0) |
    (flagBS ? 0x10 : 0) | (flagAT ? 0x40 : 0) | (flagED ? 0x80 : 0)
  );

  // 鍵選択時のデータ復元
  $effect(() => {
    if (!selectedKeyFile && data.latestKey) {
      selectedKeyFile = data.latestKey;
    }

    if (selectedKeyFile !== previousKeyFile) {
      previousKeyFile = selectedKeyFile;
      if (selectedKeyFile && keyContents[selectedKeyFile]) {
        const kData = keyContents[selectedKeyFile];
        untrack(() => {
          if (kData.flags) {
            flagUP = !!kData.flags.up; flagUV = !!kData.flags.uv; flagBE = !!kData.flags.be;
            flagBS = !!kData.flags.bs; flagAT = !!kData.flags.at; flagED = !!kData.flags.ed;
          }
          manualSignCount = kData.signCount || 0;
        });
      }
    }
  });

  let allParams = $derived.by(() => {
    const params: Record<string, string> = {};
    sessionValues.forEach((i: NameValue) => { if (i.name) params[i.name] = i.value; });
    if (selectedKeyFile) params['selected_key_user_id'] = selectedKeyFile.replace('.json', '');
    selectedServerData?.items.forEach((i: NameValue) => { if (i.name) params[i.name] = i.value; });
    selectedClientData?.items.forEach((i: NameValue) => { if (i.name) params[i.name] = i.value; });
    staticPresets.forEach((i: NameValue) => { if (i.name) params[i.name] = i.value; });
    if (secretBase64) params['secret_base64'] = secretBase64; 
    for (const [k, v] of Object.entries(genData)) { params[`gen.${k}`] = String(v); }
    return params;
  });

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
      for (const [k, v] of Object.entries(input as Record<string, unknown>)) { out[k] = processTemplate(v); }
      return out;
    }
    return input;
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

  let resolvedHeaders = $derived(selectedApi?.headers.map((h: NameValue) => ({ name: h.name, value: String(processTemplate(h.value)) })) || []);
  let resolvedBody = $derived.by(() => (!selectedApi || selectedApi.method === 'GET' || !selectedApi.body) ? null : processTemplate(selectedApi.body));

  async function triggerFidoGeneration() {
    if (!browser || !selectedApi || !selectedKeyFile) return;
    const bodyStr = JSON.stringify(selectedApi.body || "");
    const urlStr = selectedApi.url || "";
    if (!bodyStr.includes('#{gen.') && !urlStr.includes('#{gen.')) { genData = {}; return; }
    genError = null;
    const challenge = sessionValues.find((v: NameValue) => v.name === 'challenge')?.value || '';
    const rpId = sessionValues.find((v: NameValue) => v.name === 'rpId')?.value || 'localhost';
    const origin = sessionValues.find((v: NameValue) => v.name === 'origin')?.value || 'http://localhost:3000';
    try {
      const res = await fetch('/fido/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge, rpId, origin, keyFileName: selectedKeyFile, type: 'webauthn.create', flagsOverride: calculatedFlags, signCountOverride: manualSignCount })
      });
      const responseData = await res.json();
      if (responseData.error) { genError = responseData.error; genData = {}; }
      else { genData = responseData; }
    } catch { genError = "生成APIへの通信に失敗しました。"; genData = {}; }
  }

  $effect(() => {
    if (selectedApi && selectedKeyFile && calculatedFlags !== undefined && manualSignCount !== undefined) {
      untrack(() => triggerFidoGeneration());
    }
  });

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

  async function handleExecute() {
    if (!browser || !selectedApi) return;
    const bodyStr = typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody);
    if (bodyStr?.includes('#{gen.') || resolvedUrl.includes('#{gen.')) {
      alert("FIDOデータの生成が未完了です。");
      return;
    }
    const payload = { method: selectedApi.method, url: resolvedUrl, headers: resolvedHeaders, body: resolvedBody, keyFile: selectedKeyFile };
    try {
      const response = await fetch('/fido/key_gen_call', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (response.ok) { 
        // eslint-disable-next-line svelte/no-navigation-without-resolve
        await goto('/fido/key_result'); 
      }
      else { alert(`API Error: ${response.status}`); }
    } catch (err) { alert(`Network Error: ${err}`); }
  }
</script>

<Container fluid class="mt-3 pb-5">
  <Row class="g-3">
    <Col lg="6">
      <Card class="shadow-sm border-0 mb-3">
        <CardHeader class="bg-indigo text-white py-2">
          <h6 class="mb-0 fw-bold small"><i class="bi bi-key-fill me-2"></i>FIDO リクエスト設定</h6>
        </CardHeader>
        <CardBody>
          <div class="mb-3">
            <h6 class="text-indigo small fw-bold mb-1">API カタログ</h6>
            <ApiCatalogSelector apiCatalog={data.apiCatalog} bind:selectedApi />
          </div>

          <div class="mb-3 pb-3 border-bottom">
            <KeyFileSelector keyFiles={keyFiles} bind:selectedKeyFile={selectedKeyFile} />
            {#if selectedKeyFile}
            <div class="row g-2 mt-2 bg-light p-2 rounded border mx-0">
              <div class="col-12 mb-2 small fw-bold text-muted">Authenticator Data Flags (0x{calculatedFlags.toString(16).toUpperCase()})</div>
              <div class="d-flex flex-wrap gap-3">
                {#each flagConfigs as f (f.id)}
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id={f.id} bind:checked={f.val}>
                    <label class="form-check-label small" for={f.id}>{f.label}</label>
                  </div>
                {/each}
              </div>
              <div class="col-12 border-top pt-2">
                <label for="scIn" class="small fw-bold text-muted mb-1">SignCount</label>
                <input id="scIn" type="number" class="form-control form-control-sm w-50" bind:value={manualSignCount} min="0" />
              </div>
            </div>
            {/if}
          </div>

          <div class="mb-3"><h6 class="text-indigo mb-1 small fw-bold">RPサーバー設定</h6><SelectArrayText2 bind:presets={serverPresets} bind:selectedLabel={serverState.value} /></div>
          <div class="mb-3 pb-3 border-bottom">
            <h6 class="text-indigo mb-1 small fw-bold">クライアント設定</h6>
            <SelectArrayText2 bind:presets={clientPresets} bind:selectedLabel={clientState.value} />
            <ClientBasic clientData={selectedClientData} bind:result={secretBase64} /> 
          </div>
          <div class="mb-3"><h6 class="text-indigo small fw-bold mb-1">Session Context</h6><ArrayText2 bind:items={sessionValues} /></div>
          <div class="mb-1"><h6 class="text-muted mb-1 small fw-bold">共通変数 (Static)</h6><ArrayText2 bind:items={staticPresets} /></div>
        </CardBody>
      </Card>
    </Col>

    <Col lg="6">
      <Card class="shadow-sm border-dark h-100 sticky-top" style="top: 1rem;">
        <CardHeader class="bg-light py-2 d-flex justify-content-between align-items-center">
          <h6 class="mb-0 fw-bold small text-uppercase">Request Preview</h6>
          {#if selectedApi}<Badge color="warning" class="text-dark">{selectedApi.method}</Badge>{/if}
        </CardHeader>
        <CardBody class="bg-light font-monospace overflow-auto">
          {#if genError}<div class="alert alert-danger small py-2 mb-3">{genError}</div>{/if}
          {#if selectedApi}
            <div class="mb-3 border-bottom pb-1"><div class="fw-bold small text-muted">URL</div><div class="text-primary text-break small">{resolvedUrl}</div></div>
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
            <div class="mb-3">
              <div class="fw-bold small border-bottom mb-1 text-muted">Body</div>
              <pre class="bg-white p-2 border rounded small">{typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody, null, 2)}</pre>
            </div>
            <div class="d-grid mt-4"><Button color="indigo" size="lg" class="shadow rounded-pill fw-bold" onclick={handleExecute}>API EXECUTE</Button></div>
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
  pre { white-space: pre-wrap; word-break: break-all; font-size: 0.75rem; background-color: #fff; border: 1px solid #dee2e6; }
</style>