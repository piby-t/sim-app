<script lang="ts">
  /**
   * 認可リクエスト生成ページ (+page.svelte)
   * 強制リセット版：戻るボタンでの変数名書き換えを物理的に阻止
   */
  import {
    Container, Row, Col, Card, CardBody, CardHeader, Button,
  } from "@sveltestrap/sveltestrap";
  import { getContext, onMount, untrack } from "svelte";
  import {
    SERVER_CONTEXT_NAME, CLIENT_CONTEXT_NAME,
    SCOPE_CONTEXT_NAME, AUTH_URL_CONTEXT_NAME,
  } from "$lib/state/StateConst";

  import type { SelectArrayText2State } from "$lib/state/SelectArrayText2State.svelte";
  import type { SelectArrayCheckState } from "$lib/state/SelectArrayCheckState.svelte";
  import type { SelectTextState } from "$lib/state/SelectTextState.svelte";
  import type { SelectArrayText2Props, SelectArrayCheckProps, NameValue } from "$lib/types";

  import serverJson from "$lib/data/oauth/server.json";
  import clientJson from "$lib/data/oauth/client.json";
  import scopeJson from "$lib/data/oauth/scope.json";
  import staticJson from "$lib/data/oauth/static.json";
  import authUrlJson from "$lib/data/oauth/auth_url.json";

  import SelectArrayText2 from "$lib/components/SelectArrayText2.svelte";
  import SelectArrayCheck from "$lib/components/SelectArrayCheck.svelte";
  import ArrayText2 from "$lib/components/ArrayText2.svelte";
  import ClientBasic from "$lib/components/ClientBasic.svelte";
  import SelectText from "$lib/components/SelectText.svelte";
  import ScopeDisplay from "$lib/components/ScopeDisplay.svelte";

  // ファクトリー関数：常にクリーンなコピーを作成
  const createFreshStatic = () => JSON.parse(JSON.stringify(staticJson.list)) as NameValue[];

  // 1. 基本ステート
  let serverPresets = $state(structuredClone(serverJson.list) as SelectArrayText2Props[]);
  let clientPresets = $state(structuredClone(clientJson.list) as SelectArrayText2Props[]);
  let scopePresets = $state(structuredClone(scopeJson.list) as SelectArrayCheckProps[]);
  let staticPresets = $state(createFreshStatic());
  let authUrlPresets = $state(structuredClone(authUrlJson.list) as NameValue[]);

  // 2. フォーム変数の初期化
  let scopeKeyName = $state("scope"); // ここが勝手に変わるのを防ぐ
  let scopeValueText = $state("");
  let secretBase64 = $state("");

  const serverState = getContext<SelectArrayText2State>(SERVER_CONTEXT_NAME);
  const clientState = getContext<SelectArrayText2State>(CLIENT_CONTEXT_NAME);
  const scopeState = getContext<SelectArrayCheckState>(SCOPE_CONTEXT_NAME);
  const authUrlState = getContext<SelectTextState>(AUTH_URL_CONTEXT_NAME);

  /**
   * 【最重要】強制リセット処理
   */
  onMount(() => {
    const hardReset = () => {
      // どんな状態であれ、物理的に "scope" を代入し直す
      scopeKeyName = "scope"; 
      // プリセットも再クローンして初期化
      serverPresets = structuredClone(serverJson.list);
      clientPresets = structuredClone(clientJson.list);
      scopePresets = structuredClone(scopeJson.list);
      staticPresets = createFreshStatic();
    };

    // 初回表示時に実行
    untrack(() => hardReset());

    // 戻るボタン（BFcache）で戻った瞬間に強制的に書き戻す
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.warn("戻るボタンによる復元を検知。変数名を scope にリセットします。");
        hardReset();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  });

  // 派生データ
  let selectedServerData = $derived(serverPresets.find((p) => p.label === serverState.value));
  let selectedClientData = $derived(clientPresets.find((p) => p.label === clientState.value));
  let selectedScopeData = $derived(scopePresets.find((p) => p.label === scopeState.value));

  // パラメータ集約（ここで scopeKeyName を「動的なキー」として使用）
  let allParams = $derived.by(() => {
    const params: Record<string, string> = {};
    selectedServerData?.items.forEach((i) => { if (i.name) params[i.name] = i.value; });
    selectedClientData?.items.forEach((i) => { if (i.name) params[i.name] = i.value; });
    staticPresets.forEach((i) => { if (i.name) params[i.name] = i.value; });

    if (secretBase64) params['secret_base64'] = secretBase64;
    // scopeKeyName に入っている文字列をキーにして値をセット
    if (scopeKeyName) params[scopeKeyName] = scopeValueText;
    
    return params;
  });

  let rawReplacedUrl = $derived.by(() => {
    const baseObj = authUrlPresets.find((u) => u.name === authUrlState.value);
    let url = baseObj ? baseObj.value : "";
    if (!url) return "";
    Object.entries(allParams).forEach(([key, val]) => {
      url = url.split(`#{${key}}`).join(val);
    });
    return url;
  });

  let finalEncodedUrl = $derived(rawReplacedUrl ? (new URL(rawReplacedUrl).toString()) : "");

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
      <Card class="shadow-sm mb-3">
        <CardHeader class="bg-primary text-white py-1">
          <h6 class="mb-0 small">リクエスト設定</h6>
        </CardHeader>
        <CardBody class="pt-2">
          <div class="mb-2">
            <h6 class="text-primary small fw-bold">URL設定</h6>
            <SelectText items={authUrlPresets} bind:selectedLabel={authUrlState.value} />
          </div>
          <div class="mb-2">
            <h6 class="text-primary small fw-bold">サーバー設定</h6>
            <SelectArrayText2 bind:presets={serverPresets} bind:selectedLabel={serverState.value} />
          </div>
          <div class="mb-2">
            <h6 class="text-primary small fw-bold">クライアント設定</h6>
            <SelectArrayText2 bind:presets={clientPresets} bind:selectedLabel={clientState.value} />
            <ClientBasic clientData={selectedClientData} bind:result={secretBase64} />
          </div>
          <div class="mb-2">
            <h6 class="text-primary small fw-bold">Scope設定</h6>
            <SelectArrayCheck presets={scopePresets} bind:selectedLabel={scopeState.value} />
            <ScopeDisplay 
              selectedScopeData={selectedScopeData} 
              bind:name={scopeKeyName} 
              bind:value={scopeValueText} 
            />
          </div>
          <div class="mb-2">
            <h6 class="text-primary small fw-bold">Static設定</h6>
            <ArrayText2 bind:items={staticPresets} />
          </div>
        </CardBody>
      </Card>
    </Col>

    <Col md="6">
      <Card class="shadow-sm border-dashed h-100 bg-dark p-3 text-success font-monospace">
        <div class="mb-4">
          <div class="text-white-50 small border-bottom border-secondary mb-2">■ 1. Raw URL</div>
          <div class="text-break" style="color: #a5d6ff;">{rawReplacedUrl || "---"}</div>
        </div>
        <div class="mb-4">
          <div class="text-white-50 small border-bottom border-secondary mb-2">■ 2. Encoded URL</div>
          <div class="text-break mb-3" style="color: #ffeb3b;">{finalEncodedUrl || "---"}</div>
          <div class="d-grid pt-2">
            <Button color="warning" class="fw-bold" onclick={handleSubmit}>認可リクエスト実行</Button>
          </div>
        </div>
      </Card>
    </Col>
  </Row>
</Container>