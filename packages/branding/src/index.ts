export const brand = {
  name: "Flashly",
  colors: {
    primary: "#3880FF",
    primarySoft: "#5A95FF",
    accent: "#3880FF",
    success: "#5C975A",
    ink: "#0B1D33",
    surface: "#F9FBFF",
    surfaceMuted: "#F3F6FF",
    border: "#E5E7EF",
    text: "#3A4558",
    textMuted: "#6B778C",
    textStrong: "#0B1D33"
  },
  fonts: {
    primary: "Poppins",
    secondary: "Space Grotesk"
  }
} as const;

export const brandTheme = {
  light: {
    colors: {
      primary: "#3880FF",
      primarySoft: "#5A95FF",
      accent: "#3880FF",
      success: "#5C975A",
      background: "#F9FBFF",
      surface: "#F3F6FF",
      border: "#E5E7EF",
      ink: "#0B1D33",
      text: "#3A4558",
      textMuted: "#6B778C",
      textStrong: "#0B1D33"
    }
  },
  dark: {
    colors: {
      primary: "#7AA2FF",
      primarySoft: "#9CBBFF",
      accent: "#7AA2FF",
      success: "#6FBF77",
      background: "#0B1220",
      surface: "#0F1A2B",
      border: "#1F2A3A",
      ink: "#F2F6FF",
      text: "#C7D2E5",
      textMuted: "#8FA1BF",
      textStrong: "#F7FAFF"
    }
  },
  fonts: {
    primary: "Poppins",
    secondary: "Space Grotesk"
  }
} as const;

export const pricing = {
  free: {
    price: "Free",
    flashcards: 200,
    audio: 10,
    images: 10
  },
  pro: {
    price: "€10",
    flashcards: 1000,
    audio: 100,
    images: 300
  }
} as const;
