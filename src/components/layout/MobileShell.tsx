import React from "react";
import { Link, useLocation } from "wouter";
import { Home, Plus, MessageCircle, User, Radio } from "lucide-react";
import { motion } from "framer-motion";

interface MobileShellProps {
  children: React.ReactNode;
}

export default function MobileShell({ children }: MobileShellProps) {
  const [location] = useLocation();

  const navItems = [
    { id: "home",     label: "Home",     path: "/",         icon: Home },
    { id: "mehfil",   label: "Mehfil",   path: "/mehfil",   icon: Radio },
    { id: "create",   label: "Create",   path: "/create",   icon: Plus, isCreate: true },
    { id: "messages", label: "Messages", path: "/messages", icon: MessageCircle },
    { id: "profile",  label: "Profile",  path: "/me",       icon: User },
  ];

  const isActive = (path: string) =>
    path === "/" ? location === "/" || location === "/home" : location.startsWith(path);

  return (
    <div className="w-full h-full flex flex-col relative bg-background text-foreground">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pb-24">
        {children}
      </div>

      {/* Bottom nav */}
      <div className="absolute bottom-0 w-full bg-background/95 backdrop-blur-md border-t border-border z-50">
        <div className="flex justify-between items-center px-5 pt-3 pb-6">
          {navItems.map((item) => {
            const active = isActive(item.path);

            if (item.isCreate) {
              return (
                <Link key={item.id} href={item.path}>
                  <div className="relative -top-5">
                    <motion.div
                      whileTap={{ scale: 0.88 }}
                      className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl"
                      style={{
                        background: "linear-gradient(135deg, hsl(var(--terracotta)), hsl(var(--ochre)))",
                        boxShadow: "0 12px 32px rgba(247,106,74,0.4)",
                      }}
                    >
                      <Plus size={26} className="text-white" strokeWidth={2} />
                    </motion.div>
                  </div>
                </Link>
              );
            }

            return (
              <Link key={item.id} href={item.path}>
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${active ? "text-terracotta" : "text-muted-foreground"}`}
                >
                  <item.icon
                    size={22}
                    strokeWidth={active ? 2.25 : 1.5}
                    className={active ? "text-terracotta" : ""}
                  />
                  <span className={`text-[9px] font-['Inter'] tracking-[0.05em] ${active ? "font-semibold text-terracotta" : ""}`}>
                    {item.label}
                  </span>
                  {active && (
                    <motion.div
                      layoutId="nav-dot"
                      className="w-1 h-1 rounded-full bg-terracotta"
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
