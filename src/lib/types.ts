/**
 * ネスト可能な JSON 構造を厳密に定義 (Unexpected any 対策)
 */
export type JsonValue = 
  | string 
  | number 
  | boolean 
  | null 
  | { [key: string]: JsonValue } 
  | JsonValue[];

/**
 * 基本的な名前と値のペア
 */
export type NameValue = {
  name: string;
  value: string;
  description?: string;
};

/**
 * API実行定義
 */
export type ApiDefinition = {
  group: string;
  display: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers: NameValue[];
  queries: NameValue[];
  /**
   * リクエストボディ (Record<string, JsonValue> で any を回避)
   */
  body: string | NameValue[] | Record<string, JsonValue> | null;
  fileName?: string;
  isUrlEncoded?: boolean;
};

/**
 * テキスト配列選択コンポーネント用プロパティ
 */
export type SelectArrayText2Props = {
  label: string;
  items: NameValue[];
};

/**
 * チェックボックス状態を持つ名前と値のペア
 */
export type CheckNameValue = {
  name: string;
  value: string;
  checked?: boolean;
}

/**
 * チェックボックスリスト選択コンポーネント用プロパティ
 */
export type SelectArrayCheckProps = {
  label: string
  items: CheckNameValue[];
}

/**
 * 実行されたリクエストの型定義
 */
export type SimReq =
  | { kind: "Authorization"; url: string; } 
  | { 
      kind: "API" | "Display"; 
      method: string; 
      url: string; 
      header: NameValue[]; 
      body: string | NameValue[] | Record<string, JsonValue> | null 
    };

/**
 * 通信結果（レスポンス）の型定義
 */
export type SimRes =
  | { kind: "Authorization"; url: string; stateValid: boolean }
  | { kind: "API" | "TOKEN"; status: number; header: NameValue[]; body: string; accessToken?: string; refreshToken?: string }
  | { kind: "OIDC"; status: number; header: NameValue[]; body: string; accessToken: string; refreshToken: string; idToken: string; idTokenDecoded: string; idTokenHeader: string; idTokenPayload: string; idTokensignature: string; idTokenValid: boolean }
  | { kind: "FIDO"; status: number; header: NameValue[]; body: string; };

/**
 * セッションコンテキスト(SessionContext)で保持するキーの型
 * ※ allowCredentials は手動選択の柔軟性を優先して削除済み
 */
export type SesKeyType = 
  | 'code' 
  | 'accessToken' 
  | 'idToken' 
  | 'refreshToken'
  | 'challenge'
  | 'rpId'
  | 'userId'
  | 'userName'
  | 'displayName'
  | 'origin';

// --- FIDO 関連型定義 ---

export interface FidoFlags {
  up: boolean;
  uv: boolean;
  be: boolean;
  bs: boolean;
  at: boolean;
  ed: boolean; // 👈 追加: Extension Data
}

export interface FidoProfile {
  aaguid: string;
  supportedAlgorithms: number[];
  authenticatorAttachment: string;
  uvInitialized: boolean;
  defaultFlags: FidoFlags;
  hash?: string;
  origin?: string;
}

export interface KeyMasterConfig {
  activeProfile: "ios" | "android";
  ios: FidoProfile;
  android: FidoProfile;
}

export interface CredentialRecord {
  credentialId: string;
  rpId: string;
  userId: string;
  userName: string;
  displayName: string;
  privateKeyJwk: JsonWebKey;
  publicKeyJwk: JsonWebKey;
  signCount: number;
  backupEligibility: boolean;
  backupState: boolean;
  flags: FidoFlags; // 👈 追加: マスタのフラグを完全保持
  createdAt: number;
  lastUsedAt: number | null;
}