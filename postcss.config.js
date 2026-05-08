import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Minthon — Fundraising NFTs for Pediatric Cancer",
  description:
    "Earn a generative NFT on the Hedera blockchain by fundraising for children with cancer.",
  openGraph: {
    title: "Minthon",
    description: "NFT fundraiser for pediatric cancer research",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
