import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0C10] text-[#C9D1D9]">
      <h2 className="text-2xl font-bold mb-4">404 - ไม่พบหน้าที่ต้องการ</h2>
      <Link href="/" className="px-4 py-2 bg-[#238636] text-white rounded-md hover:bg-[#2ea043]">
        กลับหน้าหลัก
      </Link>
    </div>
  );
}
