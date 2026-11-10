import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { seedFirebaseEmulators } from "../../scripts/seed-firebase-emulator.mjs";
import { EMULATOR_HOST, EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR_PORT, TEST_HOUSEHOLD_ID, assertSafeEmulatorTarget } from "./emulator-config.mjs";

// 家庭記帳同步第三階段（Rules R4）：兩段式還款——待銀行扣款 → 銀行已扣款。只在本機 Emulator（demo- 專案），資料皆為虛構。
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDirectory, "../..");
const householdPath = `households/${TEST_HOUSEHOLD_ID}`;
let env;
let users;

before(async () => {
  assertSafeEmulatorTarget();
  users = await seedFirebaseEmulators();
  const rules = await readFile(resolve(projectRoot, "firebase/firestore.rules"), "utf8");
  env = await initializeTestEnvironment({ projectId: EMULATOR_PROJECT_ID, firestore: { host: EMULATOR_HOST, port: FIRESTORE_EMULATOR_PORT, rules } });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, householdPath), { integrationReaderIds: [users.reader.uid] }, { merge: true });
    for (const [id, amount, note] of [["two-m", 19200, "房貸"], ["two-t", 10922, "房屋增貸"], ["two-x", 19200, "房貸"], ["two-d", 19200, "房貸"]]) {
      await setDoc(doc(db, `${householdPath}/expenses/${id}`), { householdId: TEST_HOUSEHOLD_ID, date: "2026-11-05", amount, category: "居家固定費", note, target: "chris",
        paidBy: "chris", paymentMethod: "bank_transfer", isPrivate: false, createdBy: users.member.uid });
    }
  });
});
after(async () => { await env?.cleanup(); });

const dbFor = (uid) => env.authenticatedContext(uid).firestore();
const memberDb = () => dbFor(users.member.uid);
const ref = (db, id) => doc(db, `${householdPath}/loanRepayments/${id}`);
const pending = (expenseId, over = {}) => ({ householdId: TEST_HOUSEHOLD_ID, expenseId, stage: "PENDING_DEBIT", loanKey: "ORIGINAL_MORTGAGE", dueDate: "2026-11-21",
  totalAmount: 19200, status: "ACTIVE", createdBy: users.member.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...over });
const debitedFrom = (saved, over = {}) => ({ householdId: TEST_HOUSEHOLD_ID, expenseId: saved.expenseId, stage: "BANK_DEBITED", loanKey: saved.loanKey, dueDate: saved.dueDate,
  paidDate: "2026-11-21", totalAmount: 19122, principal: 10956, interest: 8166, fee: 0, confirmation: "BANK_CONFIRMED", status: "ACTIVE",
  createdBy: saved.createdBy, createdAt: saved.createdAt, updatedAt: serverTimestamp(), ...over });

test("待銀行扣款：只有貸款別、預定扣款日與支出金額；不能帶本金、利息或實際扣款日", async () => {
  const db = memberDb();
  await assertFails(setDoc(ref(db, "two-m"), pending("two-m", { totalAmount: 19122 })));                       // 必須等於這筆支出
  await assertFails(setDoc(ref(db, "two-m"), pending("two-m", { principal: 10000 })));
  await assertFails(setDoc(ref(db, "two-m"), pending("two-m", { paidDate: "2026-11-21" })));
  await assertFails(setDoc(ref(db, "two-m"), pending("two-m", { dueDate: "" })));
  await assertFails(setDoc(ref(db, "two-m"), pending("two-m", { stage: "MAYBE" })));
  await assertSucceeds(setDoc(ref(db, "two-m"), pending("two-m")));
  await assertSucceeds(setDoc(ref(db, "two-t"), pending("two-t", { loanKey: "TOP_UP_LOAN", dueDate: "2026-11-29", totalAmount: 10922 })));
  await assertSucceeds(updateDoc(ref(db, "two-m"), { dueDate: "2026-11-22", updatedAt: serverTimestamp() }));     // 修改預定扣款日
});

test("確認銀行已扣款：整份改寫為實際扣款（可與轉帳金額不同），本金＋利息＋手續費＝總額；createdBy／createdAt 不變", async () => {
  const db = memberDb();
  const saved = (await getDoc(ref(db, "two-m"))).data();
  await assertFails(setDoc(ref(db, "two-m"), debitedFrom(saved, { interest: 8000 })));                         // 拆分不等於總額
  await assertFails(setDoc(ref(db, "two-m"), debitedFrom(saved, { createdBy: users.partner.uid })));
  await assertFails(setDoc(ref(db, "two-m"), debitedFrom(saved, { createdAt: serverTimestamp() })));
  await assertFails(setDoc(ref(db, "two-m"), debitedFrom(saved, { paidDate: "2026/11/21" })));
  await assertSucceeds(setDoc(ref(db, "two-m"), debitedFrom(saved)));
  const after = (await getDoc(ref(db, "two-m"))).data();
  assert.equal(after.totalAmount, 19122);
  assert.equal(after.principal, 10956);
  // 支出（轉帳 19,200）本身不改寫；已扣款明細下修改支出金額也不被阻擋
  assert.equal((await getDoc(doc(db, `${householdPath}/expenses/two-m`))).data().amount, 19200);
  await assertSucceeds(updateDoc(doc(db, `${householdPath}/expenses/two-m`), { note: "房貸 11 月", householdId: TEST_HOUSEHOLD_ID }));
  // 改回待扣款（例如誤按），也可以
  await assertSucceeds(setDoc(ref(db, "two-m"), pending("two-m", { createdAt: after.createdAt })));
});

test("待扣款明細存在時，支出金額不能單獨改成不一致；刪除支出必須同批刪除明細", async () => {
  const db = memberDb();
  await assertSucceeds(setDoc(ref(db, "two-x"), pending("two-x")));
  await assertFails(updateDoc(doc(db, `${householdPath}/expenses/two-x`), { amount: 19300, householdId: TEST_HOUSEHOLD_ID }));
  const both = writeBatch(db);
  both.update(doc(db, `${householdPath}/expenses/two-x`), { amount: 19300, householdId: TEST_HOUSEHOLD_ID });
  both.update(ref(db, "two-x"), { totalAmount: 19300, updatedAt: serverTimestamp() });
  await assertSucceeds(both.commit());
  await assertSucceeds(setDoc(ref(db, "two-d"), pending("two-d")));
  await assertFails(deleteDoc(ref(db, "two-d")));
  await assertFails(deleteDoc(doc(db, `${householdPath}/expenses/two-d`)));
  const del = writeBatch(db);
  del.delete(ref(db, "two-d")); del.delete(doc(db, `${householdPath}/expenses/two-d`));
  await assertSucceeds(del.commit());
});

test("唯讀整合身分：可讀待扣款與已扣款明細，仍不能讀一般支出、不能寫入", async () => {
  const db = dbFor(users.reader.uid);
  const all = await assertSucceeds(getDocs(collection(db, `${householdPath}/loanRepayments`)));
  assert.ok(all.docs.some((d) => d.data().stage === "PENDING_DEBIT"));
  await assertFails(getDoc(doc(db, `${householdPath}/expenses/two-m`)));
  await assertFails(getDocs(collection(db, `${householdPath}/expenses`)));
  await assertFails(setDoc(ref(db, "two-t"), pending("two-t", { createdBy: users.reader.uid, totalAmount: 10922 })));
  await assertFails(updateDoc(ref(db, "two-t"), { status: "VOID", updatedAt: serverTimestamp() }));
});
