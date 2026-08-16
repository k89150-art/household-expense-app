type ReimbursableAdvance = {
  date: string;
  status: string;
  reimbursedDate?: string | null;
};

export function advanceReimbursementDate(record: ReimbursableAdvance) {
  if (record.status !== "已收回") return null;
  return record.reimbursedDate || record.date;
}

export function reimbursedAdvancesForPeriod<T extends ReimbursableAdvance>(records: T[], startDate: string, endDate: string) {
  return records.filter((record) => {
    const reimbursedDate = advanceReimbursementDate(record);
    return reimbursedDate !== null && reimbursedDate >= startDate && reimbursedDate <= endDate;
  });
}
