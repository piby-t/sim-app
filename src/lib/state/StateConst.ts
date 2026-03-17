/**
 * アプリケーション共通定数定義
 * UIコンポーネント間でのコンテキスト共有や、localStorage で使用するキー名を一括管理します。
 */

// --- コンテキスト識別子 (Svelte Context API 等で使用) ---
// サーバー設定の選択状態を識別するための名前
export const SERVER_CONTEXT_NAME = "server_select";
// クライアント設定の選択状態を識別するための名前
export const CLIENT_CONTEXT_NAME = "client_select";
// スコープ設定の選択状態を識別するための名前
export const SCOPE_CONTEXT_NAME = "scope_select";
// 認可エンドポイントURLの選択状態を識別するための名前
export const AUTH_URL_CONTEXT_NAME = "auth_url_select";

// --- ストレージ識別子 (localStorage 等で使用) ---
// サーバー選択状態をブラウザに保存する際のキー名
export const SERVER_STRAGE_NAME = "server_select";
// クライアント選択状態をブラウザに保存する際のキー名
export const CLIENT_STRAGE_NAME = "client_select";
// スコープ選択状態をブラウザに保存する際のキー名
export const SCOPE_STRAGE_NAME = "scope_select";
// 認可エンドポイントURL選択状態をブラウザに保存する際のキー名
export const AUTH_URL_STRAGE_NAME = "auth_url_select";