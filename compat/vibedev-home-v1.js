/* VibeDev home page (v1, 2026-11-24).
 * Element shows our home page (config.json embedded_pages.home_url, https://chat.vibedev.studio/onboarding.html)
 * through its HTML sanitizer, so the page cannot run scripts or carry classes. Its first card asks for a display name
 * and an avatar; the card is the element holding <a name="vd-profile-setup">. This script hides that card once the
 * signed-in account has both:
 *   - a display name of its own: set, and neither the user ID, its localpart, nor the name the OIDC sign-up wrote
 *     ("VibeDev <sub>" for "@vibedev_<sub>:…");
 *   - an avatar.
 * The card is hidden as soon as it is inserted (mutation callbacks run before the next paint) and shown again when the
 * profile turns out to be incomplete or cannot be read (an error, or no answer within 10 s), so a complete profile never
 * sees it flash and any failure leaves the page as it would be without this script. The profile is read with the client
 * Element already has (window.mxMatrixClientPeg, GET /profile/{userId}) when the home page appears and after a dialog
 * closes (the settings dialog is where the name and avatar change). Nothing is written or sent elsewhere; outside the
 * home page it does nothing.
 */
(() => {
    const MARK = 'a[name="vd-profile-setup"]';
    const REFRESH_MS = 5000;
    const READ_TIMEOUT_MS = 10000; // a read that never answers must not keep the card hidden
    let known; // { userId, complete, at }
    let pending = false;
    let dialogs = 0;

    const card = () => {
        const mark = document.querySelector(`.mx_HomePage ${MARK}`);
        return mark ? mark.parentElement : null;
    };
    // The card's own inline style sets its display (the page has no classes), so hiding keeps that value aside and
    // showing puts it back.
    const show = (node, visible) => {
        if (!node) return;
        if (node.dataset.vdDisplay === undefined) node.dataset.vdDisplay = node.style.getPropertyValue('display');
        if (visible) node.style.setProperty('display', node.dataset.vdDisplay);
        else node.style.setProperty('display', 'none');
    };

    function complete(userId, profile) {
        const name = typeof profile?.displayname === 'string' ? profile.displayname.trim() : '';
        const localpart = userId.slice(1).split(':')[0];
        const signUpName = localpart.startsWith('vibedev_') ? `VibeDev ${localpart.slice('vibedev_'.length)}` : null;
        const ownName = name !== '' && name !== userId && name !== localpart && name !== signUpName;
        const avatar = typeof profile?.avatar_url === 'string' && profile.avatar_url !== '';
        return ownName && avatar;
    }

    async function refresh(force) {
        const node = card();
        if (!node) return;
        const client = window.mxMatrixClientPeg?.get?.();
        const userId = client?.getUserId?.();
        if (!client || !userId) { show(node, true); return; }
        if (known && known.userId === userId) show(node, !known.complete); // the last answer until the new one
        else show(node, false);
        if (!force && known && known.userId === userId && Date.now() - known.at < REFRESH_MS) return;
        if (pending) return;
        pending = true;
        try {
            let timer;
            const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), READ_TIMEOUT_MS); });
            const profile = await Promise.race([client.getProfileInfo(userId), timeout]).finally(() => clearTimeout(timer));
            known = { userId, complete: complete(userId, profile), at: Date.now() };
        } catch {
            known = { userId, complete: false, at: Date.now() };
        } finally {
            pending = false;
        }
        show(card(), !known.complete);
    }

    const observer = new MutationObserver(() => {
        const open = document.querySelectorAll('.mx_Dialog').length;
        const closed = open < dialogs;
        dialogs = open;
        const node = card();
        if (node && !node.dataset.vdSeen) {
            node.dataset.vdSeen = '1';
            void refresh(false);
        } else if (node && closed) {
            void refresh(true);
        }
    });
    const start = () => observer.observe(document.body, { childList: true, subtree: true });
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
