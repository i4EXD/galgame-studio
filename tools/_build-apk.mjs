/* 一键构建 Android APK：
   1. 构建编辑器单文件 HTML（vite build）
   2. 复制进 android/app/src/main/assets/www/
   3. 调用 Gradle 打包（debug + release 各一份）
   用法: node tools/_build-apk.mjs [--skip-web] [--debug-only] */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const androidSource = path.join(root, 'android');
const sdkDir = process.env.ANDROID_SDK_ROOT || 'D:\\android-sdk';
const gradle = path.join(sdkDir, 'gradle-8.9', 'bin', 'gradle.bat');
const assetsDir = path.join(androidSource, 'app', 'src', 'main', 'assets', 'www');

const skipWeb = process.argv.includes('--skip-web');
const debugOnly = process.argv.includes('--debug-only');
const versionName = /versionName\s+"([^"]+)"/.exec(fs.readFileSync(path.join(androidSource, 'app', 'build.gradle'), 'utf8'))?.[1];
if (!versionName) throw new Error('Missing Android versionName');

/** Gradle/AGP 在 Windows 上拒绝含非 ASCII 的工程路径，这里自动用 junction 映射到纯英文路径构建 */
function asciiBuildDir(sourceDir) {
  if (!/[^\x00-\x7F]/.test(sourceDir)) return sourceDir;
  const link = process.env.GS_ANDROID_BUILD || 'D:\\gs-android-build';
  if (!fs.existsSync(link)) {
    const created = spawnSync('cmd.exe', ['/c', 'mklink', '/J', link, sourceDir], { encoding: 'utf8' });
    if (created.status !== 0) {
      console.error(`创建 junction 失败：${created.stderr || created.stdout}`);
      console.error('可以手动执行： cmd /c mklink /J D:\\gs-android-build "' + sourceDir + '"');
      process.exit(1);
    }
    console.log(`已创建 junction：${link} → ${sourceDir}`);
  }
  return link;
}

function run(command, args, options = {}) {
  // Windows 上 Node 不允许直接 spawn .cmd/.bat（安全策略），统一走 cmd /c
  const viaCmd = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
  const finalCommand = viaCmd ? 'cmd.exe' : command;
  const finalArgs = viaCmd ? ['/c', command, ...args] : args;
  console.log(`\n$ ${command} ${args.join(' ')}`);
  const result = spawnSync(finalCommand, finalArgs, {
    stdio: 'inherit',
    cwd: options.cwd || root,
    env: { ...process.env, ...(options.env || {}) },
    shell: false,
  });
  if (result.status !== 0) {
    console.error(`命令失败（exit ${result.status}）`);
    process.exit(result.status || 1);
  }
}

/* 1. 网页产物 */
if (!skipWeb) {
  // 直接跑 vite，省掉 npm 这一层（Windows 上更稳）
  run(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], { cwd: root });
}

const distHtml = path.join(root, 'dist', 'index.html');
if (!fs.existsSync(distHtml)) {
  console.error('没有找到 dist/index.html，请先构建网页版');
  process.exit(1);
}

/* 2. 拷进 Android assets */
fs.mkdirSync(assetsDir, { recursive: true });
fs.copyFileSync(distHtml, path.join(assetsDir, 'index.html'));
console.log(`已复制编辑器到 android assets（${(fs.statSync(distHtml).size / 1024 / 1024).toFixed(2)} MB）`);

/* 3. 写 local.properties 指向 SDK */
fs.writeFileSync(
  path.join(androidSource, 'local.properties'),
  `sdk.dir=${sdkDir.replace(/\\/g, '\\\\')}\n`,
);

if (!fs.existsSync(gradle)) {
  console.error(`找不到 Gradle：${gradle}`);
  console.error('请确认 Android SDK 与 Gradle 已就位（见 README 的 Android 章节）');
  process.exit(1);
}
if (!fs.existsSync(sdkDir)) {
  console.error(`找不到 Android SDK：${sdkDir}`);
  process.exit(1);
}
if (/[^\x00-\x7F]/.test(sdkDir)) {
  console.error(`Android SDK 路径含非 ASCII 字符（${sdkDir}），请把它放到纯英文路径下，例如 D:\\android-sdk`);
  process.exit(1);
}

/* 4. 打包（工程路径含中文时自动走 junction） */
const androidDir = asciiBuildDir(androidSource);
const tasks = debugOnly ? ['assembleDebug'] : ['assembleDebug', 'assembleRelease'];
run(gradle, ['--no-daemon', '--console=plain', ...tasks], {
  cwd: androidDir,
  env: { ANDROID_SDK_ROOT: sdkDir, ANDROID_HOME: sdkDir, JAVA_TOOL_OPTIONS: '-Dfile.encoding=UTF-8' },
});

/* 5. 汇总产物 */
const outputs = [
  ['debug', path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')],
  ['release', path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')],
].filter(([, file]) => fs.existsSync(file));

console.log('\n=== 构建完成 ===');
for (const [kind, file] of outputs) {
  console.log(`${kind.padEnd(8)} ${(fs.statSync(file).size / 1024 / 1024).toFixed(2)} MB  ${file}`);
}
const outDir = path.join(root, 'dist-android');
fs.mkdirSync(outDir, { recursive: true });
for (const [kind, file] of outputs) {
  const target = path.join(outDir, `GalgameStudio-${versionName}-${kind}.apk`);
  fs.copyFileSync(file, target);
  console.log(`已复制 → ${target}`);
}
