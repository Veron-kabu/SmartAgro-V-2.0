import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../constants/colors";

const SafeScreen = ({ children }) => {
  const insets = useSafeAreaInsets();
  // Slightly reduce the bottom safe-area padding so the gap under the tab bar is smaller
  // Keep at least 0 to avoid negative padding on devices without a bottom inset
  const BOTTOM_REDUCTION = 0; // px – tweak if you want more/less space
  const bottomPadding = Math.max((insets.bottom || 0) - BOTTOM_REDUCTION, 0);

  return (
    <View
      style={{
        paddingTop: insets.top,
        paddingBottom: bottomPadding, // prevent overlap while reducing extra gap under tabs
        flex: 1,
        backgroundColor: COLORS.background,
      }}
    >
      {children}
    </View>
  );
};
export default SafeScreen;
