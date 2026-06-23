import "./globals.css";

export const metadata = {
  title: "夫妻家庭帳本",
  description: "iPhone friendly household expense tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW">
      <body>{children}</body>
    </html>
  );
}
