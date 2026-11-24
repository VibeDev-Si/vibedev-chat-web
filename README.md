# vibedev-chat-web

VibeDev 聊天的网页版（也就是 VibeDev 桌面版里内嵌的聊天）就是 **[Element Web](https://github.com/element-hq/element-web) 1.12.35**：

- 源码在 [element-hq/element-web v1.12.35](https://github.com/element-hq/element-web/tree/v1.12.35)，对应提交 `7001d81efc9ff634e29494d714a986cd514aff74`。
- 我们运行的是 Element 官方镜像 `vectorim/element-web:v1.12.35`，**镜像本身没有任何修改**。

唯一的代码改动在反向代理（nginx）上：它往 Element 的页面里注入了两个兼容脚本，以及（2026-11-24 起）一个首页脚本。本仓库公开这些脚本和注入方式，许可证与 Element 一致（AGPL-3.0）。

*English: VibeDev Chat is Element Web 1.12.35, unmodified (official image), plus two compatibility scripts that the reverse proxy injects into Element's page. This repository holds those scripts and how they are injected, under the AGPL-3.0 like Element. Since 2026-11-23 the call page `/widgets/element-call/` is the upstream Element Call embedded package 0.29.0-rc.2, unmodified, served by the reverse proxy instead of the 0.28.2 bundled with Element 1.12.35 (see below). Since 2026-11-24 a third script, `vibedev-home-v1.js`, is injected into Element's page (not the call page): it hides the "set your name and avatar" card of our home page once the signed-in account has a display name of its own and an avatar; if it does not run or cannot read the profile, the card simply stays.*

## 文件

| 文件 | 作用 | sha256 |
|---|---|---|
| [compat/vibedev-webrtc-compat-v1.js](compat/vibedev-webrtc-compat-v1.js) | Windows 上 Chromium 156 及以上版本的屏幕共享编码协商修正 | `0caca468396deb32f29ca375749c0a8f1534a5af529280e7f68b2ab1128da6a0` |
| [compat/vibedev-desktop-compat-v2.js](compat/vibedev-desktop-compat-v2.js) | 不支持通知的旧版桌面里不显示「开启桌面通知」提示（2026-11-23 起） | `b508018f8e5fdee23048a9ca3e5b42b77ef8e4337af7f226c60325e36f941ae8` |
| [compat/vibedev-desktop-compat-v1.js](compat/vibedev-desktop-compat-v1.js) | v1：在所有桌面版里都不显示这条提示。已由 v2 取代，线上仍原样提供，给还引用它的页面用 | `2084dee1fc61a0800a544a565bea1461c0b554dab36d2b9ce5326a4fcd0e7932` |
| [compat/vibedev-home-v1.js](compat/vibedev-home-v1.js) | 已经设置了名字和头像的账号，在聊天首页上不再显示「先设置你的名字和头像」卡片（2026-11-24 起） | `e63bdb68b33bbf72c4a357329dcc45cf98ad272f22b97b6c0bb9775f6eda2115` |
| [nginx/element-inject.conf.example](nginx/element-inject.conf.example) | 注入方式（nginx 配置示例，大写的是占位符） | — |

线上提供的脚本和本仓库里的文件逐字节相同，可以自己核对，例如：

```sh
curl -s https://chat.vibedev.studio/vibedev-webrtc-compat-v1.js | sha256sum
curl -s https://chat.vibedev.studio/vibedev-desktop-compat-v2.js | sha256sum
curl -s https://chat.vibedev.studio/vibedev-desktop-compat-v1.js | sha256sum
curl -s https://chat.vibedev.studio/vibedev-home-v1.js | sha256sum
```

## 脚本做什么

### vibedev-webrtc-compat-v1.js：屏幕共享的编码协商

- **只在哪里生效**：Windows 上 Chromium 156 及以上版本。其他浏览器和系统里，这个脚本什么都不做。
- **问题**：Element 1.12.35 在旧版 Matrix 通话（legacy call）里共享屏幕时，会通过 `RTCRtpTransceiver.setCodecPreferences` 给出视频编码列表。列表里有些 H.264/H.265 档次只能发送、不能接收。Chromium 生成下一个 offer 时，可能把它们和接收端的 payload type 混在一起，导致协商失败。上游问题见 [matrix-org/matrix-js-sdk#5695](https://github.com/matrix-org/matrix-js-sdk/issues/5695)。
- **做法**：只处理视频收发器上的这个调用。保留 Element 选好的顺序，去掉接收端不支持的编码和重复项，再交给浏览器原生的 `setCodecPreferences`；其他调用原样转交。
- **什么时候删**：上游修好以后，去掉注入即可。

### vibedev-desktop-compat-v2.js：旧版桌面的通知提示

- **只在哪里生效**：只在**还不支持通知的**桌面版里，也就是 user agent 含 `Electron/`、但不含 `VibeDevMessages/`。支持通知的新版桌面会在 user agent 里加上 `VibeDevMessages/`，照常显示 Element 的提示。浏览器里打开时，这个脚本什么都不做。
- **问题**：VibeDev 桌面版暂时还不能显示系统通知，因为桌面版拒绝了这项权限。所以 Element 的「开启桌面通知」提示，点了只会出错。
- **做法**：Element 读取 `localStorage` 里的 `notifications_hidden` 时，如果还没有存过值，就返回 `"true"`，于是不显示这条提示；已经存过的值原样返回。
- **影响范围**：脚本不写入任何东西。推送规则、未读计数和通知设置都不受影响。
- **为什么是新文件**：v1 在所有桌面版里都隐藏这条提示。它按版本号命名、缓存一年，改它的内容，已经缓存过的桌面和浏览器拿不到新内容，所以按版本规则发了 v2，页面改为引用 v2。
- **什么时候删**：旧版桌面不再有人用以后，去掉注入即可。

### vibedev-home-v1.js：首页的「设置名字和头像」卡片（2026-11-24 起）

- **只在哪里生效**：只在 Element 的首页（`.mx_HomePage`）上，而且只处理首页里带 `<a name="vd-profile-setup">` 标记的那张卡片。其他页面里，这个脚本什么都不做。通话页面 `/widgets/element-call/` 不注入它。
- **问题**：聊天首页是我们自己的页面（Element 的 `config.json` 里 `embedded_pages.home_url`），第一张卡片提醒用户设置名字和头像。Element 会先用它的 HTML 过滤器处理这个页面，页面里不能带脚本，所以页面自己没法判断用户是不是已经设置过，已经设置过的人也会一直看到这张卡片。
- **做法**：读取当前登录账号的资料（用 Element 已有的客户端 `window.mxMatrixClientPeg`，即 `GET /profile/{userId}`），名字和头像都设置过，就隐藏这张卡片。下面几种情况都视为**还没设置**，卡片照常显示：
  - 没有名字，或名字等于用户 ID、等于用户 ID 的 localpart，或者还是注册时自动生成的「VibeDev 数字」（`@vibedev_<数字>:…` 的默认名字 `VibeDev <数字>`）；
  - 没有头像。
- **出错时**：脚本没有运行、读不到资料（出错，或 10 秒内没有回应），卡片都照常显示，和没有这个脚本时一样。为了不让已经设置过的人看到卡片闪一下，卡片一插入页面就先隐藏，读到结果后再决定是否显示。关掉设置对话框以后会重新读一次，刚改完名字和头像就能生效。
- **影响范围**：脚本只读不写，不向别处发送任何东西；只改这张卡片的 `display` 样式。
- **什么时候删**：首页不再有这张卡片时，去掉注入即可。

*English: `vibedev-home-v1.js` only acts on Element's home page (`.mx_HomePage`) and only on the card marked `<a name="vd-profile-setup">`. It reads the signed-in account's profile through Element's own client (`GET /profile/{userId}`) and hides the card when the account has an avatar and a display name of its own, i.e. not empty, not the user ID or its localpart, and not the sign-up default "VibeDev <number>". If the script does not run, or the profile cannot be read (an error, or no answer within 10 s), the card stays, as without the script. It writes nothing and sends nothing elsewhere; it is not injected into the call page.*

## 注入方式

见 [nginx/element-inject.conf.example](nginx/element-inject.conf.example)：

- **放在哪里**：脚本作为静态文件，放在和 Element 同一个域名下。文件名带版本号（`-v1`、`-v2`），内容一变就换新文件名，所以可以长期缓存。
- **怎么插入**：nginx 用 `sub_filter` 在 Element 页面的 `<head>` 后面插入 `<script defer src="…">`：两个兼容脚本，加上（2026-11-24 起）首页脚本 `vibedev-home-v1.js`。通话页面 `/widgets/element-call/` 只插入两个兼容脚本（见下一节），首页脚本在那里用不到。另外插入的一个 `preconnect` 和这些脚本无关，只是让浏览器提前和 homeserver 建立连接。
- **首页本身**：首页页面（`embedded_pages.home_url`）是配置，不在本仓库；首页脚本只靠页面里的 `<a name="vd-profile-setup">` 找到那张卡片。
- **前提**：因为要改写页面，nginx 要求 Element 容器返回未压缩的内容（`proxy_set_header Accept-Encoding ""`），压缩由 nginx 自己做。

Element 的配置（`config.json`：品牌、默认服务器、登录方式等）和自定义翻译（`custom_translations_url`）都通过 Element 自带的配置项设置，属于配置，不在本仓库。

## 通话页面：Element Call 0.29.0-rc.2（2026-11-23 起）

- **是什么**：Element 里的通话（一对一和群通话）由 Element Call 页面 `/widgets/element-call/` 完成。我们没有用 Element 1.12.35 自带的 Element Call 0.28.2，而是由 nginx 在这个路径提供上游的 `@element-hq/element-call-embedded@0.29.0-rc.2`，**原样使用，没有任何修改**。
- **为什么**：0.28.2 有一个缺陷：设备（麦克风、摄像头）比通话界面晚一点就绪时，开关显示为开，但不会发布，对方看不到也听不到（[element-call#4403](https://github.com/element-hq/element-call/issues/4403)）。私聊通话不经过等候页，最容易中。修复是 [element-call#4485](https://github.com/element-hq/element-call/pull/4485)，0.29.0-rc.2 里是它的 backport [#4487](https://github.com/element-hq/element-call/pull/4487)。
- **源码**：[element-hq/element-call v0.29.0-rc.2](https://github.com/element-hq/element-call/tree/v0.29.0-rc.2)。许可证是 AGPL-3.0-only（或 Element 的商业许可）。
- **核对**：npm 包的 integrity 是 `sha512-nRKZBXQ0ntqkgNoCSkTo14ygDg/WlegPUOmZTzgbpCzNSVwrw7vGkWUhcj5uBoArhYZRhHgvctLy1PXDFwy57g==`。包里的 160 个文件和上游发布附件 `element-call-embedded-0.29.0-rc.2.tar.gz` 逐字节相同，与上游的 sha256 清单一致。
- **怎么提供**：见 [nginx/element-inject.conf.example](nginx/element-inject.conf.example) 末尾。和 Element 的页面一样会被注入上面两个兼容脚本（首页脚本不注入）。Element Call 的 `config.json`（延迟离开时长等）是配置，不在本仓库。
- **什么时候撤**：Element Web 自带的 Element Call 也包含这个修复以后，去掉这段 nginx 配置，回到 Element 自带的版本。

## 许可证

本仓库的代码以 GNU Affero General Public License v3.0（AGPL-3.0-only）发布，和 Element Web 的 AGPL 许可一致，见 [LICENSE](LICENSE)。Element Web 本身的许可证见它的仓库：AGPL-3.0-only 或 GPL-3.0-only，也可选 Element 的商业许可。

## 相关的开源代码

- **机器人插件**：VibeDev 聊天里机器人用的插件中，改过的那些，源码在 [VibeDev-Si/vibedev-bot-plugins](https://github.com/VibeDev-Si/vibedev-bot-plugins)。
- **其他组件**：homeserver、Element Call 等其他组件都是上游原版，没有修改。
