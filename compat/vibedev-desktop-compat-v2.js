/* VibeDev Desktop compatibility (v2, 2026-11-23).
 * Older VibeDev Desktop builds cannot show system notifications (the desktop denies the permission), so Element's
 * "Enable desktop notifications" prompt only ends in an error there. Element shows the prompt unless
 * localStorage.getItem("notifications_hidden") is "true". In those builds (user agent containing "Electron/" but not
 * "VibeDevMessages/") that read answers "true" while nothing is stored; a stored choice is returned unchanged.
 * Desktop builds that support notifications add "VibeDevMessages/" to their user agent and get Element's normal prompt.
 * Nothing is written: Element clears localStorage after every sign-in, and removing this file brings the prompt back
 * without cleanup. Browsers, push rules, unread counts and the notification setting are not affected.
 * v1 hid the prompt in every Electron; it is cached for a year, hence the new file name.
 */
(() => {
    const userAgent = navigator.userAgent;
    if (!/\bElectron\//.test(userAgent) || /\bVibeDevMessages\//.test(userAgent)) return;
    let storage;
    try { storage = window.localStorage; } catch { return; }
    if (!storage || typeof Storage === 'undefined') return;
    const nativeGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
        const value = nativeGetItem.apply(this, arguments);
        return value === null && key === 'notifications_hidden' && this === storage ? 'true' : value;
    };
})();
