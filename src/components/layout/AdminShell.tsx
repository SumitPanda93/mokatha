import React, { useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, AlertTriangle, ShieldAlert, DollarSign,
  Activity, Settings, LogOut, Radio, Sparkles, FileText, BadgeCheck,
} from "lucide-react";
import { useCurrentUser, useReports, logout } from "@/lib/store";

interface AdminShellProps {
  children: React.ReactNode;
}

export default function AdminShell({ children }: AdminShellProps) {
  const [location, setLocation] = useLocation();
  const { data: adminUser } = useCurrentUser();
  const { data: reports = [] } = useReports();
  const pendingReports = reports.filter((r) => r.status === "pending").length;

  // Route guard — redirect to admin login if not an admin
  useEffect(() => {
    if (adminUser !== undefined && !adminUser?.isAdmin) {
      setLocation("/admin");
    }
  }, [adminUser, setLocation]);

  const handleLogout = () => {
    logout();
    setLocation("/admin");
  };

  const navItems = [
    { id: "dashboard",    label: "Dashboard",     path: "/admin/dashboard",    icon: LayoutDashboard },
    { id: "moderation",   label: "Moderation",    path: "/admin/moderation",   icon: ShieldAlert },
    { id: "reported",     label: "Reported",      path: "/admin/reported",     icon: AlertTriangle,  badge: pendingReports },
    { id: "users",        label: "Users",         path: "/admin/users",        icon: Users },
    { id: "creators",     label: "Creators",      path: "/admin/creators",     icon: BadgeCheck },
    { id: "earnings",     label: "Earnings",      path: "/admin/earnings",     icon: DollarSign },
    { id: "transactions", label: "Transactions",  path: "/admin/transactions", icon: Activity },
    { id: "live",         label: "Live Mehfils",  path: "/admin/live",         icon: Radio },
    { id: "ai",           label: "AI Tools",      path: "/admin/ai",           icon: Sparkles },
    { id: "logs",         label: "Audit Logs",    path: "/admin/logs",         icon: FileText },
    { id: "settings",     label: "Settings",      path: "/admin/settings",     icon: Settings },
  ];

  return (
    <div className="min-h-[100dvh] w-full flex bg-[#111] text-[#F5F3EF] font-sans">
      {/* Sidebar */}
      <div className="w-60 border-r border-[#2A2A2A] flex flex-col bg-[#0D0D0D] shrink-0">
        {/* Logo + brand */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-[#2A2A2A]">
          <img src="/logo.png" alt="" className="w-7 h-7 object-contain" />
          <div>
            <div className="font-['Playfair_Display'] text-[15px] italic text-[#F5F3EF] leading-none">Mo Katha</div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-[#A0A0A0] mt-0.5">Admin Console</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.startsWith(item.path);
            return (
              <Link key={item.id} href={item.path}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] cursor-pointer transition-colors relative ${isActive ? "bg-[#6BAE8A]/15 text-[#6BAE8A]" : "text-[#A0A0A0] hover:text-[#F5F3EF] hover:bg-[#1E1E1E]"}`}>
                  <item.icon size={15} strokeWidth={isActive ? 2.5 : 1.75} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span className="min-w-[18px] h-[18px] rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center px-1">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-[#2A2A2A] space-y-1">
          {adminUser && (
            <div className="flex items-center gap-3 px-3 py-2">
              <img src={adminUser.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-[#333]" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-[#F5F3EF] truncate">{adminUser.displayName}</div>
                <div className="text-[9px] text-[#A0A0A0] uppercase tracking-[0.1em]">Administrator</div>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-[#A0A0A0] hover:text-destructive hover:bg-destructive/5 transition-colors w-full text-left">
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-16 flex items-center justify-between px-8 border-b border-[#2A2A2A] bg-[#0D0D0D]/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            {pendingReports > 0 && (
              <Link href="/admin/reported">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-[12px] cursor-pointer hover:bg-destructive/15 transition-colors">
                  <AlertTriangle size={13} />
                  {pendingReports} pending report{pendingReports !== 1 ? "s" : ""}
                </div>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[12px] text-[#A0A0A0]">
              {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
            </div>
            <div className="w-px h-4 bg-[#2A2A2A]" />
            <div className="text-[12px] text-[#F5F3EF]">{adminUser?.displayName ?? "Admin"}</div>
            {adminUser && (
              <img src={adminUser.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-[#333]" />
            )}
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-8 bg-[#111]">
          {children}
        </div>
      </div>
    </div>
  );
}
