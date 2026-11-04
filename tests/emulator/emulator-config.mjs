export const EMULATOR_PROJECT_ID = "demo-household-expense";
export const EMULATOR_HOST = "127.0.0.1";
export const AUTH_EMULATOR_PORT = 9099;
export const FIRESTORE_EMULATOR_PORT = 8080;
export const TEST_HOUSEHOLD_ID = "default-household";

function isLoopback(host) {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

export function assertSafeEmulatorTarget({
  projectId = EMULATOR_PROJECT_ID,
  authHost = EMULATOR_HOST,
  authPort = AUTH_EMULATOR_PORT,
  firestoreHost = EMULATOR_HOST,
  firestorePort = FIRESTORE_EMULATOR_PORT,
} = {}) {
  if (projectId !== EMULATOR_PROJECT_ID || !projectId.startsWith("demo-")) {
    throw new Error(`Refusing non-demo Firebase project: ${projectId}`);
  }
  if (!isLoopback(authHost) || Number(authPort) !== AUTH_EMULATOR_PORT) {
    throw new Error(`Refusing unsafe Auth Emulator target: ${authHost}:${authPort}`);
  }
  if (!isLoopback(firestoreHost) || Number(firestorePort) !== FIRESTORE_EMULATOR_PORT) {
    throw new Error(`Refusing unsafe Firestore Emulator target: ${firestoreHost}:${firestorePort}`);
  }
}

export function emulatorUrl(service, path = "") {
  assertSafeEmulatorTarget();
  const port = service === "auth" ? AUTH_EMULATOR_PORT : FIRESTORE_EMULATOR_PORT;
  return `http://${EMULATOR_HOST}:${port}${path}`;
}
