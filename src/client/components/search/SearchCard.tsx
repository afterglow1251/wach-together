import { Bookmark } from "lucide-solid"
import type { SearchResultItem } from "../../../shared/types"

const CATEGORY_COLORS: Record<string, string> = {
  film: "bg-pink-600",
  series: "bg-indigo-600",
  cartoon: "bg-amber-600",
  anime: "bg-violet-600",
}

const CATEGORY_LABELS: Record<string, string> = {
  film: "Film",
  series: "Series",
  cartoon: "Cartoon",
  anime: "Anime",
}

export default function SearchCard(props: {
  item: SearchResultItem
  onClick: () => void
  onBookmark?: (e: MouseEvent) => void
  inLibrary?: boolean
}) {
  const poster = () => (props.item.poster ? `/api/poster-proxy?url=${encodeURIComponent(props.item.poster)}` : "")

  return (
    <div
      class="relative rounded-[10px] overflow-hidden bg-card border border-border cursor-pointer transition-all hover:shadow-[0_4px_16px_rgba(232,67,147,0.12)] group"
      onClick={() => props.onClick()}
    >
      {/* Top-left: category + rating stacked */}
      <div class="absolute top-2 left-2 flex flex-col gap-1 z-10">
        {props.item.category && (
          <span
            class={`text-[10px] font-bold px-2 py-0.5 rounded text-white uppercase tracking-wide backdrop-blur-sm w-fit ${CATEGORY_COLORS[props.item.category] || "bg-gray-600"}`}
          >
            {CATEGORY_LABELS[props.item.category] || props.item.category}
          </span>
        )}
        {props.item.rating && (
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-yellow-400 backdrop-blur-sm flex items-center gap-0.5 w-fit">
            <span class="text-[9px]">&#9733;</span>
            {props.item.rating}
          </span>
        )}
      </div>
      {/* Top-right: bookmark */}
      {props.onBookmark && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            props.onBookmark!(e)
          }}
          class={`absolute top-2 right-2 w-7 h-7 rounded-full border-none cursor-pointer flex items-center justify-center transition-opacity backdrop-blur-sm z-10 ${
            props.inLibrary
              ? "bg-accent/80 text-white opacity-100"
              : "bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-accent/60"
          }`}
          title={props.inLibrary ? "In shared library" : "Add to shared library"}
        >
          <Bookmark size={14} fill={props.inLibrary ? "currentColor" : "none"} />
        </button>
      )}
      {poster() ? (
        <img src={poster()} alt="" loading="lazy" class="w-full aspect-[2/3] object-cover block bg-hover" />
      ) : (
        <div class="w-full aspect-[2/3] bg-hover flex items-center justify-center text-muted text-2xl">?</div>
      )}
      <div class="p-2.5">
        <div class="text-xs font-semibold text-text leading-tight mb-1 line-clamp-2">{props.item.title}</div>
        {props.item.year && <div class="text-[11px] text-muted">{props.item.year}</div>}
      </div>
    </div>
  )
}
