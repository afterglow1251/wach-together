import { Show } from "solid-js"

export default function ShowInfo(props: { title?: string }) {
  return (
    <Show when={props.title}>
      <div class="px-5 py-4 sidebar-divider relative z-1">
        <h3 class="text-[15px] font-semibold leading-relaxed text-gradient-subtle">{props.title}</h3>
      </div>
    </Show>
  )
}
