import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { logRuntimeError } from "@/lib/observability";

window.addEventListener("error", (event) => {
  logRuntimeError("window_onerror", event.error ?? event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  logRuntimeError("unhandled_rejection", event.reason);
});

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker for PWA offline support
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW registration failure is non-fatal
    });
  });
}
