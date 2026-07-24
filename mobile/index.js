/* Expo entry point (web + native). `registerRootComponent` calls
   AppRegistry.registerComponent AND wires the web root element, so the
   same entry works for `expo start`, native builds and `expo export
   --platform web`. package.json "main" points here — never at
   node_modules/expo/AppEntry.js, which breaks the web export when the
   project is opened from a workspace root. */
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
