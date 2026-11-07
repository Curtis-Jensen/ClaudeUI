import { useSyncExternalStore } from 'react'
import {
  getSpeakingKey,
  isSpeechPaused,
  pauseSpeech,
  prepareSpeech,
  resumeSpeech,
  skipSpeech,
  speakMessage,
  stopSpeaking,
  subscribeSpeaking
} from '../../lib/speak/kokoro-speaker'
import { useSpeechProgress } from '../../lib/speak/use-speech-progress'
import { SPEAK_UNREACHABLE_EVENT } from '../../lib/speak/use-speak-replies'

const SKIP_SECONDS = 10

function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

const controlClass = 'cursor-pointer text-text-muted transition-colors hover:text-text-primary'

/**
 * Plays one message aloud in the local voice; pressed again while it plays, it stops.
 * While it plays, pause and skip buttons appear beside it; the bar to drag is SpeechRail, down
 * the side of the message.
 */
export function SpeakButton({
  messageId,
  text
}: {
  messageId: string
  text: string
}): React.JSX.Element | null {
  const speaking = useSyncExternalStore(subscribeSpeaking, () => getSpeakingKey() === messageId)
  const paused = useSyncExternalStore(subscribeSpeaking, isSpeechPaused) && speaking
  const [progress, refresh] = useSpeechProgress(speaking, paused)
  if (!prepareSpeech(text)) return null

  const onClick = (): void => {
    if (speaking) {
      stopSpeaking()
      return
    }
    void speakMessage(text, messageId).then((reached) => {
      if (!reached) window.dispatchEvent(new Event(SPEAK_UNREACHABLE_EVENT))
    })
  }

  const skip = (seconds: number): void => {
    skipSpeech(seconds)
    refresh()
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        data-testid="MessageBubble.speak"
        data-enter-sends
        aria-pressed={speaking}
        onClick={onClick}
        title={speaking ? 'Stop reading' : 'Read this message aloud'}
        className={`flex items-center gap-1 text-[10px] transition-colors cursor-pointer ${
          speaking ? 'text-accent' : 'text-text-muted hover:text-text-primary'
        }`}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {speaking ? (
            <rect x="6" y="6" width="12" height="12" rx="1" />
          ) : (
            <path d="M7 4l13 8-13 8z" />
          )}
        </svg>
        <span>{speaking ? 'Stop' : 'Listen'}</span>
      </button>
      {speaking && progress && (
        <div
          data-testid="MessageBubble.speak.player"
          className="flex items-center gap-2 text-[10px] text-text-muted"
        >
          <button
            type="button"
            data-testid="MessageBubble.speak.pause"
            data-enter-sends
            onClick={paused ? resumeSpeech : pauseSpeech}
            title={paused ? 'Keep reading' : 'Pause'}
            aria-label={paused ? 'Keep reading' : 'Pause'}
            className={controlClass}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              {paused ? <path d="M7 4l13 8-13 8z" /> : <path d="M6 4h4v16H6zM14 4h4v16h-4z" />}
            </svg>
          </button>
          <button
            type="button"
            data-testid="MessageBubble.speak.back"
            data-enter-sends
            onClick={() => skip(-SKIP_SECONDS)}
            title={`Back ${SKIP_SECONDS} seconds`}
            aria-label={`Back ${SKIP_SECONDS} seconds`}
            className={controlClass}
          >
            −{SKIP_SECONDS}s
          </button>
          <button
            type="button"
            data-testid="MessageBubble.speak.forward"
            data-enter-sends
            onClick={() => skip(SKIP_SECONDS)}
            title={`Forward ${SKIP_SECONDS} seconds`}
            aria-label={`Forward ${SKIP_SECONDS} seconds`}
            className={controlClass}
          >
            +{SKIP_SECONDS}s
          </button>
          <span className="tabular-nums" data-testid="MessageBubble.speak.time">
            {formatTime(progress.position)} / {formatTime(progress.duration)}
          </span>
        </div>
      )}
    </div>
  )
}
