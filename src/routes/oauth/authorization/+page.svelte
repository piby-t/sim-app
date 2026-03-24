<script lang="ts">
  /**
   * @file 認可リクエスト生成ページ
   * @description 外部データ対応・型安全・強制リセット版
   */
  import { Container, Row, Col, Card, CardBody, CardHeader, Button } from "@sveltestrap/sveltestrap";
  import { getContext, onMount, untrack } from "svelte";
  import { SERVER_CONTEXT_NAME, CLIENT_CONTEXT_NAME, SCOPE_CONTEXT_NAME, AUTH_URL_CONTEXT_NAME } from "$lib/state/StateConst";

  import type { SelectArrayText2State } from "$lib/state/SelectArrayText2State.svelte";
  import type { SelectArrayCheckState } from "$lib/state/SelectArrayCheckState.svelte";
  import type { SelectTextState } from "$lib/state/SelectTextState.svelte";
  import type { SelectArrayText2Props, SelectArrayCheckProps, NameValue } from "$lib/types";
  import type { PageData } from "./$types";

  import SelectArrayText2 from "$lib/components/SelectArrayText2.svelte";
  import SelectArrayCheck from "$lib/components/SelectArrayCheck.svelte";
  import ArrayText2 from "$lib/components/ArrayText2.svelte";
  import ClientBasic from "$lib/components/ClientBasic.svelte";
  import SelectText from "$lib/components/SelectText.svelte";
  import ScopeDisplay from "$lib/components/ScopeDisplay.svelte";

  // props から data を取得
  let { data }: { data: PageData } = $props();

  // ファクトリー関数：PageData からクリーンなコピーを作成 (state_referenced_locally 警告対策)
  const createFreshStatic = () => structuredClone(data.staticPresets.list);
  const createFreshServer = () => structuredClone(data.serverPresets.list);
  const createFreshClient = () => structuredClone(data.clientPresets.list);
  const createFreshScope = () => structuredClone(data.scopePresets.list);
  const createFreshAuthUrl = () => structuredClone(data.authUrlPresets.list);

  // 1. 基本ステート
  let serverPresets = $state<SelectArrayText2Props[]>(createFreshServer());
  let clientPresets = $state<SelectArrayText2Props[]>(createFreshClient());
  let scopePresets = $state<SelectArrayCheckProps[]>(createFreshScope());
  let staticPresets = $state<NameValue[]>(createFreshStatic());
  let authUrlPresets = $state<NameValue[]>(createFreshAuthUrl());

  // 2. フォーム変数
  let scopeKeyName = $state("scope"); 
  let scopeValueText = $state("");
  let secretBase64 = $state("");

  const serverState = getContext<SelectArrayText2State>(SERVER_CONTEXT_NAME);
  const clientState = getContext<SelectArrayText2State>(CLIENT_CONTEXT_NAME);
  const scopeState = getContext<SelectArrayCheckState>(SCOPE_CONTEXT_NAME);
  const authUrlState = getContext<SelectTextState>(AUTH_URL_CONTEXT_NAME);

  /**
   * 強制リセット処理
   */
  onMount(() => {
    const hardReset = () => {
      scopeKeyName = "scope"; 
      serverPresets = createFreshServer();
      clientPresets = createFreshClient();
      scopePresets = createFreshScope();
      staticPresets = createFreshStatic();
      authUrlPresets = createFreshAuthUrl();
    };

    untrack(() => hardReset());

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.warn("戻るボタンによる復元を検知。ステートをリセットします。");
        hardReset();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  });

  // 派生データ (引数 p に型を明示して 7006 エラー解消)
  const selectedServerData = $derived(serverPresets.find((p: SelectArrayText2Props) => p.label === serverState.value));
  const selectedClientData = $derived(clientPresets.find((p: SelectArrayText2Props) => p.label === clientState.value));
  const selectedScopeData = $derived(scopePresets.find((p: SelectArrayCheckProps) => p.label === scopeState.value));

  // パラメータ集約 (引数 i に型を明示して 7006 エラー解消)
  let allParams = $derived.by(() => {
    const params: Record<string, string> = {};
    selectedServerData?.items.forEach((i: NameValue) => { if (i.name) params[i.name] = i.value; });
    selectedClientData?.items.forEach((i: NameValue) => { if (i.name) params[i.name] = i.value; });
    staticPresets.forEach((i: NameValue) => { if (i.name) params[i.name] = i.value; });

    if (secretBase64) params['secret_base64'] = secretBase64;
    if (scopeKeyName) params[scopeKeyName] = scopeValueText;
    
    return params;
  });

  let rawReplacedUrl = $derived.by(() => {
    const baseObj = authUrlPresets.find((u: NameValue) => u.name === authUrlState.value);
    let url = baseObj ? baseObj.value : "";
    if (!url) return "";
    Object.entries(allParams).forEach(([key, val]) => {
      url = url.split(`#{${key}}`).join(val);
    });
    return url;
  });

  let finalEncodedUrl = $derived.by(() => {
    if (!rawReplacedUrl) return "";
    try {
        return new URL(rawReplacedUrl).toString();
    } catch {
        return "";
    }
  });

  function handleSubmit() {
    if (!finalEncodedUrl) return;
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/oauth/authzcall";
    
    const addInput = (name: string, value: string) => {
      const input = document.createElement("input");
      input.type = "hidden"; input.name = name; input.value = value;
      form.appendChild(input);
    };
    
    addInput("rawUrl", rawReplacedUrl);
    addInput("encodedUrl", finalEncodedUrl);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }
