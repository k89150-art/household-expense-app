type PersonSummary = {
  name: string;
  income?: number;
  expense: number;
  details?: { label: string; amount: number; paidBy: string }[];
};

const personSummaries: PersonSummary[] = [
  {
    name: "我",
    income: 72000,
    expense: 18450,
    details: [
      { label: "醫院午餐", amount: 1680, paidBy: "我" },
      { label: "個人餐飲", amount: 3200, paidBy: "我" },
      { label: "醫療", amount: 850, paidBy: "我" },
    ],
  },
  {
    name: "太太",
    income: 30000,
    expense: 12600,
    details: [
      { label: "生活費轉入", amount: 30000, paidBy: "我轉入" },
      { label: "生活用品", amount: 4200, paidBy: "太太" },
    ],
  },
  {
    name: "竣堯",
    expense: 15800,
    details: [
      { label: "學費", amount: 12000, paidBy: "太太" },
      { label: "保健食品", amount: 1800, paidBy: "我" },
      { label: "其他用品", amount: 2000, paidBy: "太太" },
    ],
  },
  {
    name: "貓",
    expense: 2600,
    details: [
      { label: "飼料", amount: 1400, paidBy: "我" },
      { label: "醫療", amount: 1200, paidBy: "我" },
    ],
  },
];

function money(value = 0) {
  return `$${value.toLocaleString("zh-TW")}`;
}

export function HomeSummary() {
  const totalIncome = personSummaries.reduce((sum, item) => sum + (item.income ?? 0), 0);
  const totalExpense = personSummaries.reduce((sum, item) => sum + item.expense, 0);
  const balance = totalIncome - totalExpense;

  return (
    <section className="grid">
      {personSummaries.map((person) => (
        <article className="card grid" key={person.name}>
          <div className="row">
            <h2 style={{ margin: 0 }}>{person.name}</h2>
            <strong>{person.income ? `收入 ${money(person.income)}` : "支出統計"}</strong>
          </div>
          <div className="row">
            <span className="muted">支出</span>
            <span className="amount">{money(person.expense)}</span>
          </div>
          {person.details ? (
            <div className="grid">
              {person.details.map((detail) => (
                <div className="row" key={`${person.name}-${detail.label}`}>
                  <span>{detail.label}</span>
                  <span className="muted">{money(detail.amount)}・{detail.paidBy}</span>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      ))}

      <article className="card grid">
        <h2>總結</h2>
        <div className="row"><span>總收入</span><strong>{money(totalIncome)}</strong></div>
        <div className="row"><span>總支出</span><strong>{money(totalExpense)}</strong></div>
        <div className="row"><span>本月結餘</span><strong>{money(balance)}</strong></div>
        <p className="muted" style={{ margin: 0 }}>生活費轉帳不另外列卡片；轉給太太後，會在太太收入中增加「生活費轉入」。</p>
      </article>
    </section>
  );
}
