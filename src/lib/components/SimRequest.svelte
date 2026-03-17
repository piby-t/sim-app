<script lang="ts">
  /**
   * シミュレーション履歴詳細表示コンポーネント
   */
  import type { SimReq, NameValue, SimRes, JsonValue } from '$lib/types';
  import { Badge, Table, Card, CardHeader, CardBody } from '@sveltestrap/sveltestrap';
  import { formatJson } from '$lib/util/fmt-trans'; // インポート追加

  // Props定義
  let { req, res }: { req: SimReq, res?: SimRes | null } = $props();

  /**
   * テーマ設定
   */
  let theme = $derived.by(() => {
    switch (req.kind) {
      case 'Authorization': return { color: 'primary', label: '送信リクエスト' };
      case 'API':           return { color: 'primary', label: '送信リクエスト' };
      case 'Display':       return { color: 'indigo',  label: '受信リクエスト' };
      default:              return { color: 'secondary', label: 'リクエスト' };
    }
  });

  /**
   * Content-Type ヘッダーによる JSON 判定
   */
  let isJson = $derived.by(() => {
    if (req.kind === 'Authorization' || !req.header) return false;
    const ct = req.header.find(h => h.name.toLowerCase() === 'content-type');
    return ct?.value.includes('application/json') ?? false;
  });

  /**
   * ボディ表示用フォーマッタ (強化版)
   * 文字列、NameValue配列、Recordオブジェクトの全てを美しく整形します。
   */
  function formatBody(body: string | NameValue[] | Record<string, JsonValue> | null | undefined): string {
    if (!body) return "";

    // 1. 文字列の場合は formatJson に任せる (パース失敗時はそのまま返る)
    if (typeof body === 'string') {
      return formatJson(body);
    }

    // 2. オブジェクトや配列の場合は JSON.stringify で整形
    try {
      return JSON.stringify(body, null, 2);
    } catch {
      return String(body);
    }
  }
</script>

<Card class="shadow-sm border-{theme.color} mb-3">
  <CardHeader class="bg-{theme.color} text-white py-2 d-flex align-items-center justify-content-between">
    <h6 class="mb-0">{theme.label}</h6>
    <Badge color="light" class="text-{theme.color}">{req.kind}</Badge>
  </CardHeader>
  
  <CardBody class="p-3 bg-light-subtle">
    <div class="mb-3">
      <div class="small fw-bold text-muted mb-1">
        {req.kind === 'Display' ? 'Received URL:' : 'Target URL:'}
      </div>
      <div class="p-2 bg-white border rounded small text-break font-monospace text-{theme.color}">
        {req.url}
      </div>
    </div>

    {#if req.kind === 'API' || req.kind === 'Display'}
      <div class="mb-2">
        <span class="small fw-bold text-muted">Method:</span>
        <Badge color="info" class="ms-1">{req.method}</Badge>
      </div>

      {#if req.header && req.header.length > 0}
        <div class="small fw-bold text-muted mb-1">Headers:</div>
        <Table size="sm" bordered class="small mb-3 bg-white">
          <tbody>
            {#each req.header as h (h.name)}
              <tr>
                <td class="bg-light fw-bold text-secondary" style="width: 35%;">{h.name}</td>
                <td class="text-break">{h.value}</td>
              </tr>
            {/each}
          </tbody>
        </Table>
      {/if}

      {#if req.body && req.method !== 'GET'}
        <div class="small fw-bold text-muted mb-1">Body:</div>
        
        {#if isJson || typeof req.body === 'string' || (!Array.isArray(req.body) && typeof req.body === 'object')}
          <pre class="p-2 bg-white border rounded small mb-0 full-view"><code>{formatBody(req.body)}</code></pre>
        {:else if Array.isArray(req.body)}
          <Table size="sm" bordered class="small mb-0 bg-white">
            <thead class="bg-light">
              <tr>
                <th class="text-secondary" style="width: 35%;">Key</th>
                <th class="text-secondary">Value</th>
              </tr>
            </thead>
            <tbody>
              {#each req.body as pair (pair.name)}
                <tr>
                  <td class="bg-light-subtle font-monospace">{pair.name}</td>
                  <td class="text-break font-monospace">{pair.value}</td>
                </tr>
              {/each}
            </tbody>
          </Table>
        {/if}
      {/if}

      {#if res}
        <div class="mt-4 pt-3 border-top border-2">
          <div class="small fw-bold text-muted mb-2 d-flex align-items-center justify-content-between">
            <span>Result (Response):</span>
            {#if res.kind !== 'Authorization'}
              <Badge color={res.status < 300 ? 'success' : 'danger'}>
                Status: {res.status}
              </Badge>
            {/if}
          </div>

          {#if res.kind !== 'Authorization' && res.body}
            <div class="small text-muted mb-1">Response Body:</div>
            <pre class="p-2 bg-white border rounded small mb-0 full-view text-secondary"><code>{formatBody(res.body)}</code></pre>
          {/if}

          {#if res.kind === 'Authorization'}
            <div class="p-2 bg-white border rounded small">
              <span class="text-muted small">Redirect processed.</span>
              <Badge color={res.stateValid ? 'success' : 'danger'} class="ms-2">
                State: {res.stateValid ? 'Valid' : 'Invalid'}
              </Badge>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </CardBody>
</Card>

<style>
  :global(.bg-indigo) { background-color: #6610f2 !important; }
  :global(.border-indigo) { border-color: #6610f2 !important; }
  :global(.text-indigo) { color: #6610f2 !important; }

  pre.full-view {
    white-space: pre-wrap;
    word-break: break-all;
    max-height: none !important;
    overflow: visible !important;
    height: auto !important;
    font-size: 0.8rem;
    color: #333;
  }
  
  .font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.75rem;
  }
</style>