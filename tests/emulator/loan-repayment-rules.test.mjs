import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { seedFirebaseEmulators } from "../../scripts/seed-firebase-emulator.mjs";
import { EMULATOR_HOST, EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR_PORT, TEST_HOUSEHOLD_ID, assertSafeEmulatorTarget } from "./emulator-config.mjs";

// 家庭記帳同步第二階段：房貸／增貸還款明細 Rules。只在本機 Emulator（demo- 專案）執行，帳號與資料皆為虛構。
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
    for (const [id, amount, note, category] of [["exp-m1", 10015, "房貸", "居家固定費"], ["exp-m2", 10000, "房貸", "居家固定費"], ["exp-t1", 10000, "房屋增貸", "其他"],
      ["exp-del", 10000, "房貸", "居家固定費"], ["exp-plain", 500, "電費", "居家固定費"]]) {
      await setDoc(doc(db, `${householdPath}/expenses/${id}`), { householdId: TEST_HOUSEHOLD_ID, date: "2026-10-05", amount, category, note, target: "chris",
        paidBy: "chris", paymentMethod: "bank_transfer", isPrivate: false, createdBy: users.member.uid });
    }
    await setDoc(doc(db, "households/other-household"), { name: "Other", memberIds: [users.outsider.uid], integrationReaderIds: [] });
  });
});

after(async () => { await env?.cleanup(); });

const dbFor = (uid) => env.authenticatedContext(uid).firestore();
const memberDb = () => dbFor(users.member.uid);
const repayRef = (db, id) => doc(db, `${householdPath}/loanRepayments/${id}`);
const repayment = (expenseId, over = {}) => ({ householdId: TEST_HOUSEHOLD_ID, expenseId, loanKey: "ORIGINAL_MORTGAGE", dueDate: "2026-10-05", paidDate: "2026-10-05",
  totalAmount: 10015, principal: 8000, interest: 2000, fee: 15, confirmation: "BANK_CONFIRMED", status: "ACTIVE", createdBy: users.member.uid,
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...over });

test("還款明細：成員可為既有房貸支出補登明細（文件 ID＝支出 ID，總額＝支出金額）", async () => {
  await assertSucceeds(setDoc(repayRef(memberDb(), "exp-m1"), repayment("exp-m1")));
  const saved = await assertSucceeds(getDoc(repayRef(memberDb(), "exp-m1")));
  assert.equal(saved.data().principal, 8000);
  await assertSucceeds(setDoc(repayRef(dbFor(users.partner.uid), "exp-t1"), repayment("exp-t1", { loanKey: "TOP_UP_LOAN", totalAmount: 10000, principal: 7000, interest: 3000, fee: 0,
    createdBy: users.partner.uid })));
});

test("還款明細：不能連到不存在的支出、不能和支出金額不同、拆分必須相加等於總額", async () => {
  const db = memberDb();
  await assertFails(setDoc(repayRef(db, "exp-missing"), repayment("exp-missing")));
  await assertFails(setDoc(repayRef(db, "exp-m2"), repayment("exp-m2")));                                    // 10015 ≠ 10000
  await assertFails(setDoc(repayRef(db, "exp-m2"), repayment("exp-m2", { totalAmount: 10000, fee: 0, interest: 1999 }))); // 8000+1999 ≠ 10000
  await assertFails(setDoc(repayRef(db, "exp-m2"), repayment("exp-m2", { expenseId: "exp-m1", totalAmount: 10000, fee: 0 })));
  await assertFails(setDoc(repayRef(db, "exp-m2"), repayment("exp-m2", { totalAmount: 10000, principal: 8000.5, interest: 1999.5, fee: 0 })));
  await assertFails(setDoc(repayRef(db, "exp-m2"), repayment("exp-m2", { totalAmount: 10000, fee: 0, loanKey: "CAR" })));
  await assertFails(setDoc(repayRef(db, "exp-m2"), repayment("exp-m2", { totalAmount: 10000, fee: 0, extra: true })));
  await assertFails(setDoc(repayRef(db, "exp-m2"), repayment("exp-m2", { totalAmount: 10000, fee: 0, createdBy: users.partner.uid })));
  await assertFails(setDoc(repayRef(db, "exp-m2"), repayment("exp-m2", { totalAmount: 10000, fee: 0, dueDate: "2026/10/05" })));
  await assertSucceeds(setDoc(repayRef(db, "exp-m2"), repayment("exp-m2", { totalAmount: 10000, fee: 0 })));
});

