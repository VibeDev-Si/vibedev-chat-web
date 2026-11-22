/* VibeDev Desktop compatibility (v1).
 * The chat embedded in VibeDev Desktop cannot show system notifications yet (the desktop denies the permission), so
 * Element's "Enable desktop notifications" prompt only ends in an error. Element shows the prompt unless
 * localStorage.getItem("notifications_hidden") is "true". In the desktop (user agent containing "Electron/") that read
 * answers "true" while nothing is stored; a stored choice is returned unchanged. Nothing is written: Element clears
 * localStorage after every sign-in, and removing this file brings the prompt back without cleanup. Browsers, push rules,
 * unread counts and the notification setting are not affected.
 * Remove this file, or gate it on the desktop version, once VibeDev Desktop supports notifications.
 */
(() => {
    if (!/\bElectron\//.test(navigator.userAgent)) return;
    let storage;
    try { storage = window.localStorage; } catch { return; }
    if (!storage || typeof Storage === 'undefined') return;
    const nativeGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
        const value = nativeGetItem.apply(this, arguments);
        return value === null && key === 'notifications_hidden' && this === storage ? 'true' : value;
    };
})();
