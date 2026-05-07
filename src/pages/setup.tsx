import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Copy, Check, AlertTriangle } from "lucide-react";

function CopyBox({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/5">
        <span className="text-[11px] uppercase tracking-[0.15em] text-[#F5F3EF]/50 font-['Inter']">{label}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-[11px] font-['Inter'] text-[#C9A84C]">
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="text-[11px] font-mono text-[#F5F3EF]/80 px-4 py-3 overflow-x-auto leading-relaxed whitespace-pre-wrap bg-[#0A0806]">{code}</pre>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-[#C9A84C] flex items-center justify-center flex-shrink-0">
          <span className="text-[12px] font-bold text-[#0A0806]">{n}</span>
        </div>
        <div className="text-[15px] font-['Playfair_Display'] text-[#F5F3EF]">{title}</div>
      </div>
      <div className="ml-10 space-y-2">{children}</div>
    </div>
  );
}

const DISABLE_RLS = `-- Run in: Supabase Dashboard → SQL Editor → New query

alter table posts disable row level security;
alter table users disable row level security;
alter table mehfils disable row level security;
alter table wallet_balances disable row level security;
alter table ink_rewards disable row level security;
alter table comments disable row level security;
alter table notifications disable row level security;
alter table transactions disable row level security;
alter table saved_posts disable row level security;
alter table post_likes disable row level security;
alter table follows disable row level security;
alter table conversations disable row level security;
alter table messages disable row level security;
alter table reports disable row level security;
alter table admin_logs disable row level security;
alter table author_plans disable row level security;
alter table subscriptions disable row level security;`;

const STORAGE_SQL = `-- Run in: Supabase Dashboard → SQL Editor → New query
-- Creates public avatars bucket for profile photo uploads

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Allow anyone to upload/update/delete their own avatar
create policy "Allow avatar uploads" on storage.objects
  for insert with check (bucket_id = 'avatars');

create policy "Allow avatar updates" on storage.objects
  for update using (bucket_id = 'avatars');

create policy "Allow avatar reads" on storage.objects
  for select using (bucket_id = 'avatars');`;

export default function Setup() {
  const [, setLocation] = useLocation();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string ?? "";
  const projectRef = supabaseUrl.replace("https://", "").split(".")[0];
  const supabaseCallback = `https://${projectRef}.supabase.co/auth/v1/callback`;
  const appUrl = window.location.origin;
  const callbackUrl = `${appUrl}/auth/callback`;
  const wildcardUrl = `${appUrl}/**`;

  return (
    <div className="min-h-screen w-full bg-[#0A0806] text-[#F5F3EF] pb-20">
      <div className="px-5 py-4 flex items-center gap-3 border-b border-white/8">
        <button onClick={() => setLocation("/")} className="p-2 -ml-2 rounded-full hover:bg-white/5">
          <ChevronLeft size={20} className="text-[#F5F3EF]/70" />
        </button>
        <div>
          <div className="text-[16px] font-['Playfair_Display']">Supabase Setup Guide</div>
          <div className="text-[11px] text-[#F5F3EF]/40 font-['Inter']">Fix auth & content posting</div>
        </div>
      </div>

      {/* Most common error callout */}
      <div className="mx-5 mt-5 rounded-xl border border-[#E87777]/30 bg-[#E87777]/8 px-4 py-3 flex gap-3">
        <AlertTriangle size={16} className="text-[#E87777] flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-[12px] font-['Inter'] font-medium text-[#E87777] mb-1">
            "Unable to exchange external code" error?
          </div>
          <div className="text-[11px] text-[#F5F3EF]/60 font-['Inter'] leading-relaxed">
            This means Google is rejecting the code. The fix is Step 1 below — you need to add the Supabase callback URL to Google Cloud Console.
          </div>
        </div>
      </div>

      <div className="px-5 mt-6 space-y-8">

        {/* Step 1: Google Cloud Console */}
        <Step n={1} title="Google Cloud Console — Authorized redirect URI">
          <div className="text-[12px] text-[#F5F3EF]/60 font-['Inter'] leading-relaxed">
            Go to <span className="text-[#F5F3EF]">console.cloud.google.com</span> → APIs & Services → Credentials → your OAuth 2.0 Client → <span className="text-[#F5F3EF]">Authorized redirect URIs</span>.
            <br /><br />
            Add this exact URL (this is the Supabase server URL, NOT your app URL):
          </div>
          <CopyBox code={supabaseCallback} label="Add to Google Cloud Console → Authorized redirect URIs" />
          <div className="text-[11px] text-[#F5F3EF]/40 font-['Inter'] leading-relaxed">
            ⚠️ Do not add the Replit URL here. Google redirects to Supabase first, then Supabase redirects to your app.
          </div>
        </Step>

        {/* Step 2: Supabase Redirect URLs */}
        <Step n={2} title="Supabase — Redirect URL allowlist">
          <div className="text-[12px] text-[#F5F3EF]/60 font-['Inter'] leading-relaxed">
            Go to <span className="text-[#F5F3EF]">Supabase Dashboard</span> → Authentication → URL Configuration.
            <br />Set <span className="text-[#F5F3EF]">Site URL</span> and add both Redirect URLs:
          </div>
          <div className="space-y-2">
            <CopyBox code={appUrl} label="Site URL" />
            <CopyBox code={`${callbackUrl}\n${wildcardUrl}`} label="Redirect URLs — add both lines" />
          </div>
        </Step>

        {/* Step 3: Disable RLS */}
        <Step n={3} title="Supabase — Enable content posting">
          <div className="text-[12px] text-[#F5F3EF]/60 font-['Inter'] leading-relaxed">
            Go to <span className="text-[#F5F3EF]">Supabase Dashboard</span> → SQL Editor → New query.
            <br />Run this to allow posts, mehfils and all writes:
          </div>
          <CopyBox code={DISABLE_RLS} label="SQL Editor — paste and run" />
        </Step>

        {/* Step 4: Storage bucket */}
        <Step n={4} title="Supabase — Enable profile photo uploads">
          <div className="text-[12px] text-[#F5F3EF]/60 font-['Inter'] leading-relaxed">
            Run this in SQL Editor to create the public avatars storage bucket:
          </div>
          <CopyBox code={STORAGE_SQL} label="SQL Editor — avatars bucket" />
        </Step>

      </div>

      <div className="px-5 mt-10">
        <button
          onClick={() => setLocation("/auth/login")}
          className="w-full py-4 rounded-2xl text-[14px] font-['Inter'] font-medium text-[#0A0806]"
          style={{ background: "linear-gradient(135deg, #C9A84C, #E8C97A)" }}
        >
          Try signing in again
        </button>
      </div>
    </div>
  );
}
