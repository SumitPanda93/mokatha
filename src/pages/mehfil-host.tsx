import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { PrepareMehfilForm } from "@/features/mehfil/PrepareMehfilForm";

/**
 * Creation shell at /mehfil/host/new; existing sessions redirect to the unified LiveKit room.
 */
export default function MehfilHost() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (id && id !== "new") {
      setLocation(`/mehfil/${id}`, { replace: true });
    }
  }, [id, setLocation]);

  if (!id || id === "new") return <PrepareMehfilForm />;

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#0a0609]">
      <p className="text-[13px] text-white/50 font-['Inter']">Opening mehfil…</p>
    </div>
  );
}
