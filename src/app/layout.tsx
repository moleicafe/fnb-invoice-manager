import './globals.css';
import { Inter, Calistoga, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const calistoga = Calistoga({ weight: '400', subsets: ['latin'], variable: '--font-calistoga' });
const jbMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jbmono' });

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${inter.variable} ${calistoga.variable} ${jbMono.variable}`}>
      <body className="min-h-screen">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
