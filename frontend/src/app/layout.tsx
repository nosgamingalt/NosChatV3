import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NosChat — self-hosted chat",
  description:
    "A self-hosted chat platform. Clerk handles sign-in/sign-up; everything else — data, files, realtime — lives on your homelab.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#F0A868",
          colorBackground: "#1B1F27",
          colorForeground: "#E8EAED",
          colorMutedForeground: "#8B93A1",
          colorInput: "#12151A",
          colorInputForeground: "#E8EAED",
          colorBorder: "#2A2F3A",
          borderRadius: "0.5rem",
          fontFamily: "var(--font-geist-sans)",
        },
        elements: {
          card: "border border-[#2A2F3A] bg-[#1B1F27] shadow-none",
          headerTitle: "text-[#E8EAED]",
          headerSubtitle: "text-[#8B93A1]",
          socialButtonsBlockButton: "border-[#2A2F3A] bg-[#12151A] text-[#E8EAED]",
          dividerLine: "bg-[#2A2F3A]",
          dividerText: "text-[#8B93A1]",
          formFieldLabel: "text-[#8B93A1]",
          formFieldInput: "border-[#2A2F3A] bg-[#12151A] text-[#E8EAED]",
          formButtonPrimary: "bg-[#F0A868] text-[#12151A] hover:bg-[#e59a52]",
          footerActionLink: "text-[#F0A868] hover:text-[#e59a52]",
          identityPreviewEditButton: "text-[#F0A868]",
        },
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
