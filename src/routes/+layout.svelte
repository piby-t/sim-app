<script lang="ts">
  /**
   * アプリケーション・ルートレイアウト (Svelte 5 / SvelteKit 最新準拠)
   * 修正：deprecated な base を廃止し、型安全な resolve() を導入
   */
  import favicon from "$lib/assets/favicon.svg";
  import { onMount, setContext } from "svelte";
  import { resolve } from "$app/paths"; // base の代わりに resolve を使用
  import { Container, Button, Row, Col } from "@sveltestrap/sveltestrap";
  import "bootstrap/dist/css/bootstrap.min.css";

  // ステート管理用のインポート
  import { SelectArrayText2State } from "$lib/state/SelectArrayText2State.svelte";
  import { SelectArrayCheckState } from "$lib/state/SelectArrayCheckState.svelte";
  import { SelectTextState } from "$lib/state/SelectTextState.svelte";
  import {
    SERVER_CONTEXT_NAME,
    CLIENT_CONTEXT_NAME,
    SCOPE_CONTEXT_NAME,
    AUTH_URL_CONTEXT_NAME,
    SERVER_STRAGE_NAME,
    CLIENT_STRAGE_NAME,
    SCOPE_STRAGE_NAME,
    AUTH_URL_STRAGE_NAME,
  } from "$lib/state/StateConst";

  let { children } = $props();

  // Context / 永続化ステートの初期化
  const serverSelect = new SelectArrayText2State(SERVER_STRAGE_NAME);
  const clientSelect = new SelectArrayText2State(CLIENT_STRAGE_NAME);
  const scopeSelect = new SelectArrayCheckState(SCOPE_STRAGE_NAME);
  const authUrlSelect = new SelectTextState(AUTH_URL_STRAGE_NAME);

  setContext(SERVER_CONTEXT_NAME, serverSelect);
  setContext(CLIENT_CONTEXT_NAME, clientSelect);
  setContext(SCOPE_CONTEXT_NAME, scopeSelect);
  setContext(AUTH_URL_CONTEXT_NAME, authUrlSelect);

  // メニュー制御ロジック
  let isMenuOpen = $state(false);
  const toggleMenu = () => {
    isMenuOpen = !isMenuOpen;
  };
  const closeMenu = () => {
    isMenuOpen = false;
  };

  $effect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";
  });

  // 時計のロジック
  let now = $state(new Date());
  onMount(() => {
    const interval = setInterval(() => {
      now = new Date();
    }, 1000);
    return () => clearInterval(interval);
  });

  const timeString = $derived(
    now.getFullYear() +
      "/" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "/" +
      String(now.getDate()).padStart(2, "0") +
      " " +
      String(now.getHours()).padStart(2, "0") +
      ":" +
      String(now.getMinutes()).padStart(2, "0") +
      ":" +
      String(now.getSeconds()).padStart(2, "0"),
  );
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="app-wrapper">
  <header class="main-header shadow-sm bg-dark text-white">
    <Container
      fluid
      class="d-flex align-items-center justify-content-between h-100"
    >
      <div class="d-flex align-items-center">
        <Button
          color="primary"
          size="sm"
          class="me-3 fw-bold shadow-sm"
          onclick={toggleMenu}
        >
          {isMenuOpen ? "閉じる ×" : "MENU ☰"}
        </Button>
        <a
          href={resolve("/")}
          class="text-white text-decoration-none d-flex align-items-center"
          onclick={closeMenu}
        >
          <img src={favicon} alt="logo" width="20" class="me-2" />
          <span class="fw-bold d-none d-sm-inline">ID Simulator</span>
        </a>
      </div>

      <div class="font-monospace small clock-area">
        {timeString}
      </div>
    </Container>
  </header>

  {#if isMenuOpen}
    <div
      class="menu-overlay"
      onclick={closeMenu}
      onkeydown={(e) => (e.key === "Enter" || e.key === " ") && closeMenu()}
      role="button"
      tabindex="0"
      aria-label="メニューを閉じる"
    >
      <div
        class="menu-content"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
        role="presentation"
      >
        <Container class="py-5">
          <Row>
            <Col md="4" class="mb-5">
              <h6 class="text-primary fw-bold border-bottom pb-2 mb-3">
                OAuth / OIDC
              </h6>
              <ul class="list-unstyled menu-list">
                <li>
                  <a href={resolve("/oauth/authorization")} onclick={closeMenu}
                    >Authorization Request</a
                  >
                </li>
                <li>
                  <a href={resolve("/oauth/api")} onclick={closeMenu}
                    >API Execution</a
                  >
                </li>
                <li>
                  <a
                    href={resolve("/oauth/clientcredentials")}
                    onclick={closeMenu}>Client Credentials</a
                  >
                </li>
              </ul>
            </Col>

            <Col md="4" class="mb-5">
              <h6 class="text-success fw-bold border-bottom pb-2 mb-3">
                FIDO / Passkeys
              </h6>
              <ul class="list-unstyled menu-list">
                <li>
                  <a href={resolve("/fido/key_challenge")} onclick={closeMenu}
                    >Key Challenge & Generation</a
                  >
                </li>
                <li>
                  <a href={resolve("/fido/key_gen")} onclick={closeMenu}
                    >Key Registration</a
                  >
                </li>
                <li>
                  <a href={resolve("/fido/key_gen")} onclick={closeMenu}
                    >Auth Challenge</a
                  >
                </li>
                <li>
                  <a href={resolve("/fido/auth_gen")} onclick={closeMenu}
                    >Auth Verification</a
                  >
                </li>
              </ul>
            </Col>

            <Col md="4" class="mb-5">
              <h6 class="text-primary fw-bold border-bottom pb-2 mb-3">
                Common
              </h6>
              <ul class="list-unstyled menu-list">
                <li>
                  <a href={resolve("/comn/history")} onclick={closeMenu}
                    >Execution History</a
                  >
                </li>
              </ul>
            </Col>

            <Col md="4" class="mb-5">
              <h6 class="text-warning fw-bold border-bottom pb-2 mb-3">
                Tools & Utils
              </h6>
              <ul class="list-unstyled menu-list">
                <li>
                  <a href={resolve("/tools/jsonformatter")} onclick={closeMenu}
                    >JSON Formatter</a
                  >
                </li>
                <li>
                  <a href={resolve("/tools/memo")} onclick={closeMenu}
                    >Quick Memo</a
                  >
                </li>
              </ul>
            </Col>
          </Row>
        </Container>
      </div>
    </div>
  {/if}

  <main class="main-body">
    {@render children()}
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #f8f9fa;
  }
  .app-wrapper {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  } /* height を min-height に変更 */
  .main-header {
    height: 50px;
    flex-shrink: 0;
    z-index: 2001;
    position: sticky;
    top: 0;
  } /* スクロールしても上部に固定されるように変更 */
  .main-body {
    flex: 1;
    width: 100%;
  } /* overflow-y: auto を削除 */
  .menu-overlay {
    position: fixed;
    top: 50px;
    left: 0;
    width: 100%;
    height: calc(100% - 50px);
    background-color: rgba(0, 0, 0, 0.4);
    z-index: 2000;
    overflow-y: auto;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    outline: none;
  }
  .menu-content {
    width: 100%;
    min-height: 100%;
    background-color: white;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    animation: slideDown 0.15s ease-out;
  }
  @keyframes slideDown {
    from {
      transform: translateY(-10px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  .menu-list a {
    text-decoration: none;
    color: #333;
    font-size: 1.1rem;
    display: block;
    padding: 0.6rem 1rem;
    border-radius: 6px;
    transition: all 0.2s;
  }
  .menu-list a:hover {
    background-color: #f0f4ff;
    color: #0d6efd;
    padding-left: 1.5rem;
  }
</style>
