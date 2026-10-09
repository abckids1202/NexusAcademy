import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { installRuntimeDiagnostics } from "./services/runtimeDiagnostics";
import "./styles/variables.css";
import "./styles/globals.css";
import "./styles/animations.css";

installRuntimeDiagnostics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
