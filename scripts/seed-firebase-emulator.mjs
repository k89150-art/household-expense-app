import { pathToFileURL } from "node:url";
import { initializeApp, deleteApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  AUTH_EMULATOR_PORT,
  EMULATOR_HOST,
  EMULATOR_PROJECT_ID,
  FIRESTORE_EMULATOR_PORT,
  TEST_HOUSEHOLD_ID,
  assertSafeEmulatorTarget,
  emulatorUrl,
} from "../tests/emulator/emulator-config.mjs";

const TEST_PASSWORD = "local-emulator-only-2026";
const TEST_USERS = {
  member: "member.one@example.test",
  partner: "member.two@example.test",
  outsider: "outsider@example.test",
};

async function deleteEmulatorData() {
  assertSafeEmulatorTarget();
  const endpoints = [
    emulatorUrl("firestore", `/emulator/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`),
    emulatorUrl("auth", `/emulator/v1/projects/${EMULATOR_PROJECT_ID}/accounts`),
  ];
  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, { method: "DELETE" });
    if (!response.ok) {
      throw new Error(`Failed to clear Emulator data (${response.status}): ${endpoint}`);
    }
  }
}

async function createTestUser(auth, email) {
  const credential = await createUserWithEmailAndPassword(auth, email, TEST_PASSWORD);
  return { email, uid: credential.user.uid };
}

export async function seedFirebaseEmulators() {
  assertSafeEmulatorTarget();
  await deleteEmulatorData();

  const app = initializeApp({
    apiKey: "demo-api-key",
    authDomain: `${EMULATOR_PROJECT_ID}.localhost`,
    projectId: EMULATOR_PROJECT_ID,
  }, `emulator-seed-${Date.now()}`);

  try {
    const auth = getAuth(app);
    connectAuthEmulator(auth, emulatorUrl("auth"), { disableWarnings: true });

    const member = await createTestUser(auth, TEST_USERS.member);
    const partner = await createTestUser(auth, TEST_USERS.partner);
    const outsider = await createTestUser(auth, TEST_USERS.outsider);
    await signInWithEmailAndPassword(auth, TEST_USERS.member, TEST_PASSWORD);

    const db = getFirestore(app);
    connectFirestoreEmulator(db, EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
    const householdPath = `households/${TEST_HOUSEHOLD_ID}`;
    const common = { householdId: TEST_HOUSEHOLD_ID, createdBy: member.uid };

    await setDoc(doc(db, householdPath), {
      name: "Emulator Test Household",
      memberIds: [member.uid, partner.uid],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, `${householdPath}/incomes/seed-income`), {
      ...common,
      date: "2026-10-01",
      amount: 52000,
      owner: "chris",
      category: "本薪",
      note: "Fictional emulator income",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, `${householdPath}/expenses/seed-expense`), {
      ...common,
      date: "2026-10-02",
      amount: 180,
      category: "餐飲",
      target: "self",
      paidBy: "chris",
      paymentMethod: "現金",
      note: "Fictional emulator expense",
      isPrivate: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, `${householdPath}/recurringExpenses/seed-recurring`), {
      ...common,
      name: "Emulator Test Rent",
      category: "居家固定費",
      amount: 12000,
      target: "self",
      paymentMethod: "銀行扣款",
      visibleFor: ["chris", "wife"],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { member, partner, outsider };
  } finally {
    await deleteApp(app);
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  seedFirebaseEmulators()
    .then(({ member, partner, outsider }) => {
      console.log(JSON.stringify({
        projectId: EMULATOR_PROJECT_ID,
        auth: `${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`,
        firestore: `${EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}`,
        householdId: TEST_HOUSEHOLD_ID,
        users: {
          member: member.uid,
          partner: partner.uid,
          outsider: outsider.uid,
        },
      }, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
