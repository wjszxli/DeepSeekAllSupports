#!/usr/bin/env node

/**
 * Chrome 扩展发布脚本
 *
 * 流程：bump version -> clean -> build -> 校验 -> 压缩 extension/ -> extension.zip
 *
 * 用法：
 *   pnpm release              # 默认 patch（1.0.14 -> 1.0.15）
 *   pnpm release minor        # 1.0.14 -> 1.1.0
 *   pnpm release major        # 1.0.14 -> 2.0.0
 *   pnpm release 1.2.3        # 直接指定版本号
 *
 * 产物 extension.zip 的 manifest.json 位于压缩包根目录（Chrome 应用商店要求），
 * 不包含 macOS 的 __MACOSX/ 与 .DS_Store 等无关文件。
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');
const EXTENSION_DIR = path.join(ROOT, 'extension');
const ZIP_PATH = path.join(ROOT, 'extension.zip');
const PKG_INDENT = 4;

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

// ---------- 参数解析 ----------

function parseArgs(argv) {
    const positional = [];
    const flags = {};
    for (const arg of argv) {
        if (arg === '-h' || arg === '--help') {
            flags.help = true;
        } else if (arg.startsWith('--')) {
            const [key, value] = arg.slice(2).split('=');
            flags[key] = value ?? true;
        } else {
            positional.push(arg);
        }
    }
    return { positional, flags };
}

function showUsage() {
    console.log(`AiAllSupport 发布脚本

用法:
  pnpm release [patch|minor|major|x.y.z]

示例:
  pnpm release            bump patch  (1.0.14 -> 1.0.15)
  pnpm release minor      bump minor  (1.0.14 -> 1.1.0)
  pnpm release major      bump major  (1.0.14 -> 2.0.0)
  pnpm release 1.2.3      指定版本号

流程:
  1. 修改 package.json 的 version（构建会自动同步到 extension/manifest.json）
  2. 清理 extension/ 与旧的 extension.zip
  3. pnpm build
  4. 将 extension/ 打包为根目录布局的 extension.zip（适配 Chrome 应用商店）`);
}

// ---------- 版本号 ----------

function resolveNextVersion(current, input) {
    if (!input || input === 'patch') {
        return bump(current, 'patch');
    }
    if (input === 'minor' || input === 'major') {
        return bump(current, input);
    }
    if (SEMVER_RE.test(input)) {
        return input;
    }
    fail(`无效的版本参数: "${input}"（应为 patch / minor / major 或 x.y.z）`);
    return null; // unreachable
}

function bump(current, kind) {
    if (!SEMVER_RE.test(current)) {
        fail(`package.json 当前版本号格式异常: "${current}"`);
    }
    const [major, minor, patch] = current.split('.').map(Number);
    switch (kind) {
        case 'major':
            return `${major + 1}.0.0`;
        case 'minor':
            return `${major}.${minor + 1}.0`;
        case 'patch':
            return `${major}.${minor}.${patch + 1}`;
        default:
            fail(`未知的 bump 类型: "${kind}"`);
    }
    return null; // unreachable
}

// ---------- 文件操作 ----------

function readPkg() {
    return JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
}

function writePkgVersion(pkg, nextVersion) {
    pkg.version = nextVersion;
    fs.writeFileSync(PKG_PATH, `${JSON.stringify(pkg, null, PKG_INDENT)}\n`);
}

function rmrf(target) {
    fs.rmSync(target, { recursive: true, force: true });
}

// ---------- 子进程 ----------

function runBuild() {
    logStep('执行 pnpm build');
    const result = spawnSync('pnpm', ['run', 'build'], {
        cwd: ROOT,
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });
    if (result.error) {
        if (result.error.code === 'ENOENT') {
            fail('未找到 pnpm，请先安装 pnpm 后再执行发布。');
        }
        throw result.error;
    }
    if (result.status !== 0) {
        fail(`pnpm build 失败（退出码 ${result.status}）`);
    }
}

function makeZip() {
    logStep(`压缩 extension/ -> ${path.relative(ROOT, ZIP_PATH)}`);
    // 在 extension 目录内打包，使 manifest.json 位于 zip 根目录
    const result = spawnSync(
        'zip',
        ['-r', '-X', ZIP_PATH, '.', '-x', '*.DS_Store', '__MACOSX', '__MACOSX/*'],
        { cwd: EXTENSION_DIR, stdio: 'inherit' },
    );
    if (result.error) {
        if (result.error.code === 'ENOENT') {
            fail('未找到系统 zip 命令，请先安装 zip 后再执行发布。');
        }
        throw result.error;
    }
    if (result.status !== 0) {
        fail(`zip 打包失败（退出码 ${result.status}）`);
    }
}

// ---------- 校验 ----------

function assertBuiltManifestVersion(expected) {
    const manifestPath = path.join(EXTENSION_DIR, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        fail(`构建后未找到 ${manifestPath}，请检查 build 是否成功。`);
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.version !== expected) {
        fail(
            `版本号不一致：package.json=${expected}，manifest.json=${manifest.version}\n` +
                '请确认 src/manifest.ts 仍读取 pkg.version。',
        );
    }
}

function assertZipHasRootManifest() {
    const { stdout } = spawnSync('unzip', ['-Z1', ZIP_PATH], { encoding: 'utf8' });
    const entries = (stdout || '').split('\n').map((s) => s.trim()).filter(Boolean);
    if (!entries.includes('manifest.json')) {
        fail('extension.zip 根目录未找到 manifest.json，Chrome 应用商店会拒绝该包。');
    }
}

// ---------- 工具 ----------

function logStep(msg) {
    console.log(`\n▶ ${msg}`);
}

function fail(msg) {
    console.error(`\n✖ ${msg}`);
    process.exit(1);
}

function fmtSize(bytes) {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

// ---------- 主流程 ----------

function main() {
    const { positional, flags } = parseArgs(process.argv.slice(2));
    if (flags.help) {
        showUsage();
        return;
    }

    const pkg = readPkg();
    const currentVersion = pkg.version;
    const nextVersion = resolveNextVersion(currentVersion, positional[0]);

    if (nextVersion === currentVersion) {
        console.log(`版本号无变化（仍为 ${currentVersion}），继续构建与打包。`);
    } else {
        console.log(`版本号：${currentVersion} -> ${nextVersion}`);
    }

    // 1. 写入新版本号
    logStep(`写入 package.json (version=${nextVersion})`);
    writePkgVersion(pkg, nextVersion);

    // 2. 清理旧产物，保证 zip 干净
    logStep('清理 extension/ 与旧的 extension.zip');
    rmrf(EXTENSION_DIR);
    rmrf(ZIP_PATH);

    // 3. 构建
    runBuild();

    // 4. 校验构建产物版本号一致
    logStep('校验 extension/manifest.json 版本号');
    assertBuiltManifestVersion(nextVersion);

    // 5. 打包
    makeZip();

    // 6. 校验 zip 布局适配 Chrome 商店
    logStep('校验 extension.zip 布局');
    assertZipHasRootManifest();

    const size = fs.statSync(ZIP_PATH).size;
    console.log(
        `\n✅ 发布完成\n` +
            `   version : ${nextVersion}\n` +
            `   artifact: ${path.relative(ROOT, ZIP_PATH)} (${fmtSize(size)})\n` +
            `   上传：Chrome 应用商店 -> 打包内容 -> 上传 extension.zip`,
    );
}

main();
