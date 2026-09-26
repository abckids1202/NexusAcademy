import type { SpinChain } from "../types";
import { createDataSelector } from "./useDataSelector";

const useChainSnapshot = createDataSelector((data) => data.chains, [] as SpinChain[]);

export function useChains() {
  return useChainSnapshot();
}
