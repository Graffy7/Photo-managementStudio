import { View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius } from "./theme";

// A still, fixed-size placeholder shown while content loads, the same size as what replaces it,
// so nothing jumps when the data arrives. Deliberately not animated.
export function Skeleton({ width = "100%", height, rounded = radius.control, style }: {
  width?: DimensionValue;
  height: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ width, height, borderRadius: rounded, backgroundColor: colors.cardRaised }, style]} accessibilityElementsHidden />;
}
