import WebsiteSidebar from "./WebsiteSidebar";
import { ScrollProgress } from "./Motion";

export default function WebsiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#111111] text-[#e8e0d4]">
      <ScrollProgress />
      <WebsiteSidebar />
      <main className="lg:ml-[280px] pt-16 lg:pt-0">{children}</main>
    </div>
  );
}
