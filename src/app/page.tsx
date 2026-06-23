import { DashboardCard } from "@/components/DashboardCard";
import { ExpenseQuickForm } from "@/components/ExpenseQuickForm";
import { PrepaidSettlementForm } from "@/components/PrepaidSettlementForm";

export default function HomePage() {
  return (
    <main className="container grid">
      <header className="grid" style={{ paddingTop: 8 }}>
        <div className="muted">2026 年 7 月</div>
        <h1 style={{ margin: 0 }}>夫妻家庭帳本</h1>
      </header>
      <DashboardCard title="本月家庭支出" amount={24300} hint="不含信用卡繳款與生活費轉帳" />
      <DashboardCard title="本月個人支出" amount={4150} hint="含 Chris 醫院午餐與個人餐飲" />
      <DashboardCard title="本月生活費轉帳" amount={30000} hint="Chris → 太太，已轉帳" />
      <ExpenseQuickForm />
      <PrepaidSettlementForm />
      <nav className="nav">
        <button>首頁</button>
        <button>新增</button>
        <button>固定</button>
        <button>報表</button>
      </nav>
    </main>
  );
}
