<script lang="ts">
  import { 
    Container, Row, Col, Card, Alert, Button, Badge 
  } from "@sveltestrap/sveltestrap";
  import { resolve } from "$app/paths";
  import type { PageData } from "./$types";
  
  import SimRequest from "$lib/components/SimRequest.svelte";
  import SimResponse from "$lib/components/SimResponse.svelte";

  let { data }: { data: PageData } = $props();

  let record = $derived(data.record);
</script>

<Container fluid class="mt-3 pb-5">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h4 class="mb-0 fw-bold text-teal">
      <i class="bi bi-fingerprint me-2"></i>Auth Challenge 取得結果
    </h4>
    <div class="d-flex gap-2">
      {#if data.isSuccess}
        <Button color="teal" href={resolve('/fido/auth_gen')} class="shadow-sm fw-bold">
          Auth Execution <i class="bi bi-arrow-right ms-1"></i>
        </Button>
      {/if}
    </div>
  </div>

  {#if data.isSuccess}
    <Alert color="success" class="d-flex align-items-start shadow-sm border-start border-4 border-success mb-4">
      <i class="bi bi-check-circle fs-2 me-3 text-success"></i>
      <div>
        <div class="fw-bold fs-5 mb-1">Challenge の取得に成功しました</div>
        <div class="small text-muted">
          RPサーバーからの認証用 Challenge (Assertion Options) を正常に受信し、セッションに保存しました。
        </div>
      </div>
    </Alert>
  {:else}
    <Alert color="danger" class="d-flex align-items-start shadow-sm border-start border-4 border-danger mb-4">
      <i class="bi bi-exclamation-triangle fs-2 me-3 text-danger"></i>
      <div>
        <div class="fw-bold fs-5 mb-1">Challenge の取得に失敗しました</div>
        <div class="small text-muted">
          サーバーから有効な Challenge が返されなかったか、通信エラーが発生しました。
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
  :global(.text-teal) { color: #20c997 !important; }
  :global(.btn-teal) { background-color: #20c997 !important; color: white !important; border: none; }
  :global(.btn-teal:hover) { background-color: #1aa179 !important; color: white !important; }

  :global(.card) {
    height: auto !important;
    min-height: 100%;
  }

  :global(.font-monospace) {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace !important;
  }
</style>