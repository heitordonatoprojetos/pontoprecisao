import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { bootRefreshOnce } from "./lib/bootRefresh";
import { installOfflineSync } from "./lib/offlineSync";

// Prevent service worker registration in iframe/preview contexts
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

// Limpa cache e recarrega UMA vez por versão (evita loop via flag em localStorage).
// Em iframe/preview pulamos para não atrapalhar o editor da Lovable.
if (!isPreviewHost && !isInIframe) {
  bootRefreshOnce();
}

installOfflineSync();

createRoot(document.getElementById("root")!).render(<App />);
