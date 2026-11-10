import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
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
import { EMULATOR_HOST, EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR_PORT, TEST_HOUSEHOLD_ID, assertSafeEmulatorTarget } from "./emulator-config.mjs";

// 家庭記帳同步第一階段：外部整合專用唯讀身分與收入原地修改。只在本機 Emulator（demo- 專案）執行，帳號與資料皆為虛構。
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDirectory, "../..");
const householdPath = `households/${TEST_HOUSEHOLD_ID}`;
const COLLECTIONS = ["expenses", "incomes", "investments", "advances", "cardPayments", "livingTransfers", "recurringExpenses",
  "creditCards", "creditCardBills", "prepaidAccounts", "prepaidSettlements"];
let env;
let users;

before(async () => {
  assertSafeEmulatorTarget();
  users = await seedFirebaseEmulators();
  const rules = await readFile(resolve(projectRoot, "firebase/firestore.rules"), "utf8");
  env = await initializeTestEnvironment({ projectId: EMULATOR_PROJECT_ID, firestore: { host: EMULATOR_HOST, port: FIRESTORE_EMULATOR_PORT, rules } });
  // Every collection gets one document, written with Rules disabled (Emulator only).
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const name of COLLECTIONS) {
      await setDoc(doc(db, `${householdPath}/${name}/reader-probe`), { householdId: TEST_HOUSEHOLD_ID, date: "2026-10-01", amount: 1, owner: "chris", category: "本薪" });
    }
    await setDoc(doc(db, `${householdPath}/privateExpenseDetails/reader-probe`), { householdId: TEST_HOUSEHOLD_ID, ownerId: users.member.uid, expenseId: "x", actualItem: "x" });
    await setDoc(doc(db, "households/other-household"), { name: "Other", memberIds: [users.outsider.uid], integrationReaderIds: [] });
    await setDoc(doc(db, "households/other-household/incomes/other-income"), { householdId: "other-household", date: "2026-10-01", amount: 1, owner: "chris", category: "本薪" });
    await setDoc(doc(db, `${householdPath}/incomes/reader-wife-income`), { householdId: TEST_HOUSEHOLD_ID, date: "2026-10-01", amount: 1, owner: "wife", category: "本薪" });
  });
});

after(async () => { await env?.cleanup(); });

const dbFor = (uid) => env.authenticatedContext(uid).firestore();
const readerDb = () => dbFor(users.reader.uid);
const memberDb = () => dbFor(users.member.uid);
const partnerDb = () => dbFor(users.partner.uid);
const outsiderDb = () => dbFor(users.outsider.uid);
const income = (owner, amount) => ({ householdId: TEST_HOUSEHOLD_ID, date: "2026-10-05", amount, owner, category: "本薪", note: "虛構收入",
  createdBy: "emulator-test", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

async function setReaders(uids) {
  await env.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), householdPath), { integrationReaderIds: uids });
  });
}

test("唯讀整合身分（R3）：可讀家庭文件與本人（owner == chris）的 incomes；太太與其他成員的收入一律拒絕", async () => {
  const db = readerDb();
  const household = await assertSucceeds(getDoc(doc(db, householdPath)));
  assert.deepEqual(household.data().integrationReaderIds, [users.reader.uid]);
  assert.equal(household.data().memberIds.includes(users.reader.uid), false);
  await assertSucceeds(getDoc(doc(db, `${householdPath}/incomes/seed-income`)));
  const chris = await assertSucceeds(getDocs(query(collection(db, `${householdPath}/incomes`), where("owner", "==", "chris"))));
  assert.ok(chris.size >= 1);
  assert.ok(chris.docs.every((d) => d.data().owner === "chris"));
  // 不帶本人條件的整批查詢、依太太／其他成員查詢、直接讀太太的單筆收入：全部拒絕。
  await assertFails(getDocs(collection(db, `${householdPath}/incomes`)));
  await assertFails(getDocs(query(collection(db, `${householdPath}/incomes`), where("owner", "==", "wife"))));
  await assertFails(getDocs(query(collection(db, `${householdPath}/incomes`), where("owner", "==", "junyao"))));
  await assertFails(getDoc(doc(db, `${householdPath}/incomes/reader-wife-income`)));
  // 成員仍可讀全部收入（家庭記帳本身不受影響）。
  const members = await assertSucceeds(getDocs(collection(memberDb(), `${householdPath}/incomes`)));
  assert.ok(members.docs.some((d) => d.data().owner === "wife"));
});

test("唯讀整合身分：不能新增、修改、刪除收入", async () => {
  const db = readerDb();
  await assertFails(setDoc(doc(db, `${householdPath}/incomes/reader-create`), income("chris", 1)));
  await assertFails(addDoc(collection(db, `${householdPath}/incomes`), income("chris", 1)));
  await assertFails(updateDoc(doc(db, `${householdPath}/incomes/seed-income`), { amount: 1, householdId: TEST_HOUSEHOLD_ID }));
  await assertFails(deleteDoc(doc(db, `${householdPath}/incomes/seed-income`)));
});

