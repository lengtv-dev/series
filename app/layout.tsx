import type {Metadata} from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css'; // Global styles

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'ระบบดึงข้อมูล M3U Playlist ซีรีย์ยอดนิยม (Series Harvester)',
  description: 'ดึงข้อมูลรูปภาพ ชื่อเรื่อง รายชื่อตอน ลิงก์สตรีมมิ่ง M3U8 ทั้งหมดแบบ Full Episodes จากบอร์ดซีรีย์ในคลิกเดียว',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="th" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[#0A0C10] text-[#C9D1D9] min-h-screen font-sans antialiased selection:bg-[#58A6FF] selection:text-black" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

