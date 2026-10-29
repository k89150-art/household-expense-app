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
  arrayRemove,
  arrayUnion,
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
  writeBatch,
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

function anonymousDb() {
  return testEnvironment.unauthenticatedContext().firestore();
}

async function readHouseholdWithoutRules() {
  let data;
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDoc(doc(context.firestore(), householdPath));
    data = snapshot.exists() ? snapshot.data() : undefined;
  });
  return data;
}

async function assertHouseholdUnchanged() {
  const data = await readHouseholdWithoutRules();
  assert.ok(data, "household document must still exist");
  assert.deepEqual(data.memberIds, [users.member.uid, users.partner.uid]);
  assert.equal(data.name, "Emulator Test Household");
}

test("R1: unauthenticated users cannot read the household document", async () => {
  await assertFails(getDoc(doc(anonymousDb(), householdPath)));
});

test("R1: non-members cannot read the household document", async () => {
  await assertFails(getDoc(doc(outsiderDb(), householdPath)));
});

test("R1: both household members can read the household document", async () => {
  for (const db of [memberDb(), partnerDb()]) {
    const snapshot = await assertSucceeds(getDoc(doc(db, householdPath)));
    assert.deepEqual(snapshot.data().memberIds, [users.member.uid, users.partner.uid]);
  }
});

test("R1: members cannot add another user to memberIds", async () => {
  const target = doc(memberDb(), householdPath);
  await assertFails(updateDoc(target, { memberIds: arrayUnion(users.outsider.uid) }));
  await assertFails(setDoc(target, {
    memberIds: [users.member.uid, users.partner.uid, users.outsider.uid],
  }, { merge: true }));
  await assertHouseholdUnchanged();
  await assertFails(getDoc(doc(outsiderDb(), householdPath)));
});

test("R1: members cannot remove another member from memberIds", async () => {
  const target = doc(memberDb(), householdPath);
  await assertFails(updateDoc(target, { memberIds: arrayRemove(users.partner.uid) }));
  await assertFails(updateDoc(target, { memberIds: [users.member.uid] }));
  await assertHouseholdUnchanged();
  await assertSucceeds(getDoc(doc(partnerDb(), householdPath)));
});

