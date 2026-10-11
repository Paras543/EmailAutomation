import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Outreach CRM — HR Email Automation",
  description: "A lightweight personal HR outreach CRM for internship and job applications. Upload contacts, generate personalized emails, and send through Gmail.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
