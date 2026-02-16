import type { JSX } from "solid-js";

export default function HeartIcon(props: { class?: string; filled?: boolean; size?: number; style?: JSX.CSSProperties }) {
  const s = () => props.size ?? 24;
  return (
    <svg
      viewBox="0 0 24 24"
      width={s()}
      height={s()}
      fill={props.filled ? "currentColor" : "none"}
      stroke="currentColor"
      stroke-width="2"
      class={props.class}
      style={props.style}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
