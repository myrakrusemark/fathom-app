/**
 * Browser Notification API wrapper for Fathom app.
 * Sends native OS notifications when the tab is not focused.
 */

let permissionGranted = Notification.permission === "granted";

/** Request notification permission (call once on user interaction). */
export function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().then((result) => {
      permissionGranted = result === "granted";
    });
  }
}

/**
 * Show a browser notification if the tab is not focused.
 * @param {string} title - Notification title
 * @param {object} [options] - { body, tag, icon }
 *   - tag: deduplicates — same tag replaces the previous notification
 */
export function notify(title, { body, tag, icon } = {}) {
  if (!permissionGranted || document.hasFocus()) return;
  try {
    new Notification(title, {
      body,
      tag,
      icon: icon || "/fathom-192.png",
    });
  } catch {
    // Silent fail — notifications not supported in this context
  }
}
