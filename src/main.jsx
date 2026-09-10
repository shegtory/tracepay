import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import AppErrorBoundary from "./components/AppErrorBoundary.jsx";

const root = document.getElementById("root");

if (!root) throw new Error("TracePay root element is missing.");

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
