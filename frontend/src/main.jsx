import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { prefs } from './utils/prefs.js'
import './index.css'

// Apply the persisted theme before first paint to avoid a flash.
document.documentElement.dataset.theme = prefs.get().theme

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)