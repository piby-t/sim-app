<script lang="ts">
  import { Container, Row, Col, Card, CardHeader, CardBody, Badge, Table, Button } from '@sveltestrap/sveltestrap';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import SimResponse from '$lib/components/SimResponse.svelte';
  import { formatJson } from '$lib/util/fmt-trans';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let record = $derived(data.record);
  let req = $derived(record?.req);
  let res = $derived(record?.res);

  type ParsedRow = { label: string; value: string };

  function decodeBase64UrlToUint8Array(base64Url: string): Uint8Array {
    try {
      const padding = '='.repeat((4 - base64Url.length % 4) % 4);
      const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    } catch {
      return new Uint8Array(0);
    }
  }

  function toHexString(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function parseClientDataJSONToTable(base64Url: string): ParsedRow[] | null {
    try {
      const bytes = decodeBase64UrlToUint8Array(base64Url);
      if (bytes.length === 0) return null;
      const jsonString = new TextDecoder().decode(bytes);
      const obj = JSON.parse(jsonString);
      
      return Object.entries(obj).map(([k, v]) => ({ label: k, value: String(v) }));
    } catch {
      return null;
    }
  }

  function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
    for (let i = 0; i <= haystack.length - needle.length; i++) {
      let found = true;
      for (let j = 0; j < needle.length; j++) {
        if (haystack[i + j] !== needle[j]) { found = false; break; }
      }
      if (found) return i;
    }
    return -1;
  }

  function parseAttestationObjectToTable(base64Url: string): ParsedRow[] | null {
    try {
      const bytes = decodeBase64UrlToUint8Array(base64Url);
      if (bytes.length === 0) return null;

      const rows: ParsedRow[] = [];

      if (indexOfBytes(bytes, new TextEncoder().encode("fmt")) !== -1) {
        rows.push({ label: "fmt", value: "none" });
      }

      const authDataKeywordBytes = new TextEncoder().encode("authData");
      const authDataIndex = indexOfBytes(bytes, authDataKeywordBytes);

      if (authDataIndex !== -1) {
        let offset = authDataIndex + authDataKeywordBytes.length;
        let authDataLength = 0;
        let authDataStart = 0;

        const head = bytes[offset];
        if (head >= 0x40 && head <= 0x57) {
          authDataLength = head - 0x40; authDataStart = offset + 1;
        } else if (head === 0x58) {
          authDataLength = bytes[offset + 1]; authDataStart = offset + 2;
        } else if (head === 0x59) {
          authDataLength = (bytes[offset + 1] << 8) | bytes[offset + 2]; authDataStart = offset + 3;
        }

        if (authDataStart > 0 && authDataStart + authDataLength <= bytes.length) {
          const authData = bytes.slice(authDataStart, authDataStart + authDataLength);
          
          if (authData.length >= 37) {
            rows.push({ label: "rpIdHash", value: toHexString(authData.slice(0, 32)) });

            const flags = authData[32];
            rows.push({ label: "flags (Raw)", value: `0x${flags.toString(16).padStart(2, '0')}` });
            rows.push({ label: " ↳ UP (User Present)", value: (flags & 0x01) ? "true (1)" : "false (0)" });
            rows.push({ label: " ↳ UV (User Verified)", value: (flags & 0x04) ? "true (1)" : "false (0)" });
            rows.push({ label: " ↳ BE (Backup Eligible)", value: (flags & 0x08) ? "true (1)" : "false (0)" });
            rows.push({ label: " ↳ BS (Backup State)", value: (flags & 0x10) ? "true (1)" : "false (0)" });
            rows.push({ label: " ↳ AT (Attested Cred. Data)", value: (flags & 0x40) ? "true (1)" : "false (0)" });
            rows.push({ label: " ↳ ED (Extension Data)", value: (flags & 0x80) ? "true (1)" : "false (0)" });

            const signCount = (authData[33] << 24) | (authData[34] << 16) | (authData[35] << 8) | authData[36];
            rows.push({ label: "signCount", value: String(signCount >>> 0) });

            if (flags & 0x40) {
              let adOffset = 37;
              if (adOffset + 16 <= authData.length) {
                const aaguid = authData.slice(adOffset, adOffset + 16);
                const aaguidStr = [
                  toHexString(aaguid.slice(0,4)), toHexString(aaguid.slice(4,6)),
                  toHexString(aaguid.slice(6,8)), toHexString(aaguid.slice(8,10)),
                  toHexString(aaguid.slice(10,16))
                ].join('-');
                rows.push({ label: "AAGUID", value: aaguidStr });
                adOffset += 16;

                if (adOffset + 2 <= authData.length) {
                  const credIdLen = (authData[adOffset] << 8) | authData[adOffset+1];
                  rows.push({ label: "credentialIdLength", value: String(credIdLen) });
                  adOffset += 2;

                  if (adOffset + credIdLen <= authData.length) {
                    const credId = authData.slice(adOffset, adOffset + credIdLen);
                    const credIdBase64Url = btoa(String.fromCharCode(...credId)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
                    rows.push({ label: "credentialId", value: credIdBase64Url });
                  }
                }
              }
            }
          }
        }
      }
      return rows.length > 0 ? rows : null;
    } catch {
      return null;
    }
  }

  let parsedBodyObj = $derived.by(() => {
    if (!req || !('body' in req) || !req.body) return null;
    try {
      return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      return null;
    }
  });

  let clientDataRows = $derived.by(() => {
    if (!parsedBodyObj) return null;
    const responseObj = (parsedBodyObj as Record<string, unknown>).response as Record<string, unknown> | undefined;
    const cdj = responseObj?.clientDataJSON as string | undefined;
    return cdj ? parseClientDataJSONToTable(cdj) : null;
  });

  let attestationRows = $derived.by(() => {
    if (!parsedBodyObj) return null;
    const responseObj = (parsedBodyObj as Record<string, unknown>).response as Record<string, unknown> | undefined;
    const att = responseObj?.attestationObject as string | undefined;
    return att ? parseAttestationObjectToTable(att) : null;
  });

</script>

<Container fluid class="mt-3 pb-5">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h4 class="mb-0 fw-bold"><i class="bi bi-check-circle-fill text-success me-2"></i>API 実行結果</h4>
    
    <Button color="indigo" class="fw-bold shadow-sm" onclick={() => {
      goto(resolve('/fido/auth_gen'));
    }}>
      Auth Challenge <i class="bi bi-arrow-right ms-1"></i>
    </Button>
  </div>

  {#if !record}
    <Card class="text-center p-5 bg-light shadow-sm border-0">
      <div class="text-muted"><i class="bi bi-cloud-slash fs-1 d-block mb-3 opacity-25"></i>直近の実行履歴が見つかりません。</div>
    </Card>
  {:else}
    <Row class="g-3">
      <Col lg="6">
        <Card class="shadow-sm border-0 mb-3 h-100">
          <CardHeader class="bg-dark text-white py-2 d-flex align-items-center justify-content-between">
            <h6 class="mb-0 small fw-bold"><i class="bi bi-send-fill me-2"></i>送信リクエスト</h6>
            {#if req && 'method' in req}<Badge color="primary">{req.method}</Badge>{/if}
          </CardHeader>
          <CardBody class="p-3 bg-light font-monospace">
            {#if !req}
              <div class="text-center py-5 text-muted small">リクエストデータがありません</div>
            {:else}
              <div class="mb-3">
                <div class="fw-bold small border-bottom mb-1 text-muted">Endpoint URL</div>
                <div class="text-primary text-break small" style="font-size: 0.8rem;">{req.url}</div>
              </div>

              {#if 'header' in req && req.header}
                <div class="mb-3">
                  <div class="fw-bold small border-bottom mb-1 text-muted">Headers</div>
                  <Table size="sm" class="bg-white border mb-0" style="table-layout: fixed; font-size: 0.75rem;">
                    <tbody>
                      {#each req.header as h (h.name)}
                        <tr><td class="fw-bold bg-light-subtle" style="width:35%">{h.name}</td><td class="text-break">{h.value}</td></tr>
                      {:else}
                        <tr><td colspan="2" class="text-center text-muted py-2">No Headers</td></tr>
                      {/each}
                    </tbody>
                  </Table>
                </div>
              {/if}

              {#if 'body' in req && req.body}
                <div class="mb-4">
                  <div class="fw-bold small border-bottom mb-1 text-muted">Raw Payload (Body)</div>
                  <pre class="bg-white p-2 border rounded small mb-0">{formatJson(typeof req.body === 'string' ? req.body : JSON.stringify(req.body))}</pre>
                </div>

                {#if clientDataRows || attestationRows}
                  <div class="p-3 bg-white border border-info rounded shadow-sm">
                    <h6 class="fw-bold text-info mb-3 border-bottom border-info pb-2 small">
                      <i class="bi bi-table me-1"></i> FIDO Payload Analysis
                    </h6>
                    
                    {#if clientDataRows}
                      <div class="mb-3">
                        <div class="fw-bold small mb-1 text-secondary">clientDataJSON (Decoded)</div>
                        <Table size="sm" bordered class="mb-0" style="table-layout: fixed; font-size: 0.75rem;">
                          <tbody>
                            {#each clientDataRows as row (row.label)}
                              <tr>
                                <td class="bg-light fw-bold" style="width: 35%;">{row.label}</td>
                                <td class="text-break">{row.value}</td>
                              </tr>
                            {/each}
                          </tbody>
                        </Table>
                      </div>
                    {/if}

                    {#if attestationRows}
                      <div>
                        <div class="fw-bold small mb-1 text-secondary">attestationObject (Parsed)</div>
                        <Table size="sm" bordered class="mb-0" style="table-layout: fixed; font-size: 0.75rem;">
                          <tbody>
                            {#each attestationRows as row (row.label)}
                              <tr>
                                <td class="bg-light fw-bold" style="width: 35%;">{row.label}</td>
                                <td class="text-break">
                                  <span class={row.value.includes('true') ? 'text-success fw-bold' : row.value.includes('false') ? 'text-muted' : ''}>
                                    {row.value}
                                  </span>
                                </td>
                              </tr>
                            {/each}
                          </tbody>
                        </Table>
                      </div>
                    {/if}
                  </div>
                {/if}
              {/if}
            {/if}
          </CardBody>
        </Card>
      </Col>

      <Col lg="6"><SimResponse {res} /></Col>
    </Row>
  {/if}
</Container>

<style>
  :global(.bg-indigo) { background-color: #6610f2 !important; }
  :global(.text-indigo) { color: #6610f2 !important; }
  :global(.btn-indigo) { background-color: #6610f2 !important; color: white !important; }
  :global(.btn-indigo:hover) { background-color: #520dc2 !important; color: white !important; }
  pre { white-space: pre-wrap; word-break: break-all; font-size: 0.75rem; line-height: 1.3; }
  .text-break { word-break: break-all; }
</style>