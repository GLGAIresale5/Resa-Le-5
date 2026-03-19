import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";
import PushNotifications from "../components/PushNotifications";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-zinc-50">
      <PushNotifications />
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col overflow-auto pb-14 md:pb-0">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
