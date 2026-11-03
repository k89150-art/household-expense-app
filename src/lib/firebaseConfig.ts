/**
 * Firebase 環境設定驗證（P1 建立，P3-C1 接入 `src/lib/firebase.ts`）。
 *
 * - 不初始化 Firebase、不呼叫任何 Firebase SDK、不連線、不讀取正式資料。
 * - 只接收呼叫端明確傳入的設定值；缺少或不合法時一律丟出 FirebaseConfigError，
 *   絕不自動改用正式 Firebase 設定。
 * - 本檔不得包含任何 API Key 或憑證；正式 Project ID 不是機密，用於比對防誤連。
 *
 * Next.js 只會在原始碼「逐字寫出」`process.env.NEXT_PUBLIC_XXX`
 * 時把值內嵌到瀏覽器程式，因此呼叫端必須逐一寫出這些環境變數再傳入本函式，
 * 不可用動態 key 讀取 `process.env`。
 */

export const PRODUCTION_FIREBASE_PROJECT_ID = "household-expense-app-8102d";
export const DEVELOPMENT_FIREBASE_PROJECT_ID = "household-expense-dev";
export const EMULATOR_FIREBASE_PROJECT_ID = "demo-household-expense";
export const EMULATOR_HOST = "127.0.0.1";
export const AUTH_EMULATOR_PORT = 9099;
export const FIRESTORE_EMULATOR_PORT = 8080;

export const APP_ENVS = ["production", "preview", "development", "emulator"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/** 對應的環境變數名稱（僅供文件與檢查腳本參考，本函式不直接讀取 process.env）。 */
export const FIREBASE_ENV_VARIABLES = {
  appEnv: "NEXT_PUBLIC_APP_ENV",
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
  emulatorHost: "NEXT_PUBLIC_FIREBASE_EMULATOR_HOST",
} as const;

const REQUIRED_FIREBASE_FIELDS = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
] as const;
type RequiredFirebaseField = (typeof REQUIRED_FIREBASE_FIELDS)[number];

export type FirebaseConfigErrorCode =
  | "UNKNOWN_APP_ENV"
  | "MISSING_FIELD"
  | "INVALID_VALUE"
  | "PRODUCTION_PROJECT_MISMATCH"
  | "DEVELOPMENT_PROJECT_MISMATCH"
  | "PREVIEW_PROJECT_MISMATCH"
  | "PRODUCTION_PROJECT_FORBIDDEN"
  | "DEMO_PROJECT_OUTSIDE_EMULATOR"
  | "EMULATOR_PROJECT_NOT_DEMO"
  | "EMULATOR_HOST_REQUIRED"
  | "EMULATOR_HOST_NOT_LOOPBACK"
  | "EMULATOR_HOST_UNEXPECTED"
  | "DOMAIN_PROJECT_MISMATCH"
  | "EXISTING_APP_COUNT_UNEXPECTED"
  | "EXISTING_APP_FIELD_MISSING"
  | "EXISTING_APP_CONFIG_MISMATCH";

export class FirebaseConfigError extends Error {
  readonly code: FirebaseConfigErrorCode;

  constructor(code: FirebaseConfigErrorCode, message: string) {
    super(`[firebase-config:${code}] ${message}`);
    this.name = "FirebaseConfigError";
    this.code = code;
  }
}

/** 呼叫端提供的原始設定；值可能缺少，由本函式負責拒絕。 */
export interface FirebaseEnvInput {
  appEnv?: string | null;
  apiKey?: string | null;
  authDomain?: string | null;
  projectId?: string | null;
  storageBucket?: string | null;
  messagingSenderId?: string | null;
  appId?: string | null;
  emulatorHost?: string | null;
}

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface FirebaseEmulatorTarget {
  host: typeof EMULATOR_HOST;
  authPort: number;
  firestorePort: number;
}

export interface ResolvedFirebaseConfig {
  appEnv: AppEnv;
  isProduction: boolean;
  firebase: FirebaseWebConfig;
  emulator: FirebaseEmulatorTarget | null;
}

export interface FirebaseAppLike {
  options: Partial<FirebaseWebConfig>;
}

