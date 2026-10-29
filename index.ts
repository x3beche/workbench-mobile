import { registerRootComponent } from 'expo';

import App from './src/App';
import { registerWidgets } from './src/widget/register';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// Android starts this same bundle with no screen when the home screen widget
// needs a drawing (src/widget/task.tsx); the handler has to be registered
// before anything of the app is, so it comes after the root and nothing else.
registerWidgets();
