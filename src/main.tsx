import { render } from 'preact';
import '@fontsource/baloo-2/latin-500.css';
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/mochiy-pop-one/latin-400.css';
import './styles.css';
import { App } from './app';

render(<App />, document.getElementById('app')!);
