import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CodeEcho AI - AI-Powered Coding Interview Simulator',
  description: 'Practice coding interviews with a real-time AI interviewer that provides voice-based feedback and suggestions.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
        <head>
          {/* Tailwind CDN fallback */}
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
