import { Image } from "expo-image";
import { View, ViewProps } from "react-native";

import useColors from "@/hooks/useColors";

export default function ChatMessageIconAssistant(props: ViewProps) {
  const colors = useColors();

  return (
    <View {...props}>
      <Image
        source={require("@/assets/magnifying-glass.svg")}
        style={{
          width: 32,
          height: 32,
          tintColor: colors.primary,
        }}
        contentFit="contain"
      />
    </View>
  );
}
