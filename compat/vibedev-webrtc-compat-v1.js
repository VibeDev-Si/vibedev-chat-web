/* VibeDev compatibility fix for Windows Chromium’s legacy Matrix screenshare
 * codec negotiation. Upstream: https://github.com/matrix-org/matrix-js-sdk/issues/5695
 */
(() => {
    const chromiumMajor = Number(navigator.userAgent.match(/\bChrome\/(\d+)\./)?.[1]);
    if (!/\bWindows NT\b/.test(navigator.userAgent) || !(chromiumMajor >= 156)) return;

    const prototype = globalThis.RTCRtpTransceiver?.prototype;
    const nativeSetCodecPreferences = prototype?.setCodecPreferences;
    const getReceiverCapabilities = globalThis.RTCRtpReceiver?.getCapabilities;
    if (!nativeSetCodecPreferences || !getReceiverCapabilities) return;

    const keyFor = codec => `${codec.mimeType.toLowerCase()}|${codec.clockRate}|${codec.channels ?? ''}|${codec.sdpFmtpLine ?? ''}`;
    const receiverCodecs = RTCRtpReceiver.getCapabilities('video')?.codecs;
    if (!receiverCodecs?.length) return;
    const receiverKeys = new Set(receiverCodecs.map(keyFor));

    prototype.setCodecPreferences = function (codecs) {
        if (!Array.isArray(codecs) || !codecs.length || this.receiver?.track?.kind !== 'video') {
            return nativeSetCodecPreferences.apply(this, arguments);
        }

        // Preserve the order Element selected. Sender-only H.26x levels can
        // alias a receiver payload type when Chromium builds the next offer.
        const seen = new Set();
        const filtered = codecs.filter(codec => {
            const key = keyFor(codec);
            if (!receiverKeys.has(key) || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        if (!filtered.length) {
            throw new DOMException('No receiver-supported video codecs were supplied.', 'InvalidModificationError');
        }
        return nativeSetCodecPreferences.call(this, filtered.length === codecs.length ? codecs : filtered);
    };
})();
