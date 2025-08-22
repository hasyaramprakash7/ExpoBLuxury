// ---------------------------------------------------------------- //
// FILE: /src/styles/theme.ts
// Description: Centralized design system for the Rolex-inspired UI.
// ---------------------------------------------------------------- //
export const theme = {
  colors: {
    primary: '#006039',     // Cadmium Green (Rolex Green)
    accent: '#A37E2C',      // Luxor Gold (Rolex Gold)
    background: '#F4F4F2',  // Off-White
    text: '#1C1C1C',        // Near Black
    secondaryText: '#555',  // Dark Charcoal for secondary text
    white: '#FFFFFF',
    error: '#C0392B',       // Muted Red
    lightGray: '#EAEAEA',   // For borders, disabled states
  },
  fonts: {
    // Ensure these fonts are loaded in your project (e.g., via expo-font)
    primary: 'CormorantGaramond-Bold',
    secondary: 'Montserrat-Regular',
    secondaryBold: 'Montserrat-Bold',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: 8,
};
