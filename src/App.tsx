import { Outlet, useLocation } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { RouteErrorBoundary } from "./components/common/RouteErrorBoundary";

export function App() {
  const location = useLocation();
  const isStandaloneTournamentHost = /^\/tournaments\/[^/]+\/host$/.test(location.pathname);

  return (
    <AppLayout standalone={isStandaloneTournamentHost}>
      <RouteErrorBoundary key={location.pathname}>
        <Outlet />
      </RouteErrorBoundary>
    </AppLayout>
  );
}
