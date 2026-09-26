import { createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ChainBuilderPage } from "./pages/ChainBuilderPage";
import { ChainRunnerPage } from "./pages/ChainRunnerPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RouterErrorPage } from "./pages/RouterErrorPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SpinPage } from "./pages/SpinPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { TournamentDetailPage } from "./pages/TournamentDetailPage";
import { TournamentsPage } from "./pages/TournamentsPage";
import { WheelEditorPage } from "./pages/WheelEditorPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <RouterErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "wheels/new", element: <WheelEditorPage mode="create" /> },
      { path: "wheels/:wheelId/edit", element: <WheelEditorPage mode="edit" /> },
      { path: "spin/:wheelId?", element: <SpinPage /> },
      { path: "chains/new", element: <ChainBuilderPage mode="create" /> },
      { path: "chains/:chainId/edit", element: <ChainBuilderPage mode="edit" /> },
      { path: "chains/:chainId/run", element: <ChainRunnerPage /> },
      { path: "tournaments", element: <TournamentsPage /> },
      { path: "tournaments/:tournamentId", element: <TournamentDetailPage /> },
      {
        path: "tournaments/:tournamentId/host",
        lazy: async () => {
          const { TournamentHostPage } = await import("./pages/TournamentHostPage");
          return { Component: TournamentHostPage };
        },
      },
      { path: "templates", element: <TemplatesPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
