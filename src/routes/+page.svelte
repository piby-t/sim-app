<script lang="ts">
  /**
   * @file ID Protocol Simulator ダッシュボード
   * @description Mockサーバ関連を排除し、セッション状態と主要機能への導線に特化した画面
   */
  import { 
    Container, Row, Col, Card, CardHeader, CardBody, 
    Button, Badge, ListGroup, ListGroupItem 
  } from "@sveltestrap/sveltestrap";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";

  // セッションコンテキストのアイテム数保持
  let contextCount = $state(0);

  onMount(() => {
    if (!browser) return;
    
    // ストレージから現在のセッション情報を取得してカウント
    const sessionData = localStorage.getItem("sim_session_context");
    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData);
        contextCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch { 
        contextCount = 0; 
      }
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
          <p class="text-muted small">IdP との連携テスト。認可コード取得、トークン交換、UserInfo 呼び出し等のフローをシミュレートします。</p>
          <div class="mt-auto">
            <Button color="primary" href="/oauth/api" class="w-100 fw-bold shadow-sm">
              API エグゼキューターを開く
            </Button>
          </div>
        </CardBody>
      </Card>
    </Col>

    <Col md="6">
      <Card class="h-100 shadow-sm border-indigo">
        <CardHeader class="bg-indigo text-white py-3">
          <h5 class="mb-0"><i class="bi bi-fingerprint me-2"></i>FIDO2 / Passkeys</h5>
        </CardHeader>
        <CardBody class="d-flex flex-column">
          <p class="text-muted small">パスキーの登録・認証フローを検証。デバイスやブラウザが生成するアテステーションや署名の動作確認が可能です。</p>
          <div class="mt-auto">
            <Button color="primary" href="/fido/key_challenge" class="btn-indigo w-100 fw-bold shadow-sm">
              FIDO チャレンジ画面を開く
            </Button>
          </div>
        </CardBody>
      </Card>
    </Col>

    <Col md="4">
      <Card class="shadow-sm border-0 bg-light">
        <CardBody>
          <h6 class="fw-bold mb-3 small text-uppercase text-muted">Context Status</h6>
          <ListGroup flush class="bg-transparent">
            <ListGroupItem class="d-flex justify-content-between align-items-center bg-transparent px-0 border-0">
              <span class="small">Active Session Context</span>
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
              <i class="bi bi-clock-history me-1"></i>直近の実行履歴
            </Button>
            <Button outline color="danger" size="sm" onclick={() => { if(confirm('保存されているセッションデータをすべてクリアしますか？')){ localStorage.clear(); location.reload(); } }}>
              <i class="bi bi-trash me-1"></i>全データの初期化
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