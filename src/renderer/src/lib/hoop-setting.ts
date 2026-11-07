const STORAGE_KEY = 'claudeui.basketballHoop'

/** The basketball hoop is off unless the person turned it on. */
export function isHoopEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setHoopEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  } catch {
    // Private mode: the choice just will not be remembered.
  }
}
