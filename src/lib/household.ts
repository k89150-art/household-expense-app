export type Viewer = "chris" | "wife";

export const HOUSEHOLD_ID = "default-household";
export const CHRIS_EMAIL = "k89150@gmail.com";

export function getViewerByEmail(email?: string | null): Viewer {
  return email === CHRIS_EMAIL ? "chris" : "wife";
}

export function getSelfTarget(viewer: Viewer) {
  return viewer === "chris" ? "chris" : "wife";
}

export function getSpouseLabel(viewer: Viewer) {
  return viewer === "chris" ? "太太" : "先生";
}
