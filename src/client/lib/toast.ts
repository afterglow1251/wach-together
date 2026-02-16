import _toast from "solid-toast";

const opts = {
  style: {
    background: "linear-gradient(135deg, #1a1020, #2a1028)",
    color: "#f0c0d8",
    border: "1px solid rgba(232, 67, 147, 0.3)",
    "border-radius": "12px",
    "font-size": "13px",
  },
  duration: 3000,
};

function toast(msg: string) {
  _toast(`♥ ${msg}`, { ...opts, icon: "" });
}

toast.error = (msg: string) => {
  _toast.error(msg, opts);
};

toast.success = (msg: string) => {
  _toast(`♥ ${msg}`, { ...opts, icon: "" });
};

export default toast;
