/**
 * 家庭成員角色判斷（P3-C3）：全專案唯一的角色判斷入口。
 *
 * - 純函式：不匯入 Firebase SDK、不讀取 process.env、不連線。呼叫端傳入已驗證的 appEnv
 *   （來自 src/lib/firebase.ts 的 resolveFirebaseConfig 結果）與登入使用者資訊。
 * - production：暫時沿用既有規則（指定 Email → chris，其餘 → wife），維持正式站相容；
 *   資料存取仍由 Firestore Rules 的 memberIds 限制。
 * - development／preview／emulator：只接受「UID → 角色」的明確對應；未對應的帳號一律拒絕，
 *   絕不預設為 wife，也不使用 Email 判斷。對應表由本機 .env.local（不進 Git）提供：
 *     NEXT_PUBLIC_DEV_MEMBER_ROLES=<開發專案 UID>:chris,<開發專案 UID>:wife
 */
import type { AppEnv } from "./firebaseConfig";
import type { Viewer } from "./household";

/** 正式站既有的角色規則（P3-C3 之前即存在於 page.tsx 與 household.ts，此處集中為唯一一處）。 */
const LEGACY_PRODUCTION_CHRIS_EMAIL = "k89150@gmail.com";

export const MEMBER_ROLES: readonly Viewer[] = Object.freeze(["chris", "wife"]);
const ROLE_SET: ReadonlySet<string> = new Set(MEMBER_ROLES);

/** Firebase Auth UID：英數字，長度 10–128（Google 登入產生的 UID 為 28 字元）。 */
const UID_PATTERN = /^[A-Za-z0-9]{10,128}$/;

export type MemberRoleErrorCode =
  | "UNKNOWN_APP_ENV"
  | "MISSING_UID"
  | "DEVELOPMENT_ROLE_MAP_MISSING"
  | "DEVELOPMENT_ROLE_MAP_INVALID"
  | "UNMAPPED_DEVELOPMENT_USER";

export type MemberRoleResolution =
  | { ok: true; viewer: Viewer; source: "production-legacy-email" | "development-uid-map" }
  | { ok: false; code: MemberRoleErrorCode; message: string };

export class DevelopmentRoleMapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DevelopmentRoleMapError";
  }
}

/**
 * 解析「uid:role,uid:role」。任何格式錯誤都丟出例外（不會部分接受）：
 * 空項目、缺冒號、多餘空白、UID 格式錯誤、未知角色、同一 UID 重複。
 */
export function parseDevelopmentRoleMap(raw: string): ReadonlyMap<string, Viewer> {
  const map = new Map<string, Viewer>();
  for (const entry of raw.split(",")) {
    if (entry === "" || entry !== entry.trim()) {
      throw new DevelopmentRoleMapError("對應表含空項目或多餘空白");
    }
    const parts = entry.split(":");
    if (parts.length !== 2) {
      throw new DevelopmentRoleMapError("每一項必須是 uid:role 格式");
    }
    const [uid, role] = parts;
    if (!UID_PATTERN.test(uid)) {
      throw new DevelopmentRoleMapError("UID 格式不正確");
    }
    if (!ROLE_SET.has(role)) {
      throw new DevelopmentRoleMapError(`未知角色：${role}（只允許 ${MEMBER_ROLES.join("、")}）`);
    }
    if (map.has(uid)) {
      throw new DevelopmentRoleMapError("同一個 UID 重複出現");
    }
    map.set(uid, role as Viewer);
  }
  return map;
}

export interface MemberRoleInput {
  appEnv: AppEnv | string | null | undefined;
  uid: string | null | undefined;
  email: string | null | undefined;
  /** 只在非 production 使用；production 一律忽略。 */
  developmentRoleMap: string | null | undefined;
}

export function resolveMemberRole(input: MemberRoleInput): MemberRoleResolution {
  const { appEnv, uid, email, developmentRoleMap } = input;

  if (appEnv === "production") {
    // 暫時維持正式站既有行為；不讀取開發對應表。
    return {
      ok: true,
      viewer: email === LEGACY_PRODUCTION_CHRIS_EMAIL ? "chris" : "wife",
      source: "production-legacy-email",
    };
  }

  if (appEnv !== "development" && appEnv !== "preview" && appEnv !== "emulator") {
    return { ok: false, code: "UNKNOWN_APP_ENV", message: "無法確認執行環境，拒絕判定角色" };
  }

  if (typeof uid !== "string" || uid === "") {
    return { ok: false, code: "MISSING_UID", message: "登入資訊缺少 UID，拒絕判定角色" };
  }

  if (typeof developmentRoleMap !== "string" || developmentRoleMap.trim() === "") {
    return {
      ok: false,
      code: "DEVELOPMENT_ROLE_MAP_MISSING",
      message: "尚未設定開發測試成員對應（NEXT_PUBLIC_DEV_MEMBER_ROLES），所有帳號一律拒絕",
    };
  }

  let map: ReadonlyMap<string, Viewer>;
  try {
    map = parseDevelopmentRoleMap(developmentRoleMap);
  } catch (error) {
    const detail = error instanceof DevelopmentRoleMapError ? error.message : "無法解析";
    return {
      ok: false,
      code: "DEVELOPMENT_ROLE_MAP_INVALID",
      message: `開發測試成員對應格式錯誤（${detail}），所有帳號一律拒絕`,
    };
  }

  const viewer = map.get(uid);
  if (!viewer) {
    return {
      ok: false,
      code: "UNMAPPED_DEVELOPMENT_USER",
      message: "此帳號不是已設定的開發測試成員，拒絕進入（不會自動判定為任何角色）",
    };
  }
  return { ok: true, viewer, source: "development-uid-map" };
}
