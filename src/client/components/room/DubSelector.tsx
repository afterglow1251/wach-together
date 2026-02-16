import { Show, For } from "solid-js";
import type { DubGroup } from "../../../shared/types";

export default function DubSelector(props: {
  dubs: DubGroup[];
  value: number;
  onChange: (idx: number) => void;
}) {
  return (
    <Show when={props.dubs.length > 1}>
      <div class="px-5 py-4 sidebar-divider relative z-1">
        <label class="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Dub ♥</label>
        <select
          value={props.value}
          onChange={(e) => props.onChange(parseInt(e.currentTarget.value))}
          class="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm outline-none cursor-pointer transition-colors focus:border-accent select-styled"
        >
          <For each={props.dubs}>
            {(dub, i) => <option value={i()}>{dub.name}</option>}
          </For>
        </select>
      </div>
    </Show>
  );
}
