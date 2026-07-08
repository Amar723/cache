import {Platform, Vibration} from 'react-native';

/** A short tactile confirmation for lightweight success states. */
export function lightImpact(): void {
  if (Platform.OS === 'android') {
    Vibration.vibrate(12);
    return;
  }

  Vibration.vibrate();
}
