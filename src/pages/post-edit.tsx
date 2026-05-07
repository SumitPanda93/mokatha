import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, Lock } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { usePost, useUpdatePost, getCurrentUserId } from "@/lib/store";
import { toast } from "sonner";

const ACCESS_OPTIONS = [
  { value: "free",    label: "Free",    desc: "Anyone can read" },
  { value: "tip",     label: "Tip to read", desc: "Readers tip to unlock" },
  { value: "premium", label: "Premium", desc: "Subscribers only" },
] as const;

export default function PostEdit() {
  useTitle("Edit Post");
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const me = getCurrentUserId();
  const { data: post, isLoading } = usePost(id ?? "");
  const update = useUpdatePost();

  const [title, setTitle]         = useState("");
  const [body, setBody]           = useState("");
  const [tags, setTags]           = useState("");
  const [accessType, setAccess]   = useState<string>("free");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loaded, setLoaded]       = useState(false);

  useEffect(() => {
    if (post && !loaded) {
      setTitle(post.title ?? "");
      setBody(post.body ?? "");
      setTags((post.tags ?? []).join(", "));
      setAccess(post.accessType ?? "free");
      setIsPrivate(post.isPrivate ?? false);
      setLoaded(true);
    }
  }, [post, loaded]);

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-terracotta border-t-transparent animate-spin" />
    </div>
  );

  if (!post) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-[13px]">Post not found.</div>
  );

  if (post.authorId !== me) {
    toast.error("Not authorised");
    setLocation("/");
    return null;
  }

  const handleSave = () => {
    if (!title.trim()) { toast.error("Title cannot be empty"); return; }
    update.mutate(
      {
        postId: id!,
        patch: {
          title: title.trim(),
          body: body.trim(),
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          accessType,
          isPrivate,
        },
      },
      { onSuccess: () => setLocation(`/post/${id}`) },
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-5 py-3 flex items-center gap-3 sticky top-0 bg-background/90 backdrop-blur-md z-20 border-b border-border">
        <button onClick={() => setLocation(`/post/${id}`)} className="w-9 h-9 rounded-full border border-border flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 font-['Playfair_Display'] text-[18px]">Edit Post</div>
        <button
          onClick={handleSave}
          disabled={update.isPending}
          className="text-[13px] font-['Inter'] font-medium px-5 py-2 rounded-full bg-foreground text-background disabled:opacity-50"
        >
          {update.isPending ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="px-5 mt-5 space-y-5">
        {/* Title */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Title</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Story title…"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[15px] font-['Playfair_Display'] outline-none focus:border-terracotta text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Body */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Content</div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Your story…"
            rows={8}
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[14px] font-['Playfair_Display'] outline-none focus:border-terracotta resize-none text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Tags */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Tags (comma-separated)</div>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="poetry, love, urdu"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[13px] outline-none focus:border-terracotta text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Access type */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Access</div>
          <div className="grid grid-cols-3 gap-2">
            {ACCESS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setAccess(opt.value)}
                className={`py-3 px-2 rounded-xl border text-center transition-colors ${
                  accessType === opt.value ? "border-terracotta bg-terracotta/8" : "border-border"
                }`}
              >
                <div className="text-[12px] font-medium">{opt.label}</div>
                <div className="text-[9px] text-muted-foreground mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Visibility toggle */}
        <motion.div
          onClick={() => setIsPrivate((p) => !p)}
          className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
            isPrivate ? "border-plum bg-plum/8" : "border-border"
          }`}
        >
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isPrivate ? "bg-plum/15" : "bg-muted"}`}>
            {isPrivate ? <Lock size={16} className="text-plum" /> : <Eye size={16} className="text-muted-foreground" />}
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-medium">{isPrivate ? "Private" : "Public"}</div>
            <div className="text-[11px] text-muted-foreground">{isPrivate ? "Only you can see this post" : "Visible to everyone"}</div>
          </div>
          <div className={`w-10 h-5.5 rounded-full transition-colors relative ${isPrivate ? "bg-plum" : "bg-border"}`}
            style={{ height: "22px" }}>
            <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${isPrivate ? "translate-x-[22px]" : "translate-x-[3px]"}`} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
