import { Show } from "solid-js";
import { ChevronLeft, ChevronRight } from "lucide-solid";

interface Props {
  current: number;
  hasMore: boolean;
  onChange: (page: number) => void;
}

export default function Pagination(props: Props) {
  return (
    <div class="flex items-center justify-center gap-3 mt-6">
      <Show when={props.current > 1}>
        <button
          onClick={() => props.onChange(props.current - 1)}
          class="flex items-center gap-1 px-4 py-2 rounded-full border border-border text-[13px] font-medium text-muted bg-transparent cursor-pointer transition-all hover:bg-hover hover:text-text"
        >
          <ChevronLeft size={16} />
          Prev
        </button>
      </Show>

      <span class="text-[13px] text-muted tabular-nums">Page {props.current}</span>

      <Show when={props.hasMore}>
        <button
          onClick={() => props.onChange(props.current + 1)}
          class="flex items-center gap-1 px-4 py-2 rounded-full border border-border text-[13px] font-medium text-muted bg-transparent cursor-pointer transition-all hover:bg-hover hover:text-text"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </Show>
    </div>
  );
}
