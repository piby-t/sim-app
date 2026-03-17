<script lang="ts">
  /**
   * FIDO Challenge (登録用オプション) の取得結果および鍵生成ステータス表示画面
   * RPサーバーへのリクエスト結果と、ローカル環境での仮想鍵ペア保存状態を可視化します。
   */
  import { 
    Container, Row, Col, Card, Alert, Button, Badge 
  } from "@sveltestrap/sveltestrap";
  import { resolve } from "$app/paths";
  import { browser } from "$app/environment"; // 追加: ブラウザ環境判定用
  import type { PageData } from "./$types";
  
  import SimRequest from "$lib/components/SimRequest.svelte";
  import SimResponse from "$lib/components/SimResponse.svelte";

  let { data }: { data: PageData } = $props();

  let record = $derived(data.record);

  // 追加: 画面が表示された瞬間に、新しく作った鍵を「前回選んだ鍵」として localStorage に記憶させる
  $effect(() => {
    if (browser && data.isSuccess && data.userId) {
      localStorage.setItem('fido_last_selected_key', `${data.userId}.json`);
    }
  });
</script>

<Container fluid class="mt-3 pb-5">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h4 class="mb-0 fw-bold text-indigo">
      <i class="bi bi-shield-check me-2"></i>FIDO Challenge 取得結果
    </h4>
    <div class="d-flex gap-2">
      {#if data.isSuccess}
        <Button color="indigo" href={resolve('/fido/key_gen')} class="shadow-sm fw-bold">
          Key Registration <i class="bi bi-arrow-right ms-1"></i>
        </Button>
      {/if}
    </div>
  </div>

  {#if data.isSuccess}
    <Alert color="success" class="d-flex align-items-start shadow-sm border-start border-4 border-success mb-4">
      <i class="bi bi-shield-check fs-2 me-3 text-success"></i>
      <div>
        <div class="fw-bold fs-5 mb-1">新しい鍵ペアを登録しました</div>
        <div class="mt-2 p-2 bg-white rounded border border-success-subtle font-monospace" style="font-size: 0.75rem;">
          <i class="bi bi-file-earmark-code me-1"></i>
          src/lib/data/fido/key/<span class="text-primary fw-bold">{data.userId}.json</span>
        </div>
      </div>
    </Alert>
  {:else}
    <Alert color="danger" class="d-flex align-items-start shadow-sm border-start border-4 border-danger mb-4">
      <i class="bi bi-exclamation-triangle fs-2 me-3 text-danger"></i>
      <div>
        <div class="fw-bold fs-5 mb-1">Challenge の取得に失敗しました</div>
        <div class="small text-muted">
          サーバーから有効な Challenge が返されなかったため、鍵ペアの生成を中断しました。
        </div>
      </div>
    </Alert>
  {/if}

  {#if !record}
    <Card class="text-center p-5 bg-light shadow-sm">
      <div class="text-muted">実行ログが見つかりません。</div>
    </Card>
  {:else}
    <Row class="g-3">
      <Col md="6">
        <div class="d-flex justify-content-between align-items-end mb-2">
          <span class="small fw-bold text-muted text-uppercase">Request to RP Server</span>
          <Badge color="dark" pill>{record.req.method}</Badge>
        </div>
        <SimRequest req={record.req} />
      </Col>

      <Col md="6">
        <div class="d-flex justify-content-between align-items-end mb-2">
          <span class="small fw-bold text-muted text-uppercase">Response from RP Server</span>
          <Badge color={record.res.status < 300 ? 'success' : 'danger'}>
            Status: {record.res.status}
          </Badge>
        </div>
        <SimResponse res={record.res} />
      </Col>
    </Row>
  {/if}
</Container>

<style>
  :global(.text-indigo) { color: #6610f2 !important; }
  :global(.btn-indigo) { background-color: #6610f2 !important; color: white !important; border: none; }
  :global(.btn-indigo:hover) { background-color: #520dc2 !important; color: white !important; }
  :global(.border-indigo) { border-color: #6610f2 !important; }

  :global(.card) {
    height: auto !important;
    min-height: 100%;
  }

  :global(.font-monospace) {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace !important;
  }
</style>