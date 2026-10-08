import { createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { RouteLoading } from "./components/common/RouteLoading";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RouterErrorPage } from "./pages/RouterErrorPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <RouterErrorPage />,
    HydrateFallback: RouteLoading,
    children: [
      {
        index: true,
        lazy: async () => {
          const { HomePage } = await import("./pages/HomePage");
          return { Component: HomePage };
        },
      },
      {
        path: "dashboard",
        lazy: async () => {
          const { DashboardPage } = await import("./pages/DashboardPage");
          return { Component: DashboardPage };
        },
      },
      {
        path: "wheels/new",
        lazy: async () => {
          const { WheelEditorPage } = await import("./pages/WheelEditorPage");
          return { Component: () => <WheelEditorPage mode="create" /> };
        },
      },
      {
        path: "wheels/:wheelId/edit",
        lazy: async () => {
          const { WheelEditorPage } = await import("./pages/WheelEditorPage");
          return { Component: () => <WheelEditorPage mode="edit" /> };
        },
      },
      {
        path: "spin/:wheelId?",
        lazy: async () => {
          const { SpinPage } = await import("./pages/SpinPage");
          return { Component: SpinPage };
        },
      },
      {
        path: "chains/new",
        lazy: async () => {
          const { ChainBuilderPage } = await import("./pages/ChainBuilderPage");
          return { Component: () => <ChainBuilderPage mode="create" /> };
        },
      },
      {
        path: "chains/:chainId/edit",
        lazy: async () => {
          const { ChainBuilderPage } = await import("./pages/ChainBuilderPage");
          return { Component: () => <ChainBuilderPage mode="edit" /> };
        },
      },
      {
        path: "chains/:chainId/run",
        lazy: async () => {
          const { ChainRunnerPage } = await import("./pages/ChainRunnerPage");
          return { Component: ChainRunnerPage };
        },
      },
      {
        path: "tournaments",
        lazy: async () => {
          const { TournamentsPage } = await import("./pages/TournamentsPage");
          return { Component: TournamentsPage };
        },
      },
      {
        path: "tournaments/:tournamentId",
        lazy: async () => {
          const { TournamentDetailPage } = await import("./pages/TournamentDetailPage");
          return { Component: TournamentDetailPage };
        },
      },
      {
        path: "participants",
        lazy: async () => {
          const { ParticipantsPage } = await import("./pages/ParticipantsPage");
          return { Component: ParticipantsPage };
        },
      },
      {
        path: "tournaments/:tournamentId/host",
        lazy: async () => {
          const { TournamentHostPage } = await import("./pages/TournamentHostPage");
          return { Component: TournamentHostPage };
        },
      },
      {
        path: "templates",
        lazy: async () => {
          const { TemplatesPage } = await import("./pages/TemplatesPage");
          return { Component: TemplatesPage };
        },
      },
      {
        path: "settings",
        lazy: async () => {
          const { SettingsPage } = await import("./pages/SettingsPage");
          return { Component: SettingsPage };
        },
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
