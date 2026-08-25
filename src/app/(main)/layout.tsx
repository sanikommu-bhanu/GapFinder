import { BottomNav } from "@/components/nav/BottomNav";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-none pb-2">{children}</div>
      <BottomNav />
    </div>
  );
}
