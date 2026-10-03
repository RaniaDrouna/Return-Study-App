import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ((window as any).electronAPI?.isElectron) {
    document.documentElement.classList.add("electron-app");
}

createRoot(document.getElementById("root")!).render(<App />);