import type { Wheel } from "../types";
import { createDataSelector } from "./useDataSelector";

const useWheelSnapshot = createDataSelector((data) => data.wheels, [] as Wheel[]);

export function useWheels() {
  return useWheelSnapshot();
}
