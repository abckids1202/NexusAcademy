import { useSyncExternalStore } from "react";
import { getDataRevision, loadData, subscribeToData } from "../services/storageService";
import type { WheelForgeData } from "../types";

export function createDataSelector<T>(
  select: (data: WheelForgeData) => T,
  serverSnapshot: T,
) {
  let cachedRevision = -1;
  let cachedSnapshot = serverSnapshot;

  const getClientSnapshot = () => {
    if (getDataRevision() !== cachedRevision) {
      cachedSnapshot = select(loadData());
      cachedRevision = getDataRevision();
    }
    return cachedSnapshot;
  };

  return function useDataSelection() {
    return useSyncExternalStore(subscribeToData, getClientSnapshot, () => serverSnapshot);
  };
}
