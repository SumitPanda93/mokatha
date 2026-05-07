import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useTitle } from "@/hooks/useTitle";

export default function Splash() {
  useTitle("Mo Katha");
  const [, setLocation] = useLocation();

  useEffect(() => {
    const t = setTimeout(() => setLocation("/onboarding"), 2800);
    return () => clearTimeout(t);
  }, [setLocation]);

  return (
    <div className="w-full h-[100dvh] bg-[#0A0806] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient glow behind logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 0.35, scale: 1 }}
        transition={{ duration: 2.4, ease: "easeOut" }}
        className="absolute w-[340px] h-[340px] rounded-full blur-[80px]"
        style={{ background: "radial-gradient(circle, #C9A84C 0%, transparent 70%)" }}
      />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center gap-6"
      >
        <img
          src="/logo.png"
          alt="Mo Katha"
          className="w-[240px] h-[240px] object-contain drop-shadow-2xl"
          draggable={false}
        />
      </motion.div>

      {/* Loading dots */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
        className="absolute bottom-16 flex gap-1.5"
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]/60"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </motion.div>
    </div>
  );
}
