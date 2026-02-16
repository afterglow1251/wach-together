export default function Spinner(props: { class?: string }) {
  return (
    <div
      class={`inline-block w-3.5 h-3.5 border-2 border-border border-t-accent rounded-full animate-spin ${props.class ?? ""}`}
      style={{ animation: "spin 0.6s linear infinite" }}
    />
  );
}
