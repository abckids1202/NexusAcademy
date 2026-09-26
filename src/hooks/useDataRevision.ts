import { useSyncExternalStore } from "react";
import { getDataRevision, subscribeToData } from "../services/storageService";

export function useDataRevision(): number {
  return useSyncExternalStore(subscribeToData, getDataRevision, getDataRevision);
}
