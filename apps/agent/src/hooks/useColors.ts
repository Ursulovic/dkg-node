import { useMemo } from "react";

import { useColorScheme } from "./useColorScheme";

const biasLensTheme = {
  background: "#000000",
  backgroundFlat: "#0a0a0a",
  text: "#FFFFFF",
  primary: "#FF1493",
  primaryText: "#FFFFFF",
  secondary: "#C71585",
  card: "#0f0f0f",
  cardText: "#FAFAFA",
  card2: "#00000080",
  input: "#1a1a1a",
  placeholder: "#666666",
  error: "#FF0000",
  networkLight: "#FF69B466",
  networkDark: "#8B008B66",
};

const darkTheme = biasLensTheme;
const lightTheme: typeof darkTheme = biasLensTheme;

export type Color = keyof typeof darkTheme;

export const Colors: Record<"light" | "dark", typeof darkTheme> = {
  light: lightTheme,
  dark: darkTheme,
};

export default function useColors() {
  const colorScheme = useColorScheme();

  return useMemo(() => {
    const colors = Colors[colorScheme ?? "light"];
    const getTextColor = (backgroundColor: Color) => {
      return backgroundColor === "card"
        ? colors.cardText
        : backgroundColor === "primary"
          ? colors.primaryText
          : colors.text;
    };
    return {
      ...colors,
      getTextColor,
    };
  }, [colorScheme]);
}
