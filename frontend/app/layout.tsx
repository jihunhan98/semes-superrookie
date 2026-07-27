import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "./components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "요구사항 명세서 자동화",
  description: "고객 요구사항의 모호성 해결 · 기능 도출 · DB 변경관리 (SEMES VCS)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex min-h-screen bg-gray-50 text-gray-900">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-auto">
            <div className="mx-auto max-w-4xl px-6 py-8 sm:px-10">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
