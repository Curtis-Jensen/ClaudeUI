import { useClaudeEvents } from './hooks/useClaudeEvents'
import { useStreamWatch } from './hooks/useStreamWatch'
import { SessionView } from './components/SessionView'
import { useStartupJingle } from './lib/speak/use-startup-jingle'

function App(): React.JSX.Element {
  useClaudeEvents()
  useStreamWatch()
  useStartupJingle()
  return <SessionView />
}

export default App
