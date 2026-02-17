import { onCleanup, type ParentComponent } from "solid-js"
import { useQueryClient } from "@tanstack/solid-query"
import * as ws from "../services/ws"
import type { WSServerMessage } from "../../shared/ws-types"

export const FriendsWSProvider: ParentComponent = (props) => {
  const qc = useQueryClient()

  function handleMessage(msg: WSServerMessage) {
    switch (msg.type) {
      case "friend-request-received":
        qc.invalidateQueries({ queryKey: ["friend-requests"] })
        break
      case "friend-request-cancelled":
        qc.invalidateQueries({ queryKey: ["friend-requests"] })
        qc.invalidateQueries({ queryKey: ["sent-requests"] })
        break
      case "friend-accepted":
        qc.invalidateQueries({ queryKey: ["friends"] })
        qc.invalidateQueries({ queryKey: ["sent-requests"] })
        break
      case "friend-removed":
        qc.invalidateQueries({ queryKey: ["friends"] })
        break
    }
  }

  ws.addMessageHandler(handleMessage)

  onCleanup(() => {
    ws.removeMessageHandler(handleMessage)
  })

  return <>{props.children}</>
}
