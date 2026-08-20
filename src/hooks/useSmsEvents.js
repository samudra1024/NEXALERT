import { useEffect } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const { SmsModule } = NativeModules;

export default function useSmsEvents(onSmsReceived) {
  useEffect(() => {
    if (Platform.OS !== 'android' || !SmsModule || !onSmsReceived) {
      return undefined;
    }

    const emitter = new NativeEventEmitter(SmsModule);
    const subscription = emitter.addListener('onSmsReceived', onSmsReceived);
    return () => subscription.remove();
  }, [onSmsReceived]);
}
