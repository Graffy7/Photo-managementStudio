import { useWindowDimensions } from "react-native";
import { breakpoints } from "./theme";

export type Breakpoint = "phone" | "tablet" | "desktop";

// One definition of phone / tablet / desktop for every screen.
export function useBreakpoint(): { size: Breakpoint; width: number; isPhone: boolean; isDesktop: boolean } {
  const { width } = useWindowDimensions();
  const size: Breakpoint = width < breakpoints.tablet ? "phone" : width < breakpoints.desktop ? "tablet" : "desktop";
  return { size, width, isPhone: size === "phone", isDesktop: size === "desktop" };
}
