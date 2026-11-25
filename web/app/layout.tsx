import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// The tab icon comes from app/icon.png and app/apple-icon.png by file convention,
// so there is no `icons` entry here.
export const metadata: Metadata = {
  title: {
    default: "Hyring Sales CRM",
    template: "%s | Hyring Sales CRM",
  },
  description: "Sales CRM with email sequences and workflow automation.",
  applicationName: "Hyring Sales CRM",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full">
        <div className="flex h-full">
          <Sidebar />
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
