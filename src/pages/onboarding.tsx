import React from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useTitle } from "@/hooks/useTitle";

export default function Onboarding() {
  useTitle("Welcome");
  useLocation();

  return (
    <div className="min-h-screen w-full flex items-start justify-center bg-[#0F0A14] p-0">
      <style>{`
        @keyframes onb-drift1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-20px) scale(1.15); } }
        @keyframes onb-drift2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-25px,30px) scale(1.1); } }
        @keyframes onb-drift3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(20px,25px) scale(1.2); } }
        @keyframes onb-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes onb-pulse-soft { 0%,100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        @keyframes onb-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes onb-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>

      <div className="w-full h-[100dvh] overflow-hidden relative flex flex-col"
           style={{ background: 'radial-gradient(ellipse at 30% 20%, #2A1638 0%, #0F0A14 60%, #050308 100%)' }}>

        {/* Floating color orbs */}
        <div className="absolute top-[60px] -left-12 w-[280px] h-[280px] rounded-full"
             style={{ background: 'radial-gradient(circle, #F76A4A, transparent 70%)', opacity: 0.45, filter: 'blur(40px)', animation: 'onb-drift1 8s ease-in-out infinite' }} />
        <div className="absolute top-[180px] -right-16 w-[260px] h-[260px] rounded-full"
             style={{ background: 'radial-gradient(circle, #6A5AE0, transparent 70%)', opacity: 0.50, filter: 'blur(45px)', animation: 'onb-drift2 9s ease-in-out infinite' }} />
        <div className="absolute bottom-[120px] left-1/2 -translate-x-1/2 w-[320px] h-[200px] rounded-full"
             style={{ background: 'radial-gradient(circle, #E8B14A, transparent 70%)', opacity: 0.30, filter: 'blur(50px)', animation: 'onb-drift3 10s ease-in-out infinite' }} />

        {/* Tiny floating sparkles */}
        <div className="absolute top-[120px] left-[80px] w-1 h-1 rounded-full bg-[#E8B14A]" style={{ animation: 'onb-pulse-soft 2.4s ease-in-out infinite' }} />
        <div className="absolute top-[200px] right-[90px] w-1.5 h-1.5 rounded-full bg-[#F76A4A]" style={{ animation: 'onb-pulse-soft 3s ease-in-out infinite 0.5s' }} />
        <div className="absolute top-[340px] right-[60px] w-1 h-1 rounded-full bg-[#6A5AE0]" style={{ animation: 'onb-pulse-soft 2.8s ease-in-out infinite 1s' }} />

        {/* Top brand row */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="flex flex-col items-center mt-12 relative z-10"
        >
          <div className="relative w-[64px] h-[64px] flex items-center justify-center">
            <div className="absolute inset-0 rounded-full p-[2px]"
                 style={{ background: 'conic-gradient(from 0deg, #F76A4A, #E8B14A, #B14A8B, #6A5AE0, #F76A4A)', animation: 'onb-spin-slow 8s linear infinite' }}>
              <div className="w-full h-full rounded-full" style={{ background: '#0F0A14' }} />
            </div>
            <div className="relative z-10 text-[26px] font-['Playfair_Display'] italic text-[#F5F3EF]">ମ</div>
          </div>
          <div className="mt-3 text-[10px] font-['Inter'] tracking-[0.4em] uppercase text-[#E8B14A] font-medium">
            MO KATHA
          </div>
        </motion.div>

        {/* Hero typography */}
        <div className="flex-1 flex flex-col justify-center items-center text-center px-7 relative z-10 -mt-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-[15px] font-['Playfair_Display'] italic text-[#F5F3EF]/60 mb-3"
          >
            Your words deserve space.
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="text-[42px] leading-[1.1] font-['Playfair_Display'] font-light text-[#F5F3EF]"
          >
            This is your<br />
            <span className="italic font-normal text-transparent bg-clip-text inline-block"
                  style={{
                    backgroundImage: 'linear-gradient(90deg, #F76A4A, #E8B14A, #B14A8B, #F76A4A)',
                    backgroundSize: '200% auto',
                    animation: 'onb-shimmer 4s linear infinite',
                  }}>
              quiet place.
            </span>
          </motion.div>

          {/* Mini live preview */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-8 px-4 py-3 rounded-2xl border border-[#F5F3EF]/10 bg-[#F5F3EF]/[0.04] backdrop-blur-md w-full max-w-[300px]"
          >
            <div className="flex items-center gap-1.5 text-[9px] font-['Inter'] tracking-[0.2em] uppercase text-[#E8B14A] mb-1.5">
              <span className="w-1 h-1 rounded-full bg-[#E8B14A]" />
              JUST PUBLISHED
            </div>
            <div className="text-[14px] font-['Playfair_Display'] italic text-[#F5F3EF]/90 leading-snug">
              "The hour before the world wakes…"
            </div>
            <div className="text-[10px] font-['Inter'] text-[#F5F3EF]/50 mt-1">— Subhasree, just now</div>
          </motion.div>
        </div>

        {/* CTA */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="px-7 pb-10 flex flex-col items-center gap-4 relative z-10"
        >
          <Link href="/auth/signup" className="w-full text-center text-[16px] font-['Inter'] font-medium text-[#0F0A14] rounded-full py-4 relative overflow-hidden shadow-2xl block"
                  style={{
                    background: 'linear-gradient(90deg, #F76A4A, #E8B14A, #F76A4A)',
                    backgroundSize: '200% auto',
                    animation: 'onb-shimmer 3s linear infinite',
                    boxShadow: '0 12px 32px rgba(247,106,74,0.45), inset 0 1px 0 rgba(255,255,255,0.4)',
                  }}>
            Enter Mo Katha →
          </Link>
          
          <div className="flex items-center gap-2 text-[12px] font-['Inter'] text-[#F5F3EF]/60">
            <span>Already have an account?</span>
            <Link href="/auth/login" className="text-[#E8B14A] font-medium hover:underline">Log in</Link>
          </div>

          <button
            onClick={() => (window.location.href = "/auth/login")}
            className="text-[12px] font-['Inter'] text-[#F5F3EF]/40 hover:text-[#F5F3EF]/70 transition-colors underline underline-offset-2"
          >
            Continue to sign in
          </button>

          {/* Marquee */}
          <div className="w-[120%] -mx-6 mt-4 overflow-hidden" style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}>
            <div className="flex gap-6 text-[11px] font-['Playfair_Display'] italic text-[#F5F3EF]/35 whitespace-nowrap"
                 style={{ animation: 'onb-marquee 30s linear infinite', width: 'max-content' }}>
              {[
                'reflection', '·', 'memory', '·', 'devotion', '·', 'longing', '·', 'mehfil', '·', 'ghazals', '·', 'silence', '·', 'rain', '·', 'evening', '·',
                'reflection', '·', 'memory', '·', 'devotion', '·', 'longing', '·', 'mehfil', '·', 'ghazals', '·', 'silence', '·', 'rain', '·', 'evening', '·'
              ].map((w, i) => <span key={i}>{w}</span>)}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
