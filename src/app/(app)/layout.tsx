import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/layout/SidebarNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex">
      <SidebarNav
        userName={session.user.name ?? "Utilisateur"}
        userEmail={session.user.email ?? ""}
        userInitial={session.user.name?.[0]?.toUpperCase() ?? "U"}
        credits={session.user.role === "ADMIN" ? -1 : (session.user.credits ?? 0)}
        isAdmin={session.user.role === "ADMIN"}
      />

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
