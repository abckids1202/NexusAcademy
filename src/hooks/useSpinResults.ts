import type { SpinResult } from "../types";
import { createDataSelector } from "./useDataSelector";

const useSpinResultSnapshot = createDataSelector((data) => data.spinResults, [] as SpinResult[]);

export function useSpinResults() {
  return useSpinResultSnapshot();
}
