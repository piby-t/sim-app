<script lang="ts">
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
  import ApiCatalogSelector from "$lib/components/ApiCatalogSelector.svelte"; // ✅ 追加

  import type { SelectArrayText2State } from "$lib/state/SelectArrayText2State.svelte";
  import type { NameValue, ApiDefinition, SelectArrayText2Props, CredentialRecord } from "$lib/types";
  import type { PageData } from "./$types";

  import serverJson from "$lib/data/oauth/server.json"; 
  import clientJson from "$lib/data/oauth/client.json";
  import staticJson from "$lib/data/oauth/static.json";

  let { data }: { data: PageData } = $props();

  const createFreshStatic = () => structuredClone(staticJson.list) as NameValue[];
  const createFreshServer = () => structuredClone(serverJson.list) as SelectArrayText2Props[];
  const createFreshClient = () => structuredClone(clientJson.list) as SelectArrayText2Props[];

  let selectedApi = $state<ApiDefinition | null>(null);
  let selectedKeyFile = $state(""); 
  let serverPresets = $state(createFreshServer());
  let clientPresets = $state(createFreshClient());
  let staticPresets = $state(createFreshStatic());
  let secretBase64 = $state("");
  let sessionValues = $state<NameValue[]>([]);

  let flagUP = $state(true);   
  let flagUV = $state(true); 
  let flagBE = $state(false); 
  let flagBS = $state(false); 
  let flagAT = $state(false); 
  let flagED = $state(false); 
  let manualSignCount = $state(0);
  let previousKeyFile = "";

  let genData = $state<Record<string, string>>({});
  let genError = $state<string | null>(null);

  const serverState = getContext<SelectArrayText2State>(SERVER_CONTEXT_NAME);
  const clientState = getContext<SelectArrayText2State>(CLIENT_CONTEXT_NAME);

  const keyFiles = $derived(data.keyFiles || []);
  const keyContents = $derived(data.keyContents as Record<string, CredentialRecord> || {});

  let calculatedFlags = $derived(
    (flagUP ? 0x01 : 0) | (flagUV ? 0x04 : 0) | (flagBE ? 0x08 : 0) |
    (flagBS ? 0x10 : 0) | (flagAT ? 0x40 : 0) | (flagED ? 0x80 : 0)
  );

  $effect(() => {
    if (selectedKeyFile !== previousKeyFile) {
      previousKeyFile = selectedKeyFile;
      if (selectedKeyFile && keyContents[selectedKeyFile]) {
        const kData = keyContents[selectedKeyFile];
        untrack(() => {
          if (kData.flags) {
            flagUP = !!kData.flags.up; flagUV = !!kData.flags.uv; flagBE = !!kData.flags.be;
            flagBS = !!kData.flags.bs; flagAT = false; flagED = !!kData.flags.ed;
          }
          manualSignCount = (kData.signCount || 0) + 1;
        });
      }
    }
  });

  let selectedServerData = $derived(serverPresets.find((p) => p.label === serverState.value));
  let selectedClientData = $derived(clientPresets.find((p) => p.label === clientState.value));

  let allParams = $derived.by(() => {
    const params: Record<string, string> = {};
    sessionValues.forEach((v) => { if(v.name) params[v.name] = v.value; });
    if (selectedKeyFile && keyContents[selectedKeyFile]) {
      const k = keyContents[selectedKeyFile];
      params['key.credentialId'] = k.credentialId || "";
      params['key.rpId'] = k.rpId || "";
      params['key.userId'] = k.userId || "";
      params['key.userName'] = k.userName || "";
      params['key.displayName'] = k.displayName || "";
      params['selected_key_user_id'] = k.userId || "";
    }
    selectedServerData?.items.forEach((i) => { if (i.name) params[i.name] = i.value; });
    selectedClientData?.items.forEach((i) => { if (i.name) params[i.name] = i.value; });
    staticPresets.forEach((i) => { if (i.name) params[i.name] = i.value; });
    if (secretBase64) params['secret_base64'] = secretBase64;
    for (const [k, v] of Object.entries(genData)) { params[`auth.${k}`] = String(v); }
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
      for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
        out[k] = processTemplate(v);
      }
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
    if (!bodyStr.includes('#{auth.') && !urlStr.includes('#{auth.')) return;
    genError = null;
    const challenge = sessionValues.find(v => v.name === 'challenge')?.value || '';
    const rpId = sessionValues.find(v => v.name === 'rpId')?.value || 'localhost';
    const origin = sessionValues.find(v => v.name === 'origin')?.value || 'http://localhost:3000';
    try {
      const res = await fetch('/fido/authenticate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge, rpId, origin, keyFileName: selectedKeyFile, flagsOverride: calculatedFlags, signCountOverride: manualSignCount })
      });
      const responseData = await res.json();
      if (responseData.error) { genError = responseData.error; genData = {}; }
      else { genData = { ...responseData }; }
    } catch (err: unknown) { genError = `通信失敗: ${err instanceof Error ? err.message : String(err)}`; genData = {}; }
  }

  $effect(() => {
    if (selectedApi && selectedKeyFile && calculatedFlags !== undefined && manualSignCount !== undefined) {
      untrack(() => triggerFidoGeneration());
    }
  });

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

  async function handleExecute() {
    if (!browser || !selectedApi) return;
    const bodyStr = typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody);
    if (bodyStr?.includes('#{auth.') || resolvedUrl.includes('#{auth.')) {
      alert("FIDOデータの生成が未完了です。署名を再生成してください。");
      return;
    }
    const payload = { method: selectedApi.method, url: resolvedUrl, headers: resolvedHeaders, body: resolvedBody, keyFile: selectedKeyFile, usedSignCount: manualSignCount };
    try {
      const response = await fetch('/fido/auth_gen_call', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (response.ok) { 
        // eslint-disable-next-line
        await goto('/fido/auth_result'); 
      }
      else { alert(`API Error: ${response.status}`); }
    } catch (err: unknown) { alert(`Network Error: ${err}`); }
  }