test("還款明細：修改日期與金額拆分、作廢、還原都保留同一份文件；createdBy 不能改", async () => {
  const db = memberDb();
  const ref = repayRef(db, "exp-m1");
  await assertSucceeds(updateDoc(ref, { dueDate: "2026-11-05", paidDate: "2026-11-04", principal: 7950, interest: 2050, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { principal: 1, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { createdBy: users.partner.uid, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { status: "VOID" }));                                                      // updatedAt 必須是伺服器時間
  await assertSucceeds(updateDoc(ref, { status: "VOID", updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(ref, { status: "ACTIVE", updatedAt: serverTimestamp() }));
  assert.equal((await getDoc(ref)).data().principal, 7950);
});

test("還款明細不能單獨刪除；支出刪除時必須同一批次一起刪除", async () => {
  const db = memberDb();
  await assertSucceeds(setDoc(repayRef(db, "exp-del"), repayment("exp-del", { totalAmount: 10000, fee: 0 })));
  await assertFails(deleteDoc(repayRef(db, "exp-del")));
  await assertFails(deleteDoc(doc(db, `${householdPath}/expenses/exp-del`)));              // 留下孤兒明細
  const batch = writeBatch(db);
  batch.delete(repayRef(db, "exp-del"));
  batch.delete(doc(db, `${householdPath}/expenses/exp-del`));
  await assertSucceeds(batch.commit());
  // 沒有明細的一般支出照常刪除（批次中刪除不存在的明細也可以）。
  const plain = writeBatch(db);
  plain.delete(repayRef(db, "exp-plain"));
  plain.delete(doc(db, `${householdPath}/expenses/exp-plain`));
  await assertSucceeds(plain.commit());
});

test("有效明細存在時，支出金額不能單獨改成不一致；明細作廢後不受限", async () => {
  const db = memberDb();
  const expense = doc(db, `${householdPath}/expenses/exp-m2`);
  await assertFails(updateDoc(expense, { amount: 9999, householdId: TEST_HOUSEHOLD_ID }));
  await assertSucceeds(updateDoc(expense, { note: "房貸（10 月）", householdId: TEST_HOUSEHOLD_ID }));
  const both = writeBatch(db);
  both.update(expense, { amount: 10010, householdId: TEST_HOUSEHOLD_ID });
  both.update(repayRef(db, "exp-m2"), { totalAmount: 10010, fee: 10, updatedAt: serverTimestamp() });
  await assertSucceeds(both.commit());
});

test("Portfolio Steward 唯讀整合身分：可讀取還款明細（get／list），不能寫入或刪除", async () => {
  const db = dbFor(users.reader.uid);
  await assertSucceeds(getDoc(repayRef(db, "exp-m1")));
  const all = await assertSucceeds(getDocs(collection(db, `${householdPath}/loanRepayments`)));
  assert.ok(all.size >= 2);
  await assertFails(updateDoc(repayRef(db, "exp-m1"), { status: "VOID", updatedAt: serverTimestamp() }));
  await assertFails(setDoc(repayRef(db, "exp-t1"), repayment("exp-t1", { createdBy: users.reader.uid })));
  await assertFails(deleteDoc(repayRef(db, "exp-m1")));
  await assertFails(getDoc(doc(db, `${householdPath}/expenses/exp-m1`)));                 // 仍然讀不到支出
});

test("外部帳號、未登入者、其他家庭：不能讀寫還款明細", async () => {
  for (const db of [dbFor(users.outsider.uid), env.unauthenticatedContext().firestore()]) {
    await assertFails(getDoc(repayRef(db, "exp-m1")));
    await assertFails(getDocs(collection(db, `${householdPath}/loanRepayments`)));
    await assertFails(updateDoc(repayRef(db, "exp-m1"), { status: "VOID", updatedAt: serverTimestamp() }));
  }
  await assertFails(getDocs(collection(dbFor(users.reader.uid), "households/other-household/loanRepayments")));
});