</script>

<Container fluid class="mt-3">
  <Row>
    <Col md="6">
      <Card class="shadow-sm mb-3 border-0">
        <CardHeader class="bg-primary text-white py-1">
          <h6 class="mb-0 small fw-bold">認可リクエスト設定</h6>
        </CardHeader>
        <CardBody class="pt-2">
          <div class="mb-2">
            <h6 class="text-primary small fw-bold mb-1">URL設定</h6>
            <SelectText items={authUrlPresets} bind:selectedLabel={authUrlState.value} />
          </div>
          <div class="mb-2 border-top pt-2">
            <h6 class="text-primary small fw-bold mb-1">サーバー設定</h6>
            <SelectArrayText2 bind:presets={serverPresets} bind:selectedLabel={serverState.value} />
          </div>
          <div class="mb-2 border-top pt-2">
            <h6 class="text-primary small fw-bold mb-1">クライアント設定</h6>
            <SelectArrayText2 bind:presets={clientPresets} bind:selectedLabel={clientState.value} />
            <ClientBasic clientData={selectedClientData} bind:result={secretBase64} />
          </div>
          <div class="mb-2 border-top pt-2">
            <h6 class="text-primary small fw-bold mb-1">Scope設定</h6>
            <SelectArrayCheck presets={scopePresets} bind:selectedLabel={scopeState.value} />
            <ScopeDisplay 
              selectedScopeData={selectedScopeData} 
              bind:name={scopeKeyName} 
              bind:value={scopeValueText} 
            />
          </div>
          <div class="mb-2 border-top pt-2">
            <h6 class="text-primary small fw-bold mb-1">Static設定</h6>
            <ArrayText2 bind:items={staticPresets} />
          </div>
        </CardBody>
      </Card>
    </Col>

    <Col md="6">
      <Card class="shadow-sm border-dark h-100 bg-dark p-3 text-success font-monospace">
        <div class="mb-4">
          <div class="text-white-50 small border-bottom border-secondary mb-2">■ 1. Raw URL</div>
          <div class="text-break small" style="color: #a5d6ff;">{rawReplacedUrl || "---"}</div>
        </div>
        <div class="mb-4">
          <div class="text-white-50 small border-bottom border-secondary mb-2">■ 2. Encoded URL</div>
          <div class="text-break small mb-3" style="color: #ffeb3b;">{finalEncodedUrl || "---"}</div>
          <div class="d-grid pt-2">
            <Button color="warning" class="fw-bold shadow" onclick={handleSubmit}>認可リクエスト実行</Button>
          </div>
        </div>
      </Card>
    </Col>
  </Row>
</Container>