import { useState, useCallback } from "react";
import { Link } from "wouter";
import { Search as SearchIcon, ArrowLeft, TrendingUp, Mic, FileText, BookOpen, Film, Radio } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTitle } from "@/hooks/useTitle";
import { useSearch, useUser } from "@/lib/store";

const KIND_ICON: Record<string, React.ComponentType<any>> = {
  voice: Mic, text: FileText, story: BookOpen, reel: Film,
};
const KIND_COLOR: Record<string, string> = {
  voice: "bg-ochre", text: "bg-sage", story: "bg-violet", reel: "bg-plum",
};

const TRENDING_TAGS = ["#ghazal", "#rain", "#odiapoetry", "#memories", "#midnight", "#kavita", "#nataraja"];

function PostResult({ post }: { post: any }) {
  const { data: author } = useUser(post.authorId);
  const Icon = KIND_ICON[post.kind] ?? FileText;
  return (
    <Link href={`/post/${post.id}`}>
      <div className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-black/5 -mx-2 px-2 rounded-xl transition-colors">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${KIND_COLOR[post.kind] ?? "bg-muted"}`}>
          <Icon size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-['Playfair_Display'] text-foreground truncate">{post.title}</div>
          <div className="text-[11px] font-['Inter'] text-muted-foreground">{author?.displayName ?? "—"} · {post.kind}</div>
        </div>
      </div>
    </Link>
  );
}

export default function Search() {
  useTitle("Search");
  const [query, setQuery] = useState("");
  const { data: results } = useSearch(query);

  const hasResults = query.trim().length > 0 && results;
  const totalResults = hasResults ? (results.users.length + results.posts.length + results.mehfils.length + results.tags.length) : 0;

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground">
      {/* Search bar */}
      <div className="px-4 py-4 flex items-center gap-3 sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border/50">
        <Link href="/" className="p-2 -ml-1 rounded-full hover:bg-black/5 shrink-0">
          <ArrowLeft size={22} className="text-foreground" />
        </Link>
        <div className="flex-1 relative">
          <SearchIcon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search poets, posts, mehfils, tags..."
            className="w-full bg-black/5 rounded-full py-2.5 pl-9 pr-4 text-[14px] font-['Inter'] text-foreground focus:outline-none focus:ring-1 focus:ring-terracotta transition-all"
            autoFocus
          />
        </div>
        {query && (
          <button onClick={() => setQuery("")} className="text-[12px] text-muted-foreground hover:text-foreground shrink-0">
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 px-5 pt-4 pb-24">
        <AnimatePresence mode="wait">
          {!hasResults ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Trending tags */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={13} className="text-terracotta" />
                  <span className="text-[10px] font-['Inter'] tracking-[0.2em] uppercase text-muted-foreground font-medium">Trending Tags</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TRENDING_TAGS.map((tag) => (
                    <button key={tag} onClick={() => setQuery(tag.slice(1))}
                      className="text-[12px] font-['Inter'] text-violet border border-violet/30 bg-violet/5 rounded-full px-3 py-1.5 hover:bg-violet/10 transition-colors">
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search prompts */}
              <div className="space-y-3">
                {[
                  { label: "Voice posts", q: "voice" },
                  { label: "Odia poetry", q: "kavita" },
                  { label: "Ghazal", q: "ghazal" },
                  { label: "Live mehfils", q: "mehfil" },
                ].map((item) => (
                  <button key={item.q} onClick={() => setQuery(item.q)}
                    className="w-full flex items-center gap-3 py-2.5 text-left group">
                    <SearchIcon size={14} className="text-muted-foreground group-hover:text-terracotta transition-colors" />
                    <span className="text-[14px] font-['Inter'] text-muted-foreground group-hover:text-foreground transition-colors">{item.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div key="results" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="text-[11px] font-['Inter'] text-muted-foreground mb-4">
                {totalResults} result{totalResults !== 1 ? "s" : ""} for <span className="text-foreground font-medium">"{query}"</span>
              </div>

              {/* Tags */}
              {results.tags.length > 0 && (
                <div className="mb-6">
                  <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">Tags</div>
                  <div className="flex flex-wrap gap-2">
                    {results.tags.map((tag) => (
                      <button key={tag} onClick={() => setQuery(tag)}
                        className="text-[12px] font-['Inter'] text-violet border border-violet/30 bg-violet/5 rounded-full px-3 py-1.5 hover:bg-violet/10 transition-colors">
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Users */}
              {results.users.length > 0 && (
                <div className="mb-6">
                  <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">Voices</div>
                  <div className="space-y-1">
                    {results.users.map((u: any) => (
                      <Link key={u.id} href={`/u/${u.handle}`}>
                        <div className="flex items-center gap-3 py-2 cursor-pointer hover:bg-black/5 -mx-2 px-2 rounded-xl transition-colors">
                          <img src={u.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-border shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-['Playfair_Display'] text-foreground">{u.displayName}</div>
                            <div className="text-[11px] font-['Inter'] text-muted-foreground">@{u.handle} · {u.followers.toLocaleString()} followers</div>
                          </div>
                          {u.verified && <div className="w-2 h-2 rounded-full bg-ochre shrink-0" />}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Mehfils */}
              {results.mehfils.length > 0 && (
                <div className="mb-6">
                  <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">Mehfils</div>
                  <div className="space-y-2">
                    {results.mehfils.map((m: any) => (
                      <Link key={m.id} href={`/mehfil/${m.id}`}>
                        <div className="flex items-center gap-3 py-2 cursor-pointer hover:bg-black/5 -mx-2 px-2 rounded-xl transition-colors">
                          <div className="relative shrink-0">
                            <img src={m.coverUrl} alt="" className="w-10 h-10 rounded-xl object-cover" />
                            {m.isLive && <div className="absolute -top-1 -right-1 text-[7px] bg-destructive text-white rounded-sm px-1 font-bold">LIVE</div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-['Playfair_Display'] text-foreground truncate">{m.title}</div>
                            <div className="text-[11px] font-['Inter'] text-muted-foreground">{m.listeners} listening</div>
                          </div>
                          <Radio size={14} className="text-muted-foreground shrink-0" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Posts */}
              {results.posts.length > 0 && (
                <div className="mb-6">
                  <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">Posts</div>
                  <div className="space-y-1">
                    {results.posts.map((p: any) => <PostResult key={p.id} post={p} />)}
                  </div>
                </div>
              )}

              {totalResults === 0 && (
                <div className="text-center py-12">
                  <div className="text-[14px] font-['Playfair_Display'] italic text-muted-foreground">No results found</div>
                  <div className="text-[12px] font-['Inter'] text-muted-foreground/60 mt-1">Try a different word or tag</div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