function isAppEnv(value: string): value is AppEnv {
  return (APP_ENVS as readonly string[]).includes(value);
}

function requireText(name: string, value: string | null | undefined): string {
  if (value === undefined || value === null) {
    throw new FirebaseConfigError("MISSING_FIELD", `缺少必要設定 ${name}`);
  }
  if (typeof value !== "string") {
    throw new FirebaseConfigError("INVALID_VALUE", `${name} 必須是字串`);
  }
  if (value.trim() === "") {
    throw new FirebaseConfigError("MISSING_FIELD", `必要設定 ${name} 是空字串`);
  }
  if (value !== value.trim() || /\s/.test(value)) {
    throw new FirebaseConfigError("INVALID_VALUE", `${name} 不可包含空白字元`);
  }
  return value;
}

/** authDomain／storageBucket 若是 Firebase 預設網域，前綴必須等於 projectId，避免混用不同專案的設定。 */
function assertDomainMatchesProject(field: string, value: string, projectId: string, suffixes: readonly string[]) {
  for (const suffix of suffixes) {
    if (value.endsWith(suffix)) {
      const prefix = value.slice(0, -suffix.length);
      if (prefix !== projectId) {
        throw new FirebaseConfigError(
          "DOMAIN_PROJECT_MISMATCH",
          `${field} (${value}) 不屬於 projectId ${projectId}`,
        );
      }
    }
  }
}

function mentionsProductionProject(value: string): boolean {
  return value.includes(PRODUCTION_FIREBASE_PROJECT_ID);
}

export function resolveFirebaseConfig(input: FirebaseEnvInput): ResolvedFirebaseConfig {
  if (input === null || typeof input !== "object") {
    throw new FirebaseConfigError("MISSING_FIELD", "未提供 Firebase 環境設定");
  }

  const appEnvRaw = requireText("appEnv", input.appEnv);
  if (!isAppEnv(appEnvRaw)) {
    throw new FirebaseConfigError("UNKNOWN_APP_ENV", `未知的 appEnv：${appEnvRaw}（允許：${APP_ENVS.join(", ")}）`);
  }
  const appEnv: AppEnv = appEnvRaw;

  const values = {} as Record<RequiredFirebaseField, string>;
  for (const field of REQUIRED_FIREBASE_FIELDS) {
    values[field] = requireText(field, input[field]);
  }
  const firebase: FirebaseWebConfig = {
    apiKey: values.apiKey,
    authDomain: values.authDomain,
    projectId: values.projectId,
    storageBucket: values.storageBucket,
    messagingSenderId: values.messagingSenderId,
    appId: values.appId,
  };

  assertDomainMatchesProject("authDomain", firebase.authDomain, firebase.projectId, [".firebaseapp.com", ".web.app"]);
  assertDomainMatchesProject("storageBucket", firebase.storageBucket, firebase.projectId, [".firebasestorage.app", ".appspot.com"]);

  const emulatorHostRaw = input.emulatorHost;
  const hasEmulatorHost = !(emulatorHostRaw === undefined || emulatorHostRaw === null || emulatorHostRaw === "");

  if (appEnv === "production") {
    if (firebase.projectId !== PRODUCTION_FIREBASE_PROJECT_ID) {
      throw new FirebaseConfigError(
        "PRODUCTION_PROJECT_MISMATCH",
        `production 必須使用 ${PRODUCTION_FIREBASE_PROJECT_ID}，實際為 ${firebase.projectId}`,
      );
    }
    if (hasEmulatorHost) {
      throw new FirebaseConfigError("EMULATOR_HOST_UNEXPECTED", "production 不可設定 Emulator 連線");
    }
    return Object.freeze({ appEnv, isProduction: true, firebase: Object.freeze(firebase), emulator: null });
  }

  // 非 production：任何欄位都不得指向正式專案
  for (const field of REQUIRED_FIREBASE_FIELDS) {
    if (mentionsProductionProject(firebase[field])) {
      throw new FirebaseConfigError(
        "PRODUCTION_PROJECT_FORBIDDEN",
        `${appEnv} 不可使用正式 Firebase（${field} 指向 ${PRODUCTION_FIREBASE_PROJECT_ID}）`,
      );
    }
  }

  if (appEnv === "emulator") {
    if (firebase.projectId !== EMULATOR_FIREBASE_PROJECT_ID) {
      throw new FirebaseConfigError(
        "EMULATOR_PROJECT_NOT_DEMO",
        `emulator 的 projectId 必須是 ${EMULATOR_FIREBASE_PROJECT_ID}，實際為 ${firebase.projectId}`,
      );
    }
    if (!hasEmulatorHost) {
      throw new FirebaseConfigError("EMULATOR_HOST_REQUIRED", `emulator 必須明確設定 emulatorHost=${EMULATOR_HOST}`);
    }
    if (emulatorHostRaw !== EMULATOR_HOST) {
      throw new FirebaseConfigError(
        "EMULATOR_HOST_NOT_LOOPBACK",
        `emulatorHost 只能是 ${EMULATOR_HOST}，實際為 ${String(emulatorHostRaw)}`,
      );
    }
    return Object.freeze({
      appEnv,
      isProduction: false,
      firebase: Object.freeze(firebase),
      emulator: Object.freeze({ host: EMULATOR_HOST, authPort: AUTH_EMULATOR_PORT, firestorePort: FIRESTORE_EMULATOR_PORT }),
    });
  }

  // preview／development：目前都只允許明確指定的雲端開發專案。
  if (firebase.projectId === EMULATOR_FIREBASE_PROJECT_ID) {
    throw new FirebaseConfigError("DEMO_PROJECT_OUTSIDE_EMULATOR", `${appEnv} 不可使用 Emulator 專案`);
  }
  if (hasEmulatorHost) {
    throw new FirebaseConfigError("EMULATOR_HOST_UNEXPECTED", `${appEnv} 不可設定 Emulator 連線`);
  }
  if (appEnv === "development" && firebase.projectId !== DEVELOPMENT_FIREBASE_PROJECT_ID) {
    throw new FirebaseConfigError(
      "DEVELOPMENT_PROJECT_MISMATCH",
      `development 必須使用 ${DEVELOPMENT_FIREBASE_PROJECT_ID}，實際為 ${firebase.projectId}`,
    );
  }
  if (appEnv === "preview" && firebase.projectId !== DEVELOPMENT_FIREBASE_PROJECT_ID) {
    throw new FirebaseConfigError(
      "PREVIEW_PROJECT_MISMATCH",
      `preview 必須使用 ${DEVELOPMENT_FIREBASE_PROJECT_ID}，實際為 ${firebase.projectId}`,
    );
  }
  return Object.freeze({ appEnv, isProduction: false, firebase: Object.freeze(firebase), emulator: null });
}

