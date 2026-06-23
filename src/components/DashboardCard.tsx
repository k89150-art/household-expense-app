type Props = {
  title: string;
  amount: number;
  hint?: string;
};

export function DashboardCard({ title, amount, hint }: Props) {
  return (
    <section className="card grid">
      <div className="muted">{title}</div>
      <div className="amount">${amount.toLocaleString("zh-TW")}</div>
      {hint ? <div className="muted">{hint}</div> : null}
    </section>
  );
}
