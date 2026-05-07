import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Wand2, Languages, ShieldQuestion, RefreshCw } from "lucide-react";
import AdminShell from "@/components/layout/AdminShell";
import { useTitle } from "@/hooks/useTitle";

const TOOLS = [
  { id: "moderate", icon: ShieldQuestion, title: "Auto-moderation", hint: "Flag posts for hate, harm or copyright." },
  { id: "translate", icon: Languages, title: "Translate", hint: "Suggest Hindi <> Odia readings." },
  { id: "summarise", icon: Wand2, title: "Summarise", hint: "One-line essence for long stories." },
  { id: "tag", icon: Sparkles, title: "Auto-tags", hint: "Pick mood and theme tags." },
];

const SAMPLE = "ବର୍ଷା ପୁଣି ଆସିଛି।\nଖିଡ଼ିକି ବାଟେ ଶୁଣ —\nଚା'ର ବାଷ୍ପ ଆଉ\nମା'ଙ୍କ ଗୀତ।";

export default function AdminAI() {
  useTitle("Admin · AI tools");
  const [tool, setTool] = useState("moderate");
  const [input, setInput] = useState(SAMPLE);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = () => {
    setRunning(true); setResult(null);
    setTimeout(() => {
      const out =
        tool === "moderate" ? { verdict: "safe", confidence: 0.94, flags: [] } :
        tool === "translate" ? { hindi: "बारिश फिर आ गई है।\nखिड़की से सुनो —\nचाय की भाप\nऔर माँ का गीत।" } :
        tool === "summarise" ? { line: "An evening rain that brings tea-steam and a mother's song to the window." } :
        { tags: ["rain", "memory", "mother", "evening", "monsoon"] };
      setResult(out); setRunning(false);
    }, 900);
  };

  return (
    <AdminShell>
      <div className="font-['Playfair_Display'] text-[28px] mb-1">AI tools</div>
      <div className="text-[12px] text-[#A0A0A0] mb-7">Helpers, not judges. Final calls stay with editors.</div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {TOOLS.map((t) => (
          <motion.button whileTap={{ scale: 0.97 }} key={t.id} onClick={() => { setTool(t.id); setResult(null); }} className={`text-left p-4 rounded-2xl border transition-colors ${tool === t.id ? "border-sage bg-sage/10" : "border-[#2A2A2A] bg-[#141414] hover:border-[#3A3A3A]"}`}>
            <t.icon size={18} className={tool === t.id ? "text-sage" : "text-[#A0A0A0]"} />
            <div className="text-[14px] mt-2">{t.title}</div>
            <div className="text-[11px] text-[#A0A0A0] mt-0.5">{t.hint}</div>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5">
          <div className="text-[12px] text-[#A0A0A0] uppercase tracking-[0.18em] mb-2">Input</div>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={10} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 text-[14px] outline-none focus:border-sage resize-none font-['Playfair_Display'] leading-[1.7]" />
          <button onClick={run} disabled={running} className="mt-3 w-full py-2.5 rounded-xl bg-sage text-[#0F0A14] text-[13px] flex items-center justify-center gap-2 disabled:opacity-50">
            {running ? <><RefreshCw size={13} className="animate-spin" /> Running…</> : <><Sparkles size={13} /> Run AI</>}
          </button>
        </div>
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5 min-h-[300px]">
          <div className="text-[12px] text-[#A0A0A0] uppercase tracking-[0.18em] mb-2">Result</div>
          {!result && !running && <div className="text-[12px] text-[#A0A0A0] italic">Pick a tool, then run.</div>}
          {running && <div className="text-[12px] text-[#A0A0A0]">Thinking gently…</div>}
          {result && tool === "moderate" && (
            <div>
              <div className="inline-block px-3 py-1 rounded-full bg-sage/15 text-sage text-[12px] mb-3">Verdict · {result.verdict}</div>
              <div className="text-[12px] text-[#A0A0A0]">Confidence {(result.confidence * 100).toFixed(0)}%</div>
              <div className="text-[12px] text-[#A0A0A0] mt-2">No flags raised.</div>
            </div>
          )}
          {result && tool === "translate" && <div className="font-['Playfair_Display'] text-[16px] leading-[1.7] whitespace-pre-line">{result.hindi}</div>}
          {result && tool === "summarise" && <div className="font-['Playfair_Display'] italic text-[16px]">{result.line}</div>}
          {result && tool === "tag" && <div className="flex flex-wrap gap-2">{result.tags.map((t: string) => <span key={t} className="px-2.5 py-1 rounded-full bg-sage/10 text-sage text-[11px]">#{t}</span>)}</div>}
        </div>
      </div>

      <div className="mt-5 text-[10px] text-[#666] text-center">AI suggestions are advisory · all moderation actions are logged with the human reviewer.</div>
    </AdminShell>
  );
}
