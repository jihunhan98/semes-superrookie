import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "요구사항 엔지니어링",
  description: "회원가입 · 로그인",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
