import { Link, useLocation } from "wouter";
import { ArrowLeft, User, Lock, Bell, Info, ChevronRight, LogOut, Languages, Moon } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useCurrentUser, logout } from "@/lib/store";

const sections = [
  { title: "Account", items: [
    { icon: User, label: "Profile", to: "/settings/account", hint: "Name, handle, photo" },
    { icon: Lock, label: "Privacy & safety", to: "/settings/privacy", hint: "Who can find you, blocks" },
  ]},
  { title: "Preferences", items: [
    { icon: Bell, label: "Notifications", to: "/settings/notifications", hint: "What pings you" },
    { icon: Info, label: "About Mo Katha", to: "/settings/about", hint: "Help, terms, privacy" },
  ]},
];

export default function SettingsHome() {
  useTitle("Settings");
  const [, setLocation] = useLocation();
  const { data: user } = useCurrentUser();

  return (
    <div className="min-h-screen w-full bg-background pb-10">
      <div className="px-5 py-3 flex items-center gap-3 sticky top-0 bg-background/85 backdrop-blur-md z-20">
        <button onClick={() => setLocation("/me")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><ArrowLeft size={16} /></button>
        <div className="font-['Playfair_Display'] text-[20px]">Settings</div>
      </div>

      {user && (
        <div className="px-5 mt-2">
          <Link href="/settings/account" className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border">
            <img src={user.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
            <div className="flex-1">
              <div className="text-[14px] font-medium">{user.displayName}</div>
              <div className="text-[11px] text-muted-foreground">@{user.handle}</div>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </Link>
        </div>
      )}

      <div className="px-5 mt-5 space-y-5">
        {sections.map((sec) => (
          <div key={sec.title}>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">{sec.title}</div>
            <div className="bg-card border border-border rounded-2xl divide-y divide-border">
              {sec.items.map((it) => (
                <Link key={it.label} href={it.to} className="flex items-center gap-3 px-4 py-3.5">
                  <it.icon size={16} className="text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-[13.5px]">{it.label}</div>
                    <div className="text-[11px] text-muted-foreground">{it.hint}</div>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Quick</div>
          <div className="bg-card border border-border rounded-2xl divide-y divide-border">
            <div className="flex items-center gap-3 px-4 py-3.5"><Languages size={16} className="text-muted-foreground" /><div className="flex-1 text-[13.5px]">Reading language</div><span className="text-[12px] text-muted-foreground">ଓଡ଼ିଆ</span></div>
            <div className="flex items-center gap-3 px-4 py-3.5"><Moon size={16} className="text-muted-foreground" /><div className="flex-1 text-[13.5px]">Theme</div><span className="text-[12px] text-muted-foreground">Paper</span></div>
          </div>
        </div>

        <button onClick={() => { logout(); setLocation("/login"); }} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-border text-destructive text-[13px]">
          <LogOut size={14} /> Sign out
        </button>

        <div className="text-center text-[10px] text-muted-foreground pt-3">Mo Katha · v1.0 · Made with care in Bhubaneswar</div>
      </div>
    </div>
  );
}
