import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { InstallAppPrompt } from "@/components/layout/InstallAppPrompt";

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
    <div className="min-h-screen bg-cream text-ink flex">
      <SidebarNav
        userName={session.user.name ?? "Utilisateur"}
        userEmail={session.user.email ?? ""}
        userInitial={session.user.name?.[0]?.toUpperCase() ?? "U"}
        credits={session.user.role === "ADMIN" ? -1 : (session.user.credits ?? 0)}
        isAdmin={session.user.role === "ADMIN"}
      />

      <main className="flex-1 overflow-auto bg-cream">
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-16 md:pt-10 pb-10">
          <InstallAppPrompt />
          {children}
        </div>
      </main>
    </div>
  );
}