test("R1: members cannot modify other household fields", async () => {
  const target = doc(memberDb(), householdPath);
  await assertFails(updateDoc(target, { name: "Renamed Household" }));
  await assertFails(updateDoc(target, { updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(target, { extraField: "unexpected" }));
  await assertFails(setDoc(target, {
    name: "Overwritten Household",
    memberIds: [users.member.uid, users.partner.uid],
  }));
  await assertHouseholdUnchanged();
});

test("R1: members cannot delete the household document", async () => {
  await assertFails(deleteDoc(doc(memberDb(), householdPath)));
  await assertFails(deleteDoc(doc(partnerDb(), householdPath)));
  await assertHouseholdUnchanged();
});

test("R1: non-members and anonymous users cannot write the household document", async () => {
  const outsiderTarget = doc(outsiderDb(), householdPath);
  await assertFails(updateDoc(outsiderTarget, { memberIds: arrayUnion(users.outsider.uid) }));
  await assertFails(deleteDoc(outsiderTarget));
  await assertFails(setDoc(doc(anonymousDb(), "households/anonymous-household"), {
    name: "Anonymous Household",
    memberIds: [],
  }));
  await assertHouseholdUnchanged();
});

test("R1: non-members cannot create a new household", async () => {
  const target = doc(outsiderDb(), "households/outsider-household");
  await assertFails(setDoc(target, {
    name: "Outsider Household",
    memberIds: [users.outsider.uid],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  assert.equal(await readHouseholdExists("outsider-household"), false);
  await assertFails(setDoc(doc(outsiderDb(), "households/outsider-household/incomes/abuse"), {
    householdId: "outsider-household",
    date: "2026-10-12",
    amount: 1,
  }));
});

test("R1: members cannot create a new household from the client", async () => {
  const target = doc(memberDb(), "households/second-household");
  await assertFails(setDoc(target, {
    name: "Second Household",
    memberIds: [users.member.uid],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  assert.equal(await readHouseholdExists("second-household"), false);
});

async function readHouseholdExists(householdId) {
  let exists;
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    exists = (await getDoc(doc(context.firestore(), `households/${householdId}`))).exists();
  });
  return exists;
}

test("R1 compatibility: legal income and expense CRUD still works for both members", async () => {
  for (const [label, db] of [["member", memberDb()], ["partner", partnerDb()]]) {
    const income = doc(db, `${householdPath}/incomes/r1-income-${label}`);
    await assertSucceeds(setDoc(income, {
      householdId: TEST_HOUSEHOLD_ID,
      date: "2026-10-15",
      amount: 52000,
      owner: label === "member" ? "chris" : "wife",
      category: "本薪",
      createdBy: label,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    assert.equal((await assertSucceeds(getDoc(income))).data().amount, 52000);
    await assertSucceeds(updateDoc(income, { amount: 53000, updatedAt: serverTimestamp() }));
    assert.equal((await assertSucceeds(getDoc(income))).data().amount, 53000);
    await assertSucceeds(deleteDoc(income));

    const expense = doc(db, `${householdPath}/expenses/r1-expense-${label}`);
    await assertSucceeds(setDoc(expense, {
      householdId: TEST_HOUSEHOLD_ID,
      date: "2026-10-16",
      amount: 320,
      category: "餐飲",
      target: label === "member" ? "chris" : "wife",
      paidBy: label === "member" ? "chris" : "wife",
      paymentMethod: "cash",
      isPrivate: false,
      createdBy: label,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    assert.equal((await assertSucceeds(getDoc(expense))).data().category, "餐飲");
    await assertSucceeds(updateDoc(expense, { amount: 350, updatedAt: serverTimestamp() }));
    assert.equal((await assertSucceeds(getDoc(expense))).data().amount, 350);
    await assertSucceeds(deleteDoc(expense));
  }
});

test("R1 compatibility: members can still query income and expense collections", async () => {
  for (const collectionName of ["incomes", "expenses"]) {
    const snapshot = await assertSucceeds(getDocs(query(
      collection(memberDb(), `${householdPath}/${collectionName}`),
      where("householdId", "==", TEST_HOUSEHOLD_ID),
    )));
    assert.equal(snapshot.empty, false);
  }
});

test("R1 compatibility: existing recurring expense templates remain readable", async () => {
  const snapshot = await assertSucceeds(getDocs(query(
    collection(memberDb(), `${householdPath}/recurringExpenses`),
    where("householdId", "==", TEST_HOUSEHOLD_ID),
  )));
  assert.equal(snapshot.empty, false);
  const seeded = await assertSucceeds(getDoc(doc(memberDb(), `${householdPath}/recurringExpenses/seed-recurring`)));
  assert.equal(seeded.data().name, "Emulator Test Rent");
});

test("R1 compatibility: reading a missing recurring template returns not-found", async () => {
  // upsertRecurringExpenseTemplate() calls getDoc() before the first write of a new template.
  // Production Rules allow this read for members, so the template can be created.
  const snapshot = await assertSucceeds(getDoc(doc(memberDb(), `${householdPath}/recurringExpenses/not-created-yet`)));
  assert.equal(snapshot.exists(), false);
  await assertFails(getDoc(doc(outsiderDb(), `${householdPath}/recurringExpenses/not-created-yet`)));
});

test("R1 compatibility: private expense batch write and owner-only access are unchanged", async () => {
  const db = memberDb();
  const batch = writeBatch(db);
  const expenseRef = doc(db, `${householdPath}/expenses/r1-private-expense`);
  const detailRef = doc(db, `${householdPath}/privateExpenseDetails/r1-private-detail`);
  batch.set(expenseRef, {
    householdId: TEST_HOUSEHOLD_ID,
    date: "2026-10-17",
    amount: 500,
    category: "個人雜支",
    target: "chris",
    paidBy: "chris",
    paymentMethod: "cash",
    isPrivate: true,
    createdBy: users.member.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(detailRef, {
    householdId: TEST_HOUSEHOLD_ID,
    expenseId: expenseRef.id,
    ownerId: users.member.uid,
    privateNote: "Fictional private note",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());

  await assertSucceeds(getDoc(detailRef));
  await assertSucceeds(getDocs(query(
    collection(db, `${householdPath}/privateExpenseDetails`),
    where("ownerId", "==", users.member.uid),
    where("expenseId", "==", expenseRef.id),
  )));
  await assertSucceeds(updateDoc(detailRef, { privateNote: "Updated private note", updatedAt: serverTimestamp() }));

  const partnerDetail = doc(partnerDb(), `${householdPath}/privateExpenseDetails/r1-private-detail`);
  await assertFails(getDoc(partnerDetail));
  await assertFails(updateDoc(partnerDetail, { privateNote: "Partner edit" }));
  await assertFails(deleteDoc(partnerDetail));
  await assertFails(getDoc(doc(outsiderDb(), `${householdPath}/privateExpenseDetails/r1-private-detail`)));

  await assertFails(setDoc(doc(partnerDb(), `${householdPath}/privateExpenseDetails/r1-forged-owner`), {
    householdId: TEST_HOUSEHOLD_ID,
    expenseId: expenseRef.id,
    ownerId: users.member.uid,
    privateNote: "Forged owner",
  }));
  await assertFails(setDoc(doc(outsiderDb(), `${householdPath}/privateExpenseDetails/r1-outsider`), {
    householdId: TEST_HOUSEHOLD_ID,
    expenseId: expenseRef.id,
    ownerId: users.outsider.uid,
    privateNote: "Outsider note",
  }));

  const cleanup = writeBatch(db);
  cleanup.delete(detailRef);
  cleanup.delete(expenseRef);
  await assertSucceeds(cleanup.commit());
});
