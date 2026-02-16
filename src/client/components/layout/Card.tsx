import type { ParentComponent } from "solid-js";

const Card: ParentComponent<{ class?: string }> = (props) => (
  <div
    class={`bg-card border border-border rounded-2xl px-10 py-12 w-full max-w-[420px] text-center relative z-1 ${props.class ?? ""}`}
    style={{ animation: "card-glow 3s ease-in-out infinite" }}
  >
    {props.children}
  </div>
);

export default Card;
