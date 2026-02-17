import type { ParentComponent } from "solid-js"
import Navbar from "./Navbar"
import FloatingHearts from "./FloatingHearts"

const AppLayout: ParentComponent = (props) => {
  return (
    <div class="h-screen flex flex-col bg-auth-gradient relative">
      <Navbar />
      <FloatingHearts />
      <div class="flex-1 overflow-y-auto relative z-1">{props.children}</div>
    </div>
  )
}

export default AppLayout
