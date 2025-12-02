const AUTH_UNAUTHORIZED_EVENT = "clinic-auth:unauthorized"

export type UnauthorizedEventHandler = () => void

export const emitUnauthorizedEvent = (): void => {
  if (typeof window === "undefined") {
    return
  }
  const event = new CustomEvent(AUTH_UNAUTHORIZED_EVENT)
  if (import.meta.env.DEV) {
    console.warn("[auth] unauthorized event emitted")
  }

  window.dispatchEvent(event)
}

export const subscribeToUnauthorizedEvent = (
  handler: UnauthorizedEventHandler
): (() => void) => {
  if (typeof window === "undefined") {
    return () => {}
  }

  window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handler)

  return () => {
    window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handler)
  }
}
