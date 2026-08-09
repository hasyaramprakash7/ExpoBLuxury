// AppointmentLink.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Linking, ViewStyle, TextStyle } from 'react-native';

// External appointment URL
const EXTERNAL_APPOINTMENT_URL =
  "https://pentakotahashyaramprakash.tataaiapartner.com/site/?camp_id=S0RNMlNUVXRKRlV4THpOVVlBcGdDZz09&content=Social&channel_type=WhatsApp&pid=S0RNMlNURXNSRmxLTlROZ1lBcGdDZz09";

interface AppointmentLinkProps {
  /** Custom button style */
  style?: ViewStyle;
  /** Custom text style */
  textStyle?: TextStyle;
  /** Custom label (default: "📅 Book Appointment") */
  children?: React.ReactNode;
  /** Disable the button */
  disabled?: boolean;
}

/**
 * Opens the insurance appointment link in the external browser.
 * Use this anywhere you need a standalone button.
 */
const AppointmentLink: React.FC<AppointmentLinkProps> = ({
  style,
  textStyle,
  children = '📅 Book Appointment',
  disabled = false,
}) => {
  const handlePress = () => {
    Linking.openURL(EXTERNAL_APPOINTMENT_URL).catch((err) =>
      console.error('Failed to open URL:', err)
    );
  };

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={[styles.text, textStyle]}>{children}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#166534',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AppointmentLink;