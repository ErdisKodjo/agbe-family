"use client";
// ============================================================
// PGF — Page principale (SPA : auth → espace admin/membre)
// ============================================================
import { useEffect, useState, useCallback } from "react";
import { get } from "@/components/pgf/api";
import type { CurrentMember } from "@/components/pgf/types";
import { LoginScreen } from "@/components/pgf/login-screen";
import { ChangePasswordScreen } from "@/components/pgf/change-password-screen";
import { AppShell, type ViewId } from "@/components/pgf/app-shell";
import { AdminDashboard } from "@/components/pgf/admin/admin-dashboard";
import { RegistriesView } from "@/components/pgf/admin/registries-view";
import { MembersView } from "@/components/pgf/admin/members-view";
import { ContributionsView } from "@/components/pgf/admin/contributions-view";
import { TreasuryView } from "@/components/pgf/admin/treasury-view";
import { ProjectsView } from "@/components/pgf/admin/projects-view";
import { ReportsView } from "@/components/pgf/admin/reports-view";
import { AuditView } from "@/components/pgf/admin/audit-view";
import { AnnouncementsView } from "@/components/pgf/admin/announcements-view";
import { MemberDashboard } from "@/components/pgf/member/member-dashboard";
import { MyContributionsView } from "@/components/pgf/member/my-contributions-view";
import { MyProjectsView } from "@/components/pgf/member/my-projects-view";
import { ProfileView } from "@/components/pgf/member/profile-view";
import { Toaster } from "sonner";

const ADMIN_ROLES = ["SUPER_ADMIN", "HEAD", "TREASURER"];

export default function Page() {
  const [member, setMember] = useState<CurrentMember | null>(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState<ViewId>("dashboard");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    get<{ member: CurrentMember | null }>("/api/auth/me")
      .then((r) => setMember(r.member))
      .catch(() => setMember(null))
      .finally(() => setChecking(false));
  }, []);

  const refreshPending = useCallback(() => {
    if (!member || !ADMIN_ROLES.includes(member.role)) return;
    fetch("/api/payments?status=PENDING", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { payments: [] }))
      .then((d) => setPendingCount(d.payments?.length ?? 0))
      .catch(() => {});
  }, [member]);

  useEffect(() => {
    refreshPending();
  }, [refreshPending, view]);

  const handleLogout = () => {
    setMember(null);
    setView("dashboard");
  };

  if (checking) {
    return (
      <div className="min-h-screen pgf-brand-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/15 flex items-center justify-center mb-4 animate-pulse">
            <span className="text-amber-300 font-bold text-xl">A</span>
          </div>
          <p className="text-white/80 text-sm">Chargement de la plateforme…</p>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <>
        <LoginScreen onLogin={(m) => setMember(m)} />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  // Mot de passe par défaut → changement obligatoire
  if (member.mustChangePassword) {
    return (
      <>
        <ChangePasswordScreen memberName={member.firstName} />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  const isAdmin = ADMIN_ROLES.includes(member.role);
  const effectiveView: ViewId = !isAdmin && ["registries", "members", "treasury", "reports", "audit"].includes(view) ? "dashboard" : view;

  const renderView = () => {
    if (isAdmin) {
      switch (effectiveView) {
        case "dashboard":
          return <AdminDashboard onNavigate={(v) => setView(v)} />;
        case "registries":
          return <RegistriesView onChanged={refreshPending} />;
        case "members":
          return <MembersView />;
        case "contributions":
          return <ContributionsView />;
        case "treasury":
          return <TreasuryView />;
        case "projects":
          return <ProjectsView />;
        case "reports":
          return <ReportsView />;
        case "audit":
          return <AuditView />;
        case "announcements":
          return <AnnouncementsView me={member} />;
        default:
          return <AdminDashboard onNavigate={(v) => setView(v)} />;
      }
    } else {
      switch (effectiveView) {
        case "dashboard":
          return <MemberDashboard memberName={member.firstName} onNavigate={(v) => setView(v)} />;
        case "my-contributions":
          return <MyContributionsView />;
        case "my-projects":
          return <MyProjectsView />;
        case "announcements":
          return <AnnouncementsView me={member} />;
        case "profile":
          return <ProfileView me={member} onUpdated={() => setMember({ ...member, mustChangePassword: false })} />;
        default:
          return <MemberDashboard memberName={member.firstName} onNavigate={(v) => setView(v)} />;
      }
    }
  };

  return (
    <>
      <AppShell member={member} view={effectiveView} onNavigate={(v) => setView(v)} onLogout={handleLogout} pendingBadge={pendingCount}>
        {renderView()}
      </AppShell>
      <Toaster position="top-center" richColors />
    </>
  );
}
