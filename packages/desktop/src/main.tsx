import "./index.css";
import "@frontend/i18n/index";
import { createRoot } from "react-dom/client";
import DesktopApp from "./DesktopApp";

// Suppress the browser's default right-click context menu so the desktop app
// behaves like a native application rather than a webpage.
window.addEventListener("contextmenu", (e) => e.preventDefault());

createRoot(document.getElementById("root")!).render(<DesktopApp />);
