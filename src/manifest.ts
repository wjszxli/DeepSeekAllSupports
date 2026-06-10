import type { Manifest } from 'webextension-polyfill';

import pkg from '../package.json';
import { __DEV__ } from '../server/utils/constants';

const manifest: Manifest.WebExtensionManifest = {
    name: pkg.displayName,
    version: pkg.version,
    description: pkg.description,
    manifest_version: 3,
    minimum_chrome_version: pkg.browserslist.split(' ')[2],
    permissions: ['storage', 'declarativeNetRequest', 'contextMenus', 'commands', 'activeTab', 'scripting', 'sidePanel'],
    host_permissions: ['https://*/*', 'http://*/*'],
    content_security_policy: {
        extension_pages: __DEV__
            ? "script-src 'self' http://localhost; object-src 'self';"
            : "script-src 'self'; object-src 'self';",
    },
    web_accessible_resources: [
        {
            matches: ['<all_urls>'],
            resources: ['icons/*', 'images/*', 'fonts/*','*.html'],
        },
    ],
    background: {
        service_worker: 'js/background.js',
    },
    content_scripts: [
        {
            matches: ['<all_urls>'],
            css: ['css/all.css'],
            js: ['js/all.js'],
        },
    ],
    action: {
        default_popup: 'popup.html',
        default_icon: {
            '16': 'icons/icon16.png',
            '32': 'icons/icon32.png',
            '48': 'icons/icon48.png',
            '128': 'icons/icon128.png',
        },
    },
    options_ui: {
        page: 'options.html',
        open_in_tab: true,
    },
    // @ts-ignore
    side_panel: {
        default_path: "sidepanel.html"
    },
    icons: {
        '16': 'icons/icon16.png',
        '32': 'icons/icon32.png',
        '48': 'icons/icon48.png',
        '128': 'icons/icon128.png',
    },
    commands: {
        'open-chat': {
            suggested_key: {
                default: 'Ctrl+Shift+Y',
                mac: 'Command+Shift+Y',
                windows: 'Ctrl+Shift+Y',
            },
            description: '打开 AI 聊天窗口.',
        },
    },
};
if (!__DEV__) {
    manifest.content_scripts?.unshift({
        matches: ['<all_urls>'],
        js: ['js/vendor.js'],
    });
}

export default manifest;
