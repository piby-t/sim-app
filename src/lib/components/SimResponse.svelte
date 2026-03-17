<script lang="ts">
  /**
   * 受信レスポンス表示コンポーネント
   * 修正内容：ヘッダー表示の each キーを index に変更し、重複エラーを解消
   */
  import type { SimRes } from '$lib/types';
  import { Badge, Card, CardHeader, CardBody, Table } from '@sveltestrap/sveltestrap';
  import { formatJson } from '$lib/util/fmt-trans';

  // Props定義
  let { res }: { res: SimRes | undefined } = $props();

  /**
   * ヘッダーカラーの派生
   */
  let headerColor = $derived.by(() => {
    if (!res) return 'secondary';
    if (res.kind === 'Authorization' && !res.stateValid) return 'danger';
    if (res.kind === 'OIDC' && !res.idTokenValid) return 'warning';
    return 'success';
  });
</script>

<Card class="shadow-sm border-0 mb-3">
  <CardHeader class="bg-{headerColor} text-white py-2 d-flex align-items-center justify-content-between">
    <h6 class="mb-0">受信レスポンス</h6>
    {#if res}
      <Badge color="light" class="text-{headerColor}">{res.kind}</Badge>
    {/if}
  </CardHeader>
  
  <CardBody class="p-3">
    {#if !res}
      <div class="text-center py-5 text-muted small">応答待機中...</div>
    {:else}
      {#if res.kind === 'Authorization'}
        <div class="mb-3">
          <div class="small fw-bold text-muted mb-1">Callback URL:</div>
          <div class="p-2 bg-light border rounded small text-break font-monospace">{res.url}</div>
        </div>
        <div class="small">
          State Check: 
          <Badge color={res.stateValid ? 'success' : 'danger'}>
            {res.stateValid ? 'Valid' : 'Invalid'}
          </Badge>
        </div>

      {:else}
        <div class="mb-3 d-flex align-items-center gap-2 pb-2 border-bottom">
          <span class="small fw-bold text-muted">Status:</span>
          <Badge color={res.status < 300 ? 'success' : 'danger'}>{res.status}</Badge>
          
          {#if res.kind === 'OIDC'}
            <span class="ms-auto small fw-bold text-muted">Verify:</span>
            <Badge color={res.idTokenValid ? 'success' : 'danger'}>
              {res.idTokenValid ? 'Valid' : 'Invalid'}
            </Badge>
          {/if}
        </div>

        {#if res.header && res.header.length > 0}
          <div class="mb-3">
            <div class="small fw-bold text-muted mb-1">Response Headers:</div>
            <Table size="sm" class="mb-0 border bg-white" style="font-size: 0.7rem;">
              <tbody>
                {#each res.header as h, i (i)}
                  <tr>
                    <td class="bg-light fw-bold text-secondary" style="width: 30%;">{h.name}</td>
                    <td class="text-break">{h.value}</td>
                  </tr>
                {/each}
              </tbody>
            </Table>
          </div>
        {/if}

        <div class="mb-3">
          <div class="small fw-bold text-muted mb-1">Body:</div>
          <pre class="p-2 bg-light border rounded small full-pre-no-scroll">{formatJson(res.body)}</pre>
        </div>

        {#if res.kind === 'OIDC'}
          <div class="mt-4 pt-3 border-top">
            <div class="d-flex align-items-center mb-3">
               <div class="fw-bold text-primary border-start border-primary border-4 ps-2">ID Token Analysis</div>
               <Badge color={res.idTokenValid ? 'outline-success' : 'outline-danger'} class="ms-2">
                 {res.idTokenValid ? 'Signature Verified' : 'Verification Failed'}
               </Badge>
            </div>
            
            <div class="mb-2">
              <div class="small fw-bold text-muted mb-1">JOSE Header:</div>
              <pre class="jwt-part jwt-header">{formatJson(res.idTokenHeader)}</pre>
            </div>

            <div class="mb-2">
              <div class="small fw-bold text-muted mb-1">Payload:</div>
              <pre class="jwt-part jwt-payload">{formatJson(res.idTokenPayload)}</pre>
            </div>

            <div class="mb-0">
              <div class="small fw-bold text-muted mb-1">Signature:</div>
              <div class="p-2 bg-light border rounded small text-break font-monospace text-secondary signature-box">
                {res.idTokensignature}
              </div>
            </div>
          </div>
        {/if}
      {/if}
    {/if}
  </CardBody>
</Card>

<style>
  pre.full-pre-no-scroll {
    white-space: pre-wrap;
    word-break: break-all;
    max-height: none !important;
    overflow: visible !important;
    height: auto !important;
    font-size: 0.8rem;
  }
  .jwt-part { 
    padding: 0.75rem; 
    border-radius: 4px; 
    font-size: 0.75rem; 
    margin-bottom: 0.5rem; 
    border-left: 4px solid #dee2e6; 
  }
  .jwt-header { background-color: #fff4f4; border-color: #fb015b; color: #fb015b; }
  .jwt-payload { background-color: #f4faff; border-color: #00b9f1; color: #00b9f1; }
  .signature-box { font-size: 0.7rem; line-height: 1.2; }
</style>