import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: 'Rainier Watch',
  description: 'A two-angle Mount Rainier visibility dashboard for Puget Sound photo hunters.',
  openGraph: {
    title: 'Rainier Watch',
    description: 'Two city angles. One quick decision.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Rainier Watch — two city angles, one quick decision' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rainier Watch',
    description: 'Two city angles. One quick decision.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
