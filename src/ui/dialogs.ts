import { Alert, Platform } from 'react-native';

/**
 * Dialogs that also work in the web app. React Native's Alert does nothing
 * in a browser, so there the browser's own alert/confirm dialogs are used.
 */
export function showMessage(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/** Ask a yes/no question; resolves true when the user confirms. */
export function confirmAction(opts: { title: string; message?: string; confirm: string; cancel: string; destructive?: boolean }): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(opts.message ? `${opts.title}\n\n${opts.message}` : opts.title));
  }
  return new Promise((resolve) =>
    Alert.alert(opts.title, opts.message, [
      { text: opts.cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: opts.confirm, style: opts.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}