</script>

<Container fluid class="mt-3 pb-4">
  <Row class="g-3">
    <Col md="6">
      <Card class="shadow-sm border-0">
        <CardHeader class="bg-indigo text-white py-2">
          <h6 class="mb-0 fw-bold small"><i class="bi bi-shield-lock me-2"></i>FIDO 認証(Login) リクエスト設定</h6>
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
              <div class="col-12 mb-2">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <div class="small fw-bold text-muted mb-0">Authenticator Data Flags</div>
                  <Badge color="secondary" class="font-monospace">0x{calculatedFlags.toString(16).padStart(2, '0').toUpperCase()}</Badge>
                </div>
                <div class="d-flex flex-wrap gap-3 mt-2">
                  <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="fUP" bind:checked={flagUP}><label class="form-check-label small" for="fUP">UP</label></div>
                  <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="fUV" bind:checked={flagUV}><label class="form-check-label small" for="fUV">UV</label></div>
                  <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="fBE" bind:checked={flagBE}><label class="form-check-label small" for="fBE">BE</label></div>
                  <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="fBS" bind:checked={flagBS}><label class="form-check-label small" for="fBS">BS</label></div>
                  <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="fAT" bind:checked={flagAT}><label class="form-check-label small" for="fAT">AT</label></div>
                  <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="fED" bind:checked={flagED}><label class="form-check-label small" for="fED">ED</label></div>
                </div>
              </div>
              <div class="col-12 border-top pt-2">
                <label for="scIn" class="small fw-bold text-muted mb-1">SignCount (Next Value)</label>
                <input id="scIn" type="number" class="form-control form-control-sm font-monospace w-50" bind:value={manualSignCount} min="0" />
              </div>
            </div>
            {/if}
          </div>

          <div class="mb-3"><h6 class="text-indigo small fw-bold mb-1">Session Context</h6><ArrayText2 bind:items={sessionValues} /></div>
          <div class="mb-3"><h6 class="text-indigo mb-1 small fw-bold">RPサーバー設定</h6><SelectArrayText2 bind:presets={serverPresets} bind:selectedLabel={serverState.value} /></div>
          <div class="mb-3 pb-3 border-bottom"><h6 class="text-indigo mb-1 small fw-bold">クライアント設定</h6><SelectArrayText2 bind:presets={clientPresets} bind:selectedLabel={clientState.value} /><ClientBasic clientData={selectedClientData} bind:result={secretBase64} /></div>
          <div class="mb-1"><h6 class="text-indigo mb-1 small fw-bold">Static設定 (共通変数)</h6><ArrayText2 bind:items={staticPresets} /></div>
        </CardBody>
      </Card>
    </Col>

    <Col md="6">
      <Card class="shadow-sm border-dark h-100 sticky-top" style="top: 1rem;">
        <CardHeader class="bg-dark text-white py-2 d-flex justify-content-between align-items-center"><h6 class="mb-0 fw-bold small">送信電文プレビュー</h6>{#if selectedApi}<Badge color="warning" class="text-dark">{selectedApi.method}</Badge>{/if}</CardHeader>
        <CardBody class="bg-light p-3 font-monospace overflow-auto">
          {#if genError}<div class="alert alert-danger small py-2 mb-3">{genError}</div>{/if}
          {#if selectedApi}
            <div class="mb-3 border-bottom pb-1"><div class="fw-bold small text-muted">URL</div><div class="text-break text-primary small">{resolvedUrl}</div></div>
            <div class="mb-3"><div class="fw-bold small border-bottom mb-1 text-muted">Headers</div><Table size="sm" class="bg-white border mb-0 small"><tbody>{#each resolvedHeaders as h, i (`${h.name}-${i}`)}<tr><td class="fw-bold" style="width:35%">{h.name}</td><td class="text-break">{h.value}</td></tr>{/each}</tbody></Table></div>
            <div class="mb-3"><div class="fw-bold small border-bottom mb-1 text-muted">Body</div><pre class="p-2 bg-white border rounded small"><code>{typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody, null, 2)}</code></pre></div>
            <div class="d-grid mt-4"><Button color="indigo" size="lg" class="fw-bold shadow" onclick={handleExecute}>API EXECUTE</Button></div>
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
  pre { white-space: pre-wrap; word-break: break-all; font-size: 0.75rem; background-color: white; border: 1px solid #dee2e6; }
</style>