/**
 * 驗證設定後才選用或建立 Firebase App。呼叫端將 SDK 函式以 callback 傳入，
 * 讓設定錯誤與既有 App 不一致時都能保證不呼叫 initializeApp。
 */
export function initializeValidatedFirebaseApp<T extends FirebaseAppLike>(
  input: FirebaseEnvInput,
  existingApps: readonly T[],
  initialize: (config: FirebaseWebConfig) => T,
): { resolved: ResolvedFirebaseConfig; app: T } {
  const resolved = resolveFirebaseConfig(input);

  if (existingApps.length > 1) {
    throw new FirebaseConfigError(
      "EXISTING_APP_COUNT_UNEXPECTED",
      `預期最多一個 Firebase App，實際為 ${existingApps.length}`,
    );
  }

  const existing = existingApps[0];
  if (!existing) return { resolved, app: initialize(resolved.firebase) };

  for (const field of REQUIRED_FIREBASE_FIELDS) {
    const existingValue = existing.options[field];
    if (typeof existingValue !== "string" || existingValue.trim() === "") {
      throw new FirebaseConfigError(
        "EXISTING_APP_FIELD_MISSING",
        `既有 Firebase App 缺少必要設定 ${field}，拒絕重用`,
      );
    }
    if (existingValue !== resolved.firebase[field]) {
      throw new FirebaseConfigError(
        "EXISTING_APP_CONFIG_MISMATCH",
        `既有 Firebase App 的 ${field} 與已驗證設定不一致，拒絕重用`,
      );
    }
  }
  return { resolved, app: existing };
}
