export type Viewer = "chris" | "wife";

export const HOUSEHOLD_ID = "default-household";

// 角色判斷已集中到 src/lib/memberRoles.ts（resolveMemberRole），此處不再以 Email 判斷角色。

export function getSelfTarget(viewer: Viewer) {
  return viewer === "chris" ? "chris" : "wife";
}

export function getSpouseLabel(viewer: Viewer) {
  return viewer === "chris" ? "太太" : "先生";
}
