import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { StoryRing } from "@/lib/store";
import { useUser } from "@/lib/store";
import { FEED_BG, FEED_GOLD, FEED_MUTED, formatFeedTime } from "./home-feed-ui";

type StoryViewerProps = {
  rings: StoryRing[];
  startUserId: string;
  onClose: () => void;
};

function StorySlide({ story, onNext }: { story: StoryRing["stories"][0]; onNext: () => void }) {
  const remaining = Math.max(0, new Date(story.expiresAt).getTime() - Date.now());
  const hoursLeft = Math.ceil(remaining / 3_600_000);

  return (
    <div className="relative w-full h-full flex flex-col" onClick={onNext}>
      {story.mediaType === "video" ? (
        <video src={story.mediaUrl} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline loop />
      ) : (
        <img src={story.mediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent 35%)" }} />
      <div className="relative mt-safe-top px-4 pt-4 flex items-center justify-between">
        <span className="text-[10px] font-['Inter'] text-white/70">{formatFeedTime(story.createdAt)}</span>
        <span className="text-[10px] font-['Inter'] text-white/50">{hoursLeft}h left</span>
      </div>
    </div>
  );
}

function UserStoryProgress({ total, index }: { total: number; index: number }) {
  return (
    <div className="flex gap-1 px-4 pt-3">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex-1 h-[2px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.25)" }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ background: FEED_GOLD, width: i < index ? "100%" : i === index ? "55%" : "0%" }}
          />
        </div>
      ))}
    </div>
  );
}

export function StoryViewer({ rings, startUserId, onClose }: StoryViewerProps) {
  const ringIndex = Math.max(0, rings.findIndex((r) => r.userId === startUserId));
  const [activeRing, setActiveRing] = useState(ringIndex);
  const [activeStory, setActiveStory] = useState(0);

  const ring = rings[activeRing];
  const { data: author } = useUser(ring?.userId ?? "");
  const story = ring?.stories[activeStory];

  useEffect(() => {
    setActiveRing(ringIndex);
    setActiveStory(0);
  }, [startUserId, ringIndex]);

  const goNext = () => {
    if (!ring) return;
    if (activeStory < ring.stories.length - 1) {
      setActiveStory((s) => s + 1);
      return;
    }
    if (activeRing < rings.length - 1) {
      setActiveRing((r) => r + 1);
      setActiveStory(0);
      return;
    }
    onClose();
  };

  const goPrev = () => {
    if (activeStory > 0) {
      setActiveStory((s) => s - 1);
      return;
    }
    if (activeRing > 0) {
      const prev = rings[activeRing - 1];
      setActiveRing((r) => r - 1);
      setActiveStory(Math.max(0, (prev?.stories.length ?? 1) - 1));
    }
  };

  if (!ring || !story) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{ background: FEED_BG }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <UserStoryProgress total={ring.stories.length} index={activeStory} />

      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <img src={author?.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-white/20" />
          <div className="min-w-0">
            <div className="text-[13px] font-['Inter'] text-white truncate">{author?.displayName}</div>
            <div className="text-[10px] font-['Inter']" style={{ color: FEED_MUTED }}>Story</div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)" }}>
          <X size={18} className="text-white" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden rounded-t-2xl mx-1 mb-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={story.id}
            className="absolute inset-0"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
          >
            <StorySlide story={story} onNext={goNext} />
          </motion.div>
        </AnimatePresence>

        <button type="button" className="absolute left-0 top-0 bottom-0 w-1/3" aria-label="Previous" onClick={goPrev} />
        <button type="button" className="absolute right-0 top-0 bottom-0 w-1/3" aria-label="Next" onClick={goNext} />

        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-6 pointer-events-none">
          <ChevronLeft size={20} className="text-white/30" />
          <ChevronRight size={20} className="text-white/30" />
        </div>
      </div>
    </motion.div>
  );
}

export function useStoryViewerState(rings: StoryRing[]) {
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const open = (userId: string) => setViewUserId(userId);
  const close = () => setViewUserId(null);
  const activeRings = useMemo(() => rings.filter((r) => r.stories.length > 0), [rings]);
  return { viewUserId, open, close, activeRings };
}
