import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { seedFirebaseEmulators } from "../../scripts/seed-firebase-emulator.mjs";
import {
  EMULATOR_HOST,
  EMULATOR_PROJECT_ID,
  FIRESTORE_EMULATOR_PORT,
  TEST_HOUSEHOLD_ID,
  assertSafeEmulatorTarget,
} from "./emulator-config.mjs";

// These tests pin the production-compatible behavior of the deployed Rules
// (Git 965c4c3 + R1). They must not encode the undeployed af1282f restriction.

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDirectory, "../..");
const householdPath = `households/${TEST_HOUSEHOLD_ID}`;
let testEnvironment;
let users;

before(async () => {
  assertSafeEmulatorTarget();
  users = await seedFirebaseEmulators();
  const rules = await readFile(resolve(projectRoot, "firebase/firestore.rules"), "utf8");
  testEnvironment = await initializeTestEnvironment({
    projectId: EMULATOR_PROJECT_ID,
    firestore: {
      host: EMULATOR_HOST,
      port: FIRESTORE_EMULATOR_PORT,
      rules,
    },
  });
});

after(async () => {
  await testEnvironment?.cleanup();
});

function dbFor(uid) {
  return testEnvironment.authenticatedContext(uid).firestore();
}

function memberDb() {
  return dbFor(users.member.uid);
}

function partnerDb() {
  return dbFor(users.partner.uid);
}

function outsiderDb() {
  return dbFor(users.outsider.uid);
}

async function writeWithoutRules(path, data) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

async function readWithoutRules(path) {
  let data;
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDoc(doc(context.firestore(), path));
    data = snapshot.exists() ? snapshot.data() : undefined;
  });
  return data;
}

// Mirrors upsertRecurringExpenseTemplate() in src/lib/records.ts.
async function upsertTemplateLikeApp(db, input) {
  const { id, ...template } = input;
  const docRef = doc(db, `${householdPath}/recurringExpenses/${id}`);
  const snapshot = await getDoc(docRef);
  const data = snapshot.exists()
    ? { ...template, householdId: TEST_HOUSEHOLD_ID, updatedAt: serverTimestamp() }
    : { ...template, householdId: TEST_HOUSEHOLD_ID, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await setDoc(docRef, data, { merge: true });
}

const template = {
  id: "compat-subscription",
  name: "訂閱：Fictional Service",
  category: "訂閱",
  amount: 300,
  target: "self",
  paymentMethod: "信用卡",
  creditCard: "國泰",
  visibleFor: ["chris"],
};

test("compat: recurring template full app flow (create, re-save by partner, list, delete)", async () => {
  const path = `${householdPath}/recurringExpenses/${template.id}`;
  assert.equal(await readWithoutRules(path), undefined);

  await assertSucceeds(upsertTemplateLikeApp(memberDb(), { ...template, createdBy: users.member.uid }));
  const created = await readWithoutRules(path);
  assert.equal(created.amount, 300);
  assert.equal(created.householdId, TEST_HOUSEHOLD_ID);
  assert.ok(created.createdAt, "createdAt is set on first save");

  await assertSucceeds(upsertTemplateLikeApp(partnerDb(), { ...template, amount: 330, createdBy: users.partner.uid }));
  const updated = await readWithoutRules(path);
  assert.equal(updated.amount, 330);
  assert.equal(updated.createdBy, users.partner.uid);
  assert.deepEqual(updated.createdAt, created.createdAt, "merge update keeps createdAt");

  const listed = await assertSucceeds(getDocs(query(
    collection(memberDb(), `${householdPath}/recurringExpenses`),
    where("householdId", "==", TEST_HOUSEHOLD_ID),
  )));
  assert.ok(listed.docs.some((snapshot) => snapshot.id === template.id));

  await assertSucceeds(deleteDoc(doc(memberDb(), path)));
  assert.equal(await readWithoutRules(path), undefined);
});

test("compat: non-members cannot run the recurring template flow", async () => {
  await assertFails(upsertTemplateLikeApp(outsiderDb(), { ...template, id: "outsider-template", createdBy: users.outsider.uid }));
  assert.equal(await readWithoutRules(`${householdPath}/recurringExpenses/outsider-template`), undefined);
});

test("compat: legacy record without householdId stays readable by members only", async () => {
  const path = `${householdPath}/expenses/legacy-no-household`;
  await writeWithoutRules(path, {
    date: "2026-06-01",
    amount: 150,
    category: "餐飲",
    target: "chris",
    paidBy: "chris",
    paymentMethod: "cash",
    isPrivate: false,
    createdBy: "legacy-user",
  });

  const snapshot = await assertSucceeds(getDoc(doc(memberDb(), path)));
  assert.equal(snapshot.data().amount, 150);
  assert.equal(snapshot.data().householdId, undefined);
  await assertFails(getDoc(doc(outsiderDb(), path)));

  // App list queries filter by householdId, so legacy records were already excluded before R1.
  const listed = await assertSucceeds(getDocs(query(
    collection(memberDb(), `${householdPath}/expenses`),
    where("householdId", "==", TEST_HOUSEHOLD_ID),
  )));
  assert.equal(listed.docs.some((snapshot) => snapshot.id === "legacy-no-household"), false);
});

test("compat: legacy record update requires householdId in the resulting document", async () => {
  const path = `${householdPath}/expenses/legacy-no-household`;
  await assertFails(updateDoc(doc(memberDb(), path), { amount: 160 }));
  assert.equal((await readWithoutRules(path)).amount, 150);

  await assertSucceeds(updateDoc(doc(memberDb(), path), { amount: 170, householdId: TEST_HOUSEHOLD_ID }));
  const updated = await readWithoutRules(path);
  assert.equal(updated.amount, 170);
  assert.equal(updated.householdId, TEST_HOUSEHOLD_ID);

  await assertFails(updateDoc(doc(outsiderDb(), path), { amount: 1, householdId: TEST_HOUSEHOLD_ID }));
});

test("compat: legacy record without householdId can be deleted by members, not outsiders", async () => {
  const path = `${householdPath}/incomes/legacy-income-no-household`;
  await writeWithoutRules(path, {
    date: "2026-06-05",
    amount: 48000,
    owner: "chris",
    category: "年終",
    createdBy: "legacy-user",
  });

  await assertFails(deleteDoc(doc(outsiderDb(), path)));
  assert.ok(await readWithoutRules(path));
  await assertSucceeds(deleteDoc(doc(partnerDb(), path)));
  assert.equal(await readWithoutRules(path), undefined);
});

test("compat: reading a missing income or expense returns not-found for members only", async () => {
  for (const collectionName of ["incomes", "expenses"]) {
    const path = `${householdPath}/${collectionName}/does-not-exist`;
    const snapshot = await assertSucceeds(getDoc(doc(memberDb(), path)));
    assert.equal(snapshot.exists(), false);
    await assertFails(getDoc(doc(outsiderDb(), path)));
    await assertFails(getDoc(doc(testEnvironment.unauthenticatedContext().firestore(), path)));
  }
});
