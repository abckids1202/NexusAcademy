import type { Tournament } from "../types";
import { createDataSelector } from "./useDataSelector";

const useTournamentSnapshot = createDataSelector((data) => data.tournaments, [] as Tournament[]);

export function useTournaments() {
  return useTournamentSnapshot();
}
