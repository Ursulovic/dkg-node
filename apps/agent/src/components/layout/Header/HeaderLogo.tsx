import { View, Text, StyleProp, ViewStyle } from "react-native";
import { Image, ImageProps } from "expo-image";

import useThemeColor from "@/hooks/useThemeColor";

export default function HeaderLogo(props: {
  image: ImageProps["source"];
  text: string;
  textColor?: string;
  textFont?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const defaultTextColor = useThemeColor("text");

  return (
    <View
      style={[
        {
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
        },
        props.style,
      ]}
    >
      <Image
        source={props.image}
        style={{
          width: 160,
          height: 50,
          marginRight: 8,
          marginLeft: 16,
          display: "flex",
        }}
        contentFit="contain"
        testID="header-logo"
      />
      {props.text && (
        <Text
          style={{
            textAlign: "left",
            color: props.textColor || defaultTextColor,
            fontFamily: props.textFont,
            fontSize: 16,
            fontWeight: 500,
          }}
        >
          {props.text}
        </Text>
      )}
    </View>
  );
}