test("唯讀整合身分：其他 10 個集合與私人明細一律不能讀、查、寫、刪", async () => {
  const db = readerDb();
  for (const name of COLLECTIONS.filter((c) => c !== "incomes")) {
    const target = doc(db, `${householdPath}/${name}/reader-probe`);
    await assertFails(getDoc(target));
    await assertFails(getDocs(collection(db, `${householdPath}/${name}`)));
    await assertFails(setDoc(doc(db, `${householdPath}/${name}/reader-create`), { householdId: TEST_HOUSEHOLD_ID }));
    await assertFails(updateDoc(target, { amount: 2, householdId: TEST_HOUSEHOLD_ID }));
    await assertFails(deleteDoc(target));
  }
  await assertFails(getDoc(doc(db, `${householdPath}/privateExpenseDetails/reader-probe`)));
  await assertFails(getDocs(collection(db, `${householdPath}/privateExpenseDetails`)));
});

test("唯讀整合身分：不能修改家庭文件（含把自己加入成員或移除整合名單）", async () => {
  const db = readerDb();
  const target = doc(db, householdPath);
  await assertFails(updateDoc(target, { memberIds: [users.member.uid, users.partner.uid, users.reader.uid] }));
  await assertFails(updateDoc(target, { integrationReaderIds: [] }));
  await assertFails(setDoc(target, { name: "x" }, { merge: true }));
  await assertFails(deleteDoc(target));
});

test("唯讀整合身分：只限被列名的家庭；其他家庭的文件與收入一律拒絕", async () => {
  const db = readerDb();
  await assertFails(getDoc(doc(db, "households/other-household")));
  await assertFails(getDoc(doc(db, "households/other-household/incomes/other-income")));
  await assertFails(getDocs(collection(db, "households/other-household/incomes")));
});

test("未列名者（外部帳號、未登入）不會因整合規則取得收入讀取權", async () => {
  for (const db of [outsiderDb(), env.unauthenticatedContext().firestore()]) {
    await assertFails(getDoc(doc(db, householdPath)));
    await assertFails(getDoc(doc(db, `${householdPath}/incomes/seed-income`)));
    await assertFails(getDocs(collection(db, `${householdPath}/incomes`)));
  }
});

test("同一 UID 同時是成員又被列為整合身分：不取得任何額外權限，仍只有原本的成員權限", async () => {
  await setReaders([users.reader.uid, users.member.uid]);
  try {
    const db = memberDb();
    await assertSucceeds(getDoc(doc(db, `${householdPath}/incomes/seed-income`)));
    await assertSucceeds(getDoc(doc(db, `${householdPath}/expenses/reader-probe`)));
    await assertFails(updateDoc(doc(db, householdPath), { name: "x" }));
  } finally {
    await setReaders([users.reader.uid]);
  }
});

test("從名單移除後立即失去讀取權；重新列入後恢復", async () => {
  await setReaders([]);
  try {
    await assertFails(getDoc(doc(readerDb(), householdPath)));
    await assertFails(getDocs(query(collection(readerDb(), `${householdPath}/incomes`), where("owner", "==", "chris"))));
  } finally {
    await setReaders([users.reader.uid]);
  }
  await assertSucceeds(getDocs(query(collection(readerDb(), `${householdPath}/incomes`), where("owner", "==", "chris"))));
});

test("收入原地修改：兩位成員都能修改，文件 ID、owner、createdBy 不變；清除備註會移除欄位；唯讀身分讀到新版本", async () => {
  const id = "edit-in-place";
  await assertSucceeds(setDoc(doc(memberDb(), `${householdPath}/incomes/${id}`), income("chris", 52000)));
  await assertSucceeds(updateDoc(doc(memberDb(), `${householdPath}/incomes/${id}`), { amount: 53000, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(partnerDb(), `${householdPath}/incomes/${id}`), { date: "2026-10-06", note: deleteField(), updatedAt: serverTimestamp() }));
  const seen = await assertSucceeds(getDoc(doc(readerDb(), `${householdPath}/incomes/${id}`)));
  assert.equal(seen.id, id);
  assert.equal(seen.data().amount, 53000);
  assert.equal(seen.data().date, "2026-10-06");
  assert.equal(seen.data().owner, "chris");
  assert.equal(seen.data().createdBy, "emulator-test");
  assert.equal("note" in seen.data(), false);
  // 非成員不能修改；修改不能把 householdId 改成別的家庭。
  await assertFails(updateDoc(doc(outsiderDb(), `${householdPath}/incomes/${id}`), { amount: 1 }));
  await assertFails(updateDoc(doc(memberDb(), `${householdPath}/incomes/${id}`), { householdId: "other-household" }));
  await assertSucceeds(deleteDoc(doc(memberDb(), `${householdPath}/incomes/${id}`)));
  // R3：刪除後整合身分的本人查詢不再出現這筆；直接讀已刪除的文件因無法證明屬於本人而被拒絕。
  const after = await assertSucceeds(getDocs(query(collection(readerDb(), `${householdPath}/incomes`), where("owner", "==", "chris"))));
  assert.equal(after.docs.some((d) => d.id === id), false);
  await assertFails(getDoc(doc(readerDb(), `${householdPath}/incomes/${id}`)));
});
