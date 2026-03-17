<script lang="ts">
  import { 
    Container, Row, Col, Card, CardHeader, CardBody, 
    Button, Badge, ListGroup, ListGroupItem 
  } from "@sveltestrap/sveltestrap";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";

  // 1. テンプレートで使用することで 'unused' を解消
  let contextCount = $state(0);
  let mockServerStatus = $state<"checking" | "online" | "offline">("checking");

  onMount(async () => {
    if (!browser) return;
    
    // ストレージキー名は実際の保存名に合わせて調整してください（例: sim_session_context）
    const sessionData = localStorage.getItem("sim_session_context");
    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData);
        contextCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch { /* ignore */ }
    }

    try {
      // 2. 'res' 変数への代入を削除して警告を解消
      await fetch("http://localhost:3000/api/fido/register/options", { 
        method: "POST", 
        body: JSON.stringify({}), 
        headers: { "Content-Type": "application/json" } 
      });
      mockServerStatus = "online";
    } catch {
      mockServerStatus = "offline";
    }
  });
</script>

<Container class="py-4">
  <div class="mb-5 text-center">
    <h1 class="display-5 fw-bold text-primary">ID Protocol Simulator</h1>
    <p class="lead text-muted">OAuth 2.0 / OIDC / FIDO2 開発者のための検証ダッシュボード</p>
  </div>

  <Row class="g-4">
    <Col md="6">
      <Card class="h-100 shadow-sm border-primary">
        <CardHeader class="bg-primary text-white py-3">
          <h5 class="mb-0"><i class="bi bi-shield-check me-2"></i>OAuth 2.0 / OIDC</h5>
        </CardHeader>
        <CardBody class="d-flex flex-column">
          <p class="text-muted small">Keycloak 等の IdP との連携テスト。認可コード、トークン取得、UserInfo 呼び出しに対応。</p>
          <div class="mt-auto">
            <Button color="primary" href="/oauth/api" class="w-100 fw-bold">
              API エグゼキューターを開く
            </Button>
          </div>
        </CardBody>
      </Card>
    </Col>

    <Col md="6">
      <Card class="h-100 shadow-sm border-indigo">
        <CardHeader class="bg-indigo text-white py-3">
          <h5 class="mb-0"><i class="bi bi-fingerprint me-2"></i>FIDO2</h5>
        </CardHeader>
        <CardBody class="d-flex flex-column">
          <p class="text-muted small">パスキーの登録・認証フロー。Attestation: none 設定済みの Mock サーバと連携。</p>
          <div class="mt-auto">
            <Button color="primary" href="/fido/key_challenge" class="btn-indigo w-100 fw-bold">
              FIDO チャレンジ画面を開く
            </Button>
          </div>
        </CardBody>
      </Card>
    </Col>

    <Col md="4">
      <Card class="shadow-sm border-0 bg-light">
        <CardBody>
          <h6 class="fw-bold mb-3 small text-uppercase text-muted">System Status</h6>
          <ListGroup flush class="bg-transparent">
            <ListGroupItem class="d-flex justify-content-between align-items-center bg-transparent px-0 border-0 pb-1">
              <span class="small">Mock Server (3000)</span>
              {#if mockServerStatus === 'online'}
                <Badge color="success">ONLINE</Badge>
              {:else if mockServerStatus === 'offline'}
                <Badge color="danger">OFFLINE</Badge>
              {:else}
                <Badge color="secondary">CHECKING...</Badge>
              {/if}
            </ListGroupItem>
            <ListGroupItem class="d-flex justify-content-between align-items-center bg-transparent px-0 border-0">
              <span class="small">Session Context</span>
              <Badge color="info" pill>{contextCount} items</Badge>
            </ListGroupItem>
          </ListGroup>
        </CardBody>
      </Card>
    </Col>

    <Col md="8">
      <Card class="shadow-sm border-0">
        <CardBody>
          <h6 class="fw-bold mb-3 small text-uppercase text-muted">Quick Actions</h6>
          <div class="d-flex gap-2 flex-wrap">
            <Button outline color="secondary" size="sm" href="/oauth/apiresult">
              <i class="bi bi-clock-history me-1"></i>実行履歴を確認
            </Button>
            <Button outline color="secondary" size="sm" onclick={() => { if(confirm('セッションをクリアしますか？')){ localStorage.clear(); location.reload(); } }}>
              <i class="bi bi-trash me-1"></i>コンテキスト初期化
            </Button>
          </div>
        </CardBody>
      </Card>
    </Col>
  </Row>
</Container>

<style>
  :global(.bg-indigo) { background-color: #6610f2 !important; }
  :global(.border-indigo) { border-color: #6610f2 !important; }
  :global(.btn-indigo) { background-color: #6610f2 !important; color: white !important; }
  :global(.btn-indigo:hover) { background-color: #520dc2 !important; color: white !important; }
</style>