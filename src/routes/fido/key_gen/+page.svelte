<script lang="ts">
  import { 
    Container, Row, Col, Card, CardBody, CardHeader, 
    Button, Table, Badge 
  } from "@sveltestrap/sveltestrap";
  import { getContext, untrack, onMount } from "svelte";
  import { SvelteURLSearchParams } from "svelte/reactivity";
  import { SERVER_CONTEXT_NAME, CLIENT_CONTEXT_NAME } from "$lib/state/StateConst";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  
  import ArrayText2 from "$lib/components/ArrayText2.svelte";
  import SelectArrayText2 from "$lib/components/SelectArrayText2.svelte";
  import KeyFileSelector from "$lib/components/KeyFileSelector.svelte";
  import ClientBasic from "$lib/components/ClientBasic.svelte";
  
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
  let sessionValues = $state<NameValue[]>([]);
  let secretBase64 = $state(""); 

  let flagUP = $state(true);  
  let flagUV = $state(false); 
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

  const apiCatalog = $derived(data.apiCatalog as Record<string, ApiDefinition[]> || {});
  const keyFiles = $derived(data.keyFiles || []);
  const keyContents = $derived(data.keyContents as Record<string, CredentialRecord>);

  const selectedServerData = $derived(serverPresets.find((p) => p.label === serverState.value));
  const selectedClientData = $derived(clientPresets.find((p) => p.label === clientState.value));

  let calculatedFlags = $derived(
    (flagUP ? 0x01 : 0) |
    (flagUV ? 0x04 : 0) |
    (flagBE ? 0x08 : 0) |
    (flagBS ? 0x10 : 0) |
    (flagAT ? 0x40 : 0) |
    (flagED ? 0x80 : 0)
  );

  // ✅ 修正: 選択した鍵ファイルが切り替わったときのフラグ復元ロジック
  $effect(() => {
    if (selectedKeyFile !== previousKeyFile) {
      previousKeyFile = selectedKeyFile;
      if (selectedKeyFile && keyContents && keyContents[selectedKeyFile]) {
        const kData = keyContents[selectedKeyFile];
        untrack(() => {
          if (kData.flags) {
            // 新しく作成された鍵ファイル（flagsを完備）の場合
            flagUP = !!kData.flags.up;
            flagUV = !!kData.flags.uv;
            flagBE = !!kData.flags.be;
            flagBS = !!kData.flags.bs;
            flagAT = !!kData.flags.at;
            flagED = !!kData.flags.ed;
          } else {
            // 古いシミュレータで作成された鍵ファイルへの後方互換性
            flagUP = true;
            flagUV = false;
            flagBE = !!kData.backupEligibility;
            flagBS = !!kData.backupState;
            flagAT = true;
            flagED = false;
          }
          manualSignCount = kData.signCount || 0;
        });
      }
    }
  });

  let allParams = $derived.by(() => {
    const params: Record<string, string> = {};
    sessionValues.forEach((v) => { if (v.name) params[v.name] = v.value; });
    if (selectedKeyFile) params['selected_key_user_id'] = selectedKeyFile.replace('.json', '');
    selectedServerData?.items.forEach((i) => { if (i.name) params[i.name] = i.value; });
    selectedClientData?.items.forEach((i) => { if (i.name) params[i.name] = i.value; });
    staticPresets.forEach((i) => { if (i.name) params[i.name] = i.value; });
    if (secretBase64) params['secret_base64'] = secretBase64; 

    for (const [k, v] of Object.entries(genData)) {
      params[`gen.${k}`] = String(v);
    }
    return params;
  });

  function processTemplate(input: unknown): unknown {
    if (typeof input === 'string') {
      return input.replace(/\${([\w.-]+)}|#{([\w.-]+)}/g, (match, p1, p2) => {
        const key = p1 || p2;
        return allParams[key] !== undefined ? allParams[key] : match;
      });
    }
    if (Array.isArray(input)) {
      return input.map(item => processTemplate(item));
    }
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

  let resolvedBody = $derived.by(() => {
    if (!selectedApi || selectedApi.method === 'GET' || !selectedApi.body) return null;
    return processTemplate(selectedApi.body);
  });

  async function triggerFidoGeneration() {
    if (!browser) return;
    if (!selectedApi) {
      genData = {}; genError = null; return;
    }

    const bodyStr = JSON.stringify(selectedApi.body || "");
    const urlStr = selectedApi.url || "";
    const needsGen = bodyStr.includes('#{gen.') || urlStr.includes('#{gen.');

    if (!needsGen) {
      genData = {}; genError = null; return;
    }

    if (!selectedKeyFile) {
      genError = "鍵ファイルが選択されていません。";
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
      const res = await fetch('/fido/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge, rpId, origin, keyFileName: selectedKeyFile, type: 'webauthn.create',
          flagsOverride: calculatedFlags,
          signCountOverride: manualSignCount
        })
      });
      
      const responseData = await res.json();
      if (responseData.error) {
        genError = responseData.error; genData = {};
      } else {
        genData = responseData; 
      }
    } catch {
      genError = "生成APIへの通信に失敗しました。"; genData = {};
    }
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
    if (!browser) return; 
    if (!selectedApi) return;

    const bodyStr = typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody);
    if (bodyStr?.includes('#{gen.') || resolvedUrl.includes('#{gen.')) {
      alert("FIDOデータの生成が未完了です。鍵ファイルを選択するか、エラーを解消してください。");
      return;
    }

    const payload = { 
      method: selectedApi.method, url: resolvedUrl, headers: resolvedHeaders, body: resolvedBody, keyFile: selectedKeyFile 
    };

    try {
      const response = await fetch('/fido/key_gen_call', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        // eslint-disable-next-line svelte/no-navigation-without-resolve
        await goto('/fido/key_result');
      } else {
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        alert(`APIの実行に失敗しました。\nHTTPステータス: ${response.status}\n詳細: ${errorText.substring(0, 200)}`);
      }
    } catch (err) {
      console.error("Network Error:", err);
      alert(`通信エラーが発生しました。\nネットワーク接続やプロキシの設定を確認してください。\n${err}`);
    }
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
            <select class="form-select form-select-sm shadow-sm" onchange={(e) => {
              const val = e.currentTarget.value;
              if (!val) { selectedApi = null; return; }
              const [group, fileName] = val.split('|');
              selectedApi = apiCatalog[group]?.find(a => a.fileName === fileName) || null;
            }}>
              <option value="">APIを選択してください...</option>
              {#each Object.entries(apiCatalog) as [group, list] (group)}
                <optgroup label={group}>
                  {#each list as api (api.fileName)}
                    <option value="{group}|{api.fileName}">{api.display || api.fileName}</option>
                  {/each}
                </optgroup>
              {/each}
            </select>
          </div>

          <div class="mb-3 pb-3 border-bottom">
            <KeyFileSelector keyFiles={keyFiles} bind:selectedKeyFile={selectedKeyFile} />
            
            {#if selectedKeyFile}
            <div class="row g-2 mt-2 bg-light p-2 rounded border mx-0">
              <div class="col-12 mb-2">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <div class="small fw-bold text-muted mb-0">Authenticator Data Flags</div>
                  <Badge color="secondary" class="font-monospace">
                    0x{calculatedFlags.toString(16).padStart(2, '0').toUpperCase()}
                  </Badge>
                </div>
                <div class="d-flex flex-wrap gap-3 mt-2">
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="flagUP" bind:checked={flagUP}>
                    <label class="form-check-label small" for="flagUP" title="User Present">UP</label>
                  </div>
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="flagUV" bind:checked={flagUV}>
                    <label class="form-check-label small" for="flagUV" title="User Verified">UV</label>
                  </div>
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="flagBE" bind:checked={flagBE}>
                    <label class="form-check-label small" for="flagBE" title="Backup Eligibility">BE</label>
                  </div>
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="flagBS" bind:checked={flagBS}>
                    <label class="form-check-label small" for="flagBS" title="Backup State">BS</label>
                  </div>
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="flagAT" bind:checked={flagAT}>
                    <label class="form-check-label small" for="flagAT" title="Attested Credential Data">AT</label>
                  </div>
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="flagED" bind:checked={flagED}>
                    <label class="form-check-label small" for="flagED" title="Extension Data">ED</label>
                  </div>
                </div>
              </div>
              <div class="col-12 border-top pt-2">
                <label for="signCountInput" class="small fw-bold text-muted mb-1">SignCount</label>
                <input id="signCountInput" type="number" class="form-control form-control-sm font-monospace w-50" bind:value={manualSignCount} min="0" />
              </div>
            </div>
            {/if}
          </div>

          <div class="mb-3">
            <h6 class="text-indigo mb-1 small fw-bold"><i class="bi bi-hdd-network me-1"></i>RP サーバー設定</h6>
            <SelectArrayText2 bind:presets={serverPresets} bind:selectedLabel={serverState.value} />
          </div>
          
          <div class="mb-3 pb-3 border-bottom">
            <h6 class="text-indigo mb-1 small fw-bold"><i class="bi bi-laptop me-1"></i>クライアント設定</h6>
            <SelectArrayText2 bind:presets={clientPresets} bind:selectedLabel={clientState.value} />
            <ClientBasic clientData={selectedClientData} bind:result={secretBase64} /> </div>

          <div class="mb-3">
            <h6 class="text-indigo small fw-bold mb-1"><i class="bi bi-clock-history me-1"></i>Session Context</h6>
            <ArrayText2 bind:items={sessionValues} />
          </div>
          
          <div class="mb-1">
            <h6 class="text-muted mb-1 small fw-bold"><i class="bi bi-gear me-1"></i>共通変数 (Static)</h6>
            <ArrayText2 bind:items={staticPresets} />
          </div>

        </CardBody>
      </Card>
    </Col>

    <Col lg="6">
      <Card class="shadow-sm border-dark h-100 sticky-top" style="top: 1rem; max-height: calc(100vh - 2rem); overflow-y: auto;">
        <CardHeader class="bg-light py-2 d-flex justify-content-between align-items-center">
          <h6 class="mb-0 fw-bold text-uppercase small">Request Preview</h6>
          {#if selectedApi}<Badge color="warning" class="text-dark">{selectedApi.method}</Badge>{/if}
        </CardHeader>
        <CardBody class="bg-light font-monospace">
          
          {#if genError}
            <div class="alert alert-danger small py-2 mb-3 shadow-sm border-0">
              <i class="bi bi-exclamation-triangle-fill me-1"></i>
              <strong>生成エラー:</strong> {genError}
            </div>
          {/if}

          {#if selectedApi}
            <div class="mb-3">
              <div class="fw-bold small border-bottom mb-1 text-muted">Endpoint URL</div>
              <div class="text-primary text-break small" style="font-size: 0.8rem;">{resolvedUrl}</div>
            </div>

            <div class="mb-3">
              <div class="fw-bold small border-bottom mb-1 text-muted">Headers</div>
              <Table size="sm" class="bg-white border mb-0" style="table-layout: fixed; font-size: 0.75rem;">
                <tbody>
                  {#each resolvedHeaders as h (h.name)}
                    <tr>
                      <td class="fw-bold bg-light-subtle" style="width:35%">{h.name}</td>
                      <td class="text-break">{h.value}</td>
                    </tr>
                  {:else}
                    <tr><td colspan="2" class="text-center text-muted py-2">No Headers</td></tr>
                  {/each}
                </tbody>
              </Table>
            </div>

            <div class="mb-3">
              <div class="fw-bold small border-bottom mb-1 text-muted">Payload (Body)</div>
              <pre class="bg-white p-2 border rounded small mb-0">{typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody, null, 2)}</pre>
            </div>

            <div class="d-grid mt-4">
              <Button color="indigo" size="lg" class="shadow rounded-pill fw-bold" onclick={handleExecute}>
                <i class="bi bi-rocket-takeoff-fill me-2"></i>API EXECUTE
              </Button>
            </div>
          {:else}
            <div class="py-5 text-center text-muted">
              <i class="bi bi-arrow-left-circle fs-1 d-block mb-3 opacity-25"></i>
              <p class="small">左側のカタログから API を選択してください。</p>
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
  pre { white-space: pre-wrap; word-break: break-all; font-size: 0.75rem; line-height: 1.3; background-color: #fff; border: 1px solid #dee2e6; }
  :global(.sticky-top) { z-index: 10; }
  .text-break { word-break: break-all; }
  .form-switch .form-check-input { cursor: pointer; }
  .form-switch .form-check-label { cursor: pointer; user-select: none; }
</style>