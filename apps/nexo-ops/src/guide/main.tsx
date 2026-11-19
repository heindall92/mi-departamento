import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../fonts';
import '../styles.css';
import './guide.css';
import { Guide } from './Guide';
createRoot(document.getElementById('root')!).render(<StrictMode><Guide /></StrictMode>);
