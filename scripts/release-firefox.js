#!/usr/bin/env node

/**
 * Firefox 扩展打包脚本
 *
 * 流程：build -> 复制 extension/ -> extension-firefox/ -> 改造成 Firefox manifest -> 打包 extension-firefox.zip
 *
 * 与 Chrome 包的 manifest 差异（自动改造）：
 *   1. background.service_worker  ->  background.scripts（Firefox 事件页，兼容性最好）
 *   2. side_panel                 ->  sidebar_action（Firefox 侧边栏）
 *   3. 移除 sidePanel 权限、minimum_chrome_version
 *   4. 增加 browser_specific_settings.gecko（Firefox 安装/签名必需）
 *
 * ⚠️ 运行时注意：src/background/index.ts 里调用了 chrome.sidePanel.setOptions()，
 *    Firefox 不支持该 API。本脚本只负责打包（包能正常安装），但侧边栏功能在
 *    Firefox 中需要代码层兼容（用 browser.sidebarAction 或对 chrome.sidePanel 做守卫）后才能工作。
 *
 * 用法：
 *   pnpm release:firefox                     # 默认 gecko id = wjszxli@gmail.com
 *   pnpm release:firefox --gecko-id a@b.com  # 自定义 gecko id（AMO 上传需与已登记 id 一致）
 *   pnpm release:firefox --no-build          # 复用已存在的 extension/，跳过 build
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CHROME_DIR = path.join(ROOT, 'extension');
const FIREFOX_DIR = path.join(ROOT, 'extension-firefox');
const ZIP_PATH = path.join(ROOT, 'extension-firefox.zip');
const MANIFEST_PATH = path.join(FIREFOX_DIR, 'manifest.json');
const PKG_INDENT = 4;

const DEFAULT_GECKO_ID = 'wjszxli@gmail.com';
const GECKO_STRICT_MIN = '115.0'; // MV3 + background.scripts + declarativeNetRequest 的安全下限

// ---------- 参数 ----------

function parseArgs(argv) {
    const flags = { geckoId: DEFAULT_GECKO_ID, noBuild: false, help: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '-h' || arg === '--help') {
            flags.help = true;
        } else if (arg === '--no-build') {
            flags.noBuild = true;
        } else if (arg === '--gecko-id') {
            flags.geckoId = argv[i + 1];
            i += 1;
        } else if (arg.startsWith('--gecko-id=')) {
            flags.geckoId = arg.slice('--gecko-id='.length);
        }
    }
    return flags;
}

function showUsage() {
    console.log(`AiAllSupport Firefox 打包脚本

用法:
  pnpm release:firefox [options]

选项:
  --gecko-id <id>   browser_specific_settings.gecko.id（默认 ${DEFAULT_GECKO_ID}）
  --no-build        复用已存在的 extension/，跳过 pnpm build
  -h, --help        显示帮助

流程:
  1. pnpm build（产出 Chrome 版 extension/）
  2. 复制 extension/ -> extension-firefox/
  3. 改造 manifest.json 为 Firefox 版（service_worker->scripts、side_panel->sidebar_action、加 gecko）
  4. 打包根目录布局的 extension-firefox.zip（适配 AMO 上传）

⚠️ 运行时: chrome.sidePanel.* 在 Firefox 不可用，侧边栏功能需代码层兼容。`);
}

// ---------- 工具 ----------

function logStep(msg) {
    console.log(`\n▶ ${msg}`);
}

function fail(msg) {
    console.error(`\n✖ ${msg}`);
    process.exit(1);
}

function rmrf(target) {
    fs.rmSync(target, { recursive: true, force: true });
}

function fmtSize(bytes) {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(s, d);
        } else if (entry.isSymbolicLink()) {
            fs.symlinkSync(fs.readlinkSync(s), d);
        } else {
            fs.copyFileSync(s, d);
        }
    }
}

function runBuild() {
    logStep('执行 pnpm build');
    const result = spawnSync('pnpm', ['run', 'build'], {
        cwd: ROOT,
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });
    if (result.error) {
        if (result.error.code === 'ENOENT') fail('未找到 pnpm，请先安装 pnpm。');
        throw result.error;
    }
    if (result.status !== 0) fail(`pnpm build 失败（退出码 ${result.status}）`);
}

// ---------- Firefox manifest 改造 ----------

function toFirefoxManifest(chromeManifest, geckoId) {
    // 深拷贝，避免改到源对象
    const ff = JSON.parse(JSON.stringify(chromeManifest));

    // 1. background.service_worker -> scripts（Firefox 事件页）
    if (ff.background && ff.background.service_worker) {
        ff.background = { scripts: [ff.background.service_worker] };
    }

    // 2. side_panel -> sidebar_action
    if (ff.side_panel && ff.side_panel.default_path) {
        ff.sidebar_action = {
            default_panel: ff.side_panel.default_path,
            default_title: ff.name || ff.description || 'AiAllSupport',
            default_icon: (ff.action && ff.action.default_icon) || ff.icons,
        };
        delete ff.side_panel;
    }

    // 3. 移除 Chrome 专属字段
    if (Array.isArray(ff.permissions)) {
        ff.permissions = ff.permissions.filter((p) => p !== 'sidePanel');
    }
    delete ff.minimum_chrome_version;

    // 4. browser_specific_settings.gecko（保留已有的其它浏览器设置）
    ff.browser_specific_settings = {
        ...(ff.browser_specific_settings || {}),
        gecko: { id: geckoId, strict_min_version: GECKO_STRICT_MIN },
    };

    return ff;
}

// ---------- 打包与校验 ----------

function makeZip() {
    logStep(`压缩 ${path.relative(ROOT, FIREFOX_DIR)}/ -> ${path.relative(ROOT, ZIP_PATH)}`);
    const result = spawnSync(
        'zip',
        ['-r', '-X', ZIP_PATH, '.', '-x', '*.DS_Store', '__MACOSX', '__MACOSX/*'],
        { cwd: FIREFOX_DIR, stdio: 'inherit' },
    );
    if (result.error) {
        if (result.error.code === 'ENOENT') fail('未找到系统 zip 命令，请先安装 zip。');
        throw result.error;
    }
    if (result.status !== 0) fail(`zip 打包失败（退出码 ${result.status}）`);
}

function assertFirefoxManifest(manifest, geckoId) {
    const problems = [];
    if (manifest.background && manifest.background.service_worker) {
        problems.push('background 仍为 service_worker（应为 scripts）');
    }
    if (manifest.side_panel) problems.push('仍存在 side_panel（应为 sidebar_action）');
    if (!manifest.sidebar_action) problems.push('缺少 sidebar_action');
    if (!manifest.browser_specific_settings || !manifest.browser_specific_settings.gecko) {
        problems.push('缺少 browser_specific_settings.gecko');
    } else if (manifest.browser_specific_settings.gecko.id !== geckoId) {
        problems.push('gecko.id 与预期不一致');
    }
    if (Array.isArray(manifest.permissions) && manifest.permissions.includes('sidePanel')) {
        problems.push('permissions 仍含 sidePanel');
    }
    if (problems.length) fail('Firefox manifest 校验未通过:\n  - ' + problems.join('\n  - '));
}

function assertJsFileSizes() {
    const jsDir = path.join(FIREFOX_DIR, 'js');
    if (!fs.existsSync(jsDir)) return;

    const MAX_JS_BYTES = 4.5 * 1024 * 1024; // Firefox 非二进制文件解析上限约 5MB，留 0.5MB 余量
    const oversized = [];
    for (const file of fs.readdirSync(jsDir)) {
        if (!file.endsWith('.js')) continue;
        const full = path.join(jsDir, file);
        const size = fs.statSync(full).size;
        if (size > MAX_JS_BYTES) {
            oversized.push(`${path.relative(ROOT, full)} (${fmtSize(size)})`);
        }
    }
    if (oversized.length) {
        fail('以下 JS 文件超过 4.5MB，Firefox 审核会拒绝：\n  - ' + oversized.join('\n  - '));
    }
}

function assertZipLayout() {
    const { stdout } = spawnSync('unzip', ['-Z1', ZIP_PATH], { encoding: 'utf8' });
    const entries = (stdout || '').split('\n').map((s) => s.trim()).filter(Boolean);
    if (!entries.includes('manifest.json')) {
        fail('extension-firefox.zip 根目录未找到 manifest.json，AMO 会拒绝该包。');
    }
}

// ---------- 主流程 ----------

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        showUsage();
        return;
    }
    if (!args.geckoId) fail('--gecko-id 不能为空。');

    if (args.noBuild && !fs.existsSync(path.join(CHROME_DIR, 'manifest.json'))) {
        fail('--no-build 指定，但 extension/ 不存在；请先 pnpm release 或去掉 --no-build。');
    }

    logStep('清理 extension-firefox/ 与旧的 extension-firefox.zip');
    rmrf(FIREFOX_DIR);
    rmrf(ZIP_PATH);

    if (args.noBuild) {
        logStep('复用已存在的 extension/（--no-build）');
    } else {
        runBuild();
    }

    logStep('复制 extension/ -> extension-firefox/');
    copyDir(CHROME_DIR, FIREFOX_DIR);

    // 清理未在 Firefox manifest 中注册且超过解析限制的 content script 产物
    const orphanChatWindows = path.join(FIREFOX_DIR, 'js', 'chat-windows.js');
    if (fs.existsSync(orphanChatWindows)) {
        fs.rmSync(orphanChatWindows);
        console.log(`  已移除未使用的 ${path.relative(ROOT, orphanChatWindows)}`);
    }

    logStep('改造 manifest.json 为 Firefox 版本');
    const chromeManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const firefoxManifest = toFirefoxManifest(chromeManifest, args.geckoId);
    fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(firefoxManifest, null, PKG_INDENT)}\n`);

    assertFirefoxManifest(firefoxManifest, args.geckoId);
    assertJsFileSizes();

    makeZip();
    assertZipLayout();

    const size = fs.statSync(ZIP_PATH).size;
    console.log(
        `\n✅ Firefox 打包完成\n` +
            `   version  : ${firefoxManifest.version}\n` +
            `   gecko id : ${args.geckoId}\n` +
            `   artifact : ${path.relative(ROOT, ZIP_PATH)} (${fmtSize(size)})\n` +
            `   上传：https://addons.mozilla.org/developers/ -> 上传新版本\n` +
            `\n⚠️  运行时提醒：src/background/index.ts 调用了 chrome.sidePanel.setOptions()，` +
            `Firefox 不支持该 API，侧边栏功能需代码层兼容后才能在 Firefox 正常工作。`,
    );
}

main();
