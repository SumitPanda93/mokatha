import type { ReactNode } from "react";
import type { FeedTile } from "./home-feed-ui";

type MasonryFeedProps = {
  tiles: FeedTile[];
  gapPx: number;
  renderTile: (tile: FeedTile) => ReactNode;
};

export function MasonryFeed({ tiles, gapPx, renderTile }: MasonryFeedProps) {
  return (
    <div
      className="w-full"
      style={{
        columnCount: 2,
        columnGap: gapPx,
      }}
    >
      {tiles.map((tile) => {
        const key = tile.kind === "mehfil" ? `m-${tile.mehfil.id}` : `p-${tile.post.id}`;
        const isHero = tile.kind === "post" && tile.size === "hero";
        return (
          <div
            key={key}
            className="break-inside-avoid"
            style={{
              marginBottom: gapPx,
              ...(isHero ? { columnSpan: "all" as const } : {}),
            }}
          >
            {renderTile(tile)}
          </div>
        );
      })}
    </div>
  );
}
