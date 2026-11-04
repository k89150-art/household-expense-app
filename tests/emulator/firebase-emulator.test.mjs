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

function memberDb() {
  return testEnvironment.authenticatedContext(users.member.uid).firestore();
}

function outsiderDb() {
  return testEnvironment.authenticatedContext(users.outsider.uid).firestore();
}

const baseIncome = {
  householdId: TEST_HOUSEHOLD_ID,
  date: "2026-10-10",
  amount: 3500,
  owner: "wife",
  category: "值班費",
  createdBy: "emulator-test",
};

const baseExpense = {
  householdId: TEST_HOUSEHOLD_ID,
  date: "2026-10-11",
  amount: 240,
  category: "文具",
  target: "self",
  paidBy: "chris",
  paymentMethod: "現金",
  isPrivate: false,
  createdBy: "emulator-test",
};

test("safety guard rejects non-demo projects and non-loopback hosts", () => {
  assert.throws(() => assertSafeEmulatorTarget({ projectId: "production-project" }));
  assert.throws(() => assertSafeEmulatorTarget({ firestoreHost: "firestore.googleapis.com" }));
  assert.throws(() => assertSafeEmulatorTarget({ authPort: 443 }));
});

test("firebase.json binds Auth and Firestore Emulators to loopback only", async () => {
  const config = JSON.parse(await readFile(resolve(projectRoot, "firebase.json"), "utf8"));
  assert.deepEqual(config.emulators.auth, { host: "127.0.0.1", port: 9099 });
  assert.deepEqual(config.emulators.firestore, { host: "127.0.0.1", port: 8080 });
  assert.deepEqual(config.emulators.ui, { enabled: false });
  assert.equal(config.emulators.singleProjectMode, true);
  assert.equal(config.firestore.rules, "firebase/firestore.rules");
  assert.equal(config.firestore.indexes, "firebase/firestore.indexes.json");
});

test("seed can be repeated without production credentials or existing data", async () => {
  users = await seedFirebaseEmulators();
  assert.match(users.member.uid, /\S+/);
  assert.match(users.partner.uid, /\S+/);
  assert.match(users.outsider.uid, /\S+/);
});

test("Authentication Emulator creates fictional member and outsider users", () => {
  assert.match(users.member.uid, /\S+/);
  assert.match(users.partner.uid, /\S+/);
  assert.match(users.outsider.uid, /\S+/);
  assert.notEqual(users.member.uid, users.outsider.uid);
});

test("seed creates the household membership and formal collection shapes", async () => {
  const db = memberDb();
  const household = await assertSucceeds(getDoc(doc(db, householdPath)));
  assert.deepEqual(household.data().memberIds, [users.member.uid, users.partner.uid]);
  assert.equal(household.data().memberIds.includes(users.outsider.uid), false);
  for (const path of [
    `${householdPath}/incomes/seed-income`,
    `${householdPath}/expenses/seed-expense`,
    `${householdPath}/recurringExpenses/seed-recurring`,
  ]) {
    const snapshot = await assertSucceeds(getDoc(doc(db, path)));
    assert.equal(snapshot.exists(), true);
    assert.equal(snapshot.data().householdId, TEST_HOUSEHOLD_ID);
  }
});

test("unauthenticated users cannot read the household", async () => {
  const db = testEnvironment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, householdPath)));
});

test("unauthenticated users cannot create records", async () => {
  const db = testEnvironment.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, `${householdPath}/incomes/anonymous`), baseIncome));
});

test("household members can read authorized records", async () => {
  const snapshot = await assertSucceeds(getDoc(doc(memberDb(), `${householdPath}/incomes/seed-income`)));
  assert.equal(snapshot.data().amount, 52000);
});

test("household members can query authorized income and expense collections", async () => {
  const db = memberDb();
  for (const collectionName of ["incomes", "expenses"]) {
    const snapshot = await assertSucceeds(getDocs(query(
      collection(db, `${householdPath}/${collectionName}`),
      where("householdId", "==", TEST_HOUSEHOLD_ID),
    )));
    assert.equal(snapshot.empty, false);
  }
});

test("household members can create legal income and expense records", async () => {
  const db = memberDb();
  await assertSucceeds(setDoc(doc(db, `${householdPath}/incomes/member-create`), baseIncome));
  await assertSucceeds(setDoc(doc(db, `${householdPath}/expenses/member-create`), baseExpense));
});

test("non-members cannot read, update, or delete household records", async () => {
  const db = outsiderDb();
  const target = doc(db, `${householdPath}/expenses/seed-expense`);
  await assertFails(getDoc(target));
  await assertFails(updateDoc(target, { amount: 999 }));
  await assertFails(deleteDoc(target));
});

test("writes with a mismatched householdId are rejected", async () => {
  const target = doc(memberDb(), `${householdPath}/incomes/wrong-household`);
  await assertFails(setDoc(target, { ...baseIncome, householdId: "another-household" }));
});

test("income supports create, read, update, and delete through current Rules", async () => {
  const db = memberDb();
  const target = doc(db, `${householdPath}/incomes/crud-income`);
  await assertSucceeds(setDoc(target, baseIncome));
  assert.equal((await assertSucceeds(getDoc(target))).data().amount, 3500);
  await assertSucceeds(updateDoc(target, { amount: 4200, householdId: TEST_HOUSEHOLD_ID }));
  assert.equal((await assertSucceeds(getDoc(target))).data().amount, 4200);
  await assertSucceeds(deleteDoc(target));
  // Production Rules allow members to read a missing document; it returns not-found.
  const deleted = await assertSucceeds(getDoc(target));
  assert.equal(deleted.exists(), false);
});

test("expense supports create, read, update, and delete through current Rules", async () => {
  const db = memberDb();
  const target = doc(db, `${householdPath}/expenses/crud-expense`);
  await assertSucceeds(setDoc(target, baseExpense));
  assert.equal((await assertSucceeds(getDoc(target))).data().category, "文具");
  await assertSucceeds(updateDoc(target, { amount: 300, householdId: TEST_HOUSEHOLD_ID }));
  assert.equal((await assertSucceeds(getDoc(target))).data().amount, 300);
  await assertSucceeds(deleteDoc(target));
});

test("recurring expense templates support current upsert, read, update, and delete behavior", async () => {
  const db = memberDb();
  const target = doc(db, `${householdPath}/recurringExpenses/crud-recurring`);
  const recurring = {
    householdId: TEST_HOUSEHOLD_ID,
    name: "Fictional Monthly Fee",
    category: "居家固定費",
    amount: 800,
    target: "self",
    paymentMethod: "銀行扣款",
    visibleFor: ["chris", "wife"],
    createdBy: "emulator-test",
  };
  await assertSucceeds(setDoc(target, recurring));
  assert.equal((await assertSucceeds(getDoc(target))).data().amount, 800);
  await assertSucceeds(updateDoc(target, { amount: 900, householdId: TEST_HOUSEHOLD_ID }));
  assert.equal((await assertSucceeds(getDoc(target))).data().amount, 900);
  await assertSucceeds(deleteDoc(target));
});

test("current Rules allow malformed field schemas when householdId is valid", async () => {
  const db = memberDb();
  const target = doc(db, `${householdPath}/incomes/schema-gap`);
  await assertSucceeds(setDoc(target, {
    householdId: TEST_HOUSEHOLD_ID,
    amount: "not-a-number",
    category: "unknown-category",
  }));
  await assertSucceeds(deleteDoc(target));
});
