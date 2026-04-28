import React from 'react'
import ReactDOM from 'react-dom/client'
import CadreLogique from '../cadre_logique_app.jsx'
import ParticipantView from '../ParticipantView.jsx'
import './index.css'

const params    = new URLSearchParams(window.location.search)
const mode      = params.get('mode')
const sessionId = params.get('session')

const App = mode === 'participant' && sessionId
  ? () => <ParticipantView sessionId={sessionId} />
  : CadreLogique

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
