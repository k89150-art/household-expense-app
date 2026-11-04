/**
 * 家庭成員角色判斷：雙帳號 UID 白名單（全專案唯一的角色判斷入口）。
 *
 * - 本系統只有兩位使用者：chris 與 wife。所有環境（production／preview／development／emulator）
 *   一律以 Firebase Authentication UID 判斷，不使用 Email。
 * - 白名單由各環境自己的設定提供，不寫進程式、不進 Git：
 *     NEXT_PUBLIC_MEMBER_ROLES=<UID>:chris,<UID>:wife
 *   正式站設定在 Vercel Production 環境變數；開發環境設定在本機 .env.local。
 *   不同 Firebase 專案的 UID 不同，因此各環境必須使用自己專案的 UID。
 * - 白名單必須「剛好兩筆、一位 chris、一位 wife、UID 不重複」；未設定、格式錯誤、
 *   未登入或不在白名單的帳號一律拒絕，絕不預設為任何角色。
 * - 這裡只負責畫面角色；資料存取由 Firestore Rules（households/{id}.memberIds）在伺服器端強制。
 * - 純函式：不匯入 Firebase SDK、不讀取 process.env、不連線。
 */
import type { AppEnv } from "./firebaseConfig";
import type { Viewer } from "./household";

export const MEMBER_ROLES: readonly Viewer[] = Object.freeze(["chris", "wife"]);

/** Firebase Auth UID：英數字，長度 10–128（Google 登入產生的 UID 為 28 字元）。 */
const UID_PATTERN = /^[A-Za-z0-9]{10,128}$/;

export type MemberRoleErrorCode =
  | "UNKNOWN_APP_ENV"
  | "MISSING_UID"
  | "MEMBER_ROLE_MAP_MISSING"
  | "MEMBER_ROLE_MAP_INVALID"
  | "NOT_A_HOUSEHOLD_MEMBER";

export type MemberRoleResolution =
  | { ok: true; viewer: Viewer }
  | { ok: false; code: MemberRoleErrorCode; message: string };

export class MemberRoleMapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberRoleMapError";
  }
}

/**
 * 解析雙帳號白名單「uid:role,uid:role」。必須剛好兩筆：一位 chris、一位 wife，UID 不重複。
 * 任何格式錯誤都丟出例外（不會部分接受）。錯誤訊息不包含 UID。
 */
export function parseMemberRoleMap(raw: string): ReadonlyMap<string, Viewer> {
  const entries = raw.split(",");
  if (entries.length !== 2) {
    throw new MemberRoleMapError("白名單必須剛好兩筆（chris 與 wife）");
  }
  const map = new Map<string, Viewer>();
  for (const entry of entries) {
    if (entry === "" || entry !== entry.trim()) {
      throw new MemberRoleMapError("白名單含空項目或多餘空白");
    }
    const parts = entry.split(":");
    if (parts.length !== 2) {
      throw new MemberRoleMapError("每一筆必須是 uid:role 格式");
    }
    const [uid, role] = parts;
    if (!UID_PATTERN.test(uid)) {
      throw new MemberRoleMapError("UID 格式不正確");
    }
    if (role !== "chris" && role !== "wife") {
      throw new MemberRoleMapError(`未知角色（只允許 ${MEMBER_ROLES.join("、")}）`);
    }
    if (map.has(uid)) {
      throw new MemberRoleMapError("兩筆的 UID 不可相同");
    }
    if ([...map.values()].includes(role)) {
      throw new MemberRoleMapError("chris 與 wife 必須各一位");
    }
    map.set(uid, role);
  }
  return map;
}

export interface MemberRoleInput {
  /** 已通過 resolveFirebaseConfig 驗證的執行環境。 */
  appEnv: AppEnv | string | null | undefined;
  uid: string | null | undefined;
  /** NEXT_PUBLIC_MEMBER_ROLES 的值。 */
  memberRoleMap: string | null | undefined;
}

export function resolveMemberRole(input: MemberRoleInput): MemberRoleResolution {
  const { appEnv, uid, memberRoleMap } = input;

  if (appEnv !== "production" && appEnv !== "preview" && appEnv !== "development" && appEnv !== "emulator") {
    return { ok: false, code: "UNKNOWN_APP_ENV", message: "無法確認執行環境，拒絕進入" };
  }
  if (typeof uid !== "string" || uid === "") {
    return { ok: false, code: "MISSING_UID", message: "登入資訊缺少 UID，拒絕進入" };
  }
  if (typeof memberRoleMap !== "string" || memberRoleMap.trim() === "") {
    return {
      ok: false,
      code: "MEMBER_ROLE_MAP_MISSING",
      message: "尚未設定家庭成員白名單（NEXT_PUBLIC_MEMBER_ROLES），所有帳號一律拒絕",
    };
  }

  let map: ReadonlyMap<string, Viewer>;
  try {
    map = parseMemberRoleMap(memberRoleMap);
  } catch (error) {
    const detail = error instanceof MemberRoleMapError ? error.message : "無法解析";
    return { ok: false, code: "MEMBER_ROLE_MAP_INVALID", message: `家庭成員白名單設定錯誤（${detail}），所有帳號一律拒絕` };
  }

  const viewer = map.get(uid);
  if (!viewer) {
    return { ok: false, code: "NOT_A_HOUSEHOLD_MEMBER", message: "此帳號不是家庭成員，拒絕進入" };
  }
  return { ok: true, viewer };
}
