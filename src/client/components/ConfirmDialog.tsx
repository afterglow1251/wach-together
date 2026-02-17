import { createSignal, Show, type ParentComponent } from "solid-js"
import { Portal } from "solid-js/web"
import { createContext, useContext } from "solid-js"

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>()

export const ConfirmProvider: ParentComponent = (props) => {
  const [options, setOptions] = createSignal<ConfirmOptions | null>(null)
  let resolveFn: ((val: boolean) => void) | null = null

  const confirm: ConfirmFn = (opts) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolveFn = resolve
    })
  }

  function handleConfirm() {
    resolveFn?.(true)
    resolveFn = null
    setOptions(null)
  }

  function handleCancel() {
    resolveFn?.(false)
    resolveFn = null
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {props.children}
      <Portal>
        <Show when={options()}>
          {(opts) => (
            <div
              class="fixed inset-0 z-[100] flex items-center justify-center"
              onKeyDown={(e) => e.key === "Escape" && handleCancel()}
            >
              {/* Backdrop */}
              <div class="absolute inset-0 bg-black/30" onClick={handleCancel} />

              {/* Dialog */}
              <div
                class="relative bg-card border border-border rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.5)] p-5 max-w-[360px] w-[calc(100%-32px)]"
                style={{ animation: "msg-in 0.15s ease-out" }}
              >
                <h3 class="text-sm font-semibold text-text mb-1.5">{opts().title}</h3>
                <p class="text-[13px] text-muted mb-5 leading-relaxed">{opts().message}</p>

                <div class="flex gap-2 justify-end">
                  <button
                    onClick={handleCancel}
                    class="px-3.5 py-2 rounded-lg border border-border bg-transparent text-[13px] text-text cursor-pointer transition-colors hover:bg-hover"
                  >
                    {opts().cancelText ?? "Cancel"}
                  </button>
                  <button
                    onClick={handleConfirm}
                    class={`px-3.5 py-2 rounded-lg border-none text-[13px] text-white font-medium cursor-pointer transition-colors ${
                      opts().danger ? "bg-danger hover:brightness-110" : "bg-accent hover:bg-accent-dark"
                    }`}
                    autofocus
                  >
                    {opts().confirmText ?? "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </Show>
      </Portal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider")
  return ctx
}
