import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT_RELATIVE = 'work/github-dadian-game';
const MARKER = '.public-source-export.json';
const FORMAT = 'dadian-public-source-v1';
const DATABASE_PLACEHOLDER = '00000000-0000-4000-8000-000000000000';
const SOURCE_DIRECTORIES = new Map([
  ['app', new Set(['.ts', '.tsx', '.css'])],
  ['lib', new Set(['.ts'])],
  ['db', new Set(['.ts'])],
  ['drizzle', new Set(['.sql', '.json'])],
]);
const SOURCE_FILES = [
  'README.md', 'package.json', 'package-lock.json', 'tsconfig.json',
  'next.config.ts', 'vite.config.ts', 'eslint.config.mjs', 'drizzle.config.ts',
  'scripts/export-public-source.mjs',
  'public/favicon.svg', 'public/og.png', 'public/_headers',
  'public/audio/SOURCES.md', 'public/audio/kenney-casino-license.txt',
];
const GESTURES = [
  'accumulate-fists-v2', 'five6-hands-v2', 'five6-hands-sleeved-v3',
  'five7-cupped-hand-sleeved-v2', 'five8-right-entry-hand-v3',
  'five9-hook-hand-v2', 'five10-side-hand-v1', 'push-palm-v1',
  'pull-inbetweens-v1', 'pull-grip-atlas-v1', 'pull-grip-atlas-v2',
  'gun-ak47-v1', 'mass-taichi-poses-v1', 'punch-fist-v1',
  'raise-fist-front-v2', 'snap-hand-together-v3', 'guard-backs-v2',
  'golden-angel-wings-v1', 'heat-flame-v1', 'convert-blind-box-cutout-v2',
  'ice-cutout-v2', 'super-palms-flat-v3', 'super-palms-mid-v3',
  'super-palms-curved-v2', 'friction-far-hand-v3', 'friction-near-hand-v3',
];
const VOICES = ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R17', 'R18', 'R19', 'R20', 'R21'];
const AUDIO_FILES = [
  'public/audio/lobby/laomushi-gondboy.mp3',
  ...VOICES.map(id => `public/audio/results/${id}.${id === 'R07' || id === 'R09' ? 'wav' : 'mp3'}`),
];
const BINARY_EXTENSIONS = new Set(['.png', '.webp', '.mp3', '.wav']);
const LOCAL_OUTPUT_DIRECTORIES = new Set(['.git', 'node_modules', '.next', '.vinext', '.wrangler', 'dist', 'out', 'coverage', 'work']);
const PRIVATE_NAME = /^(?:\..*|node_modules|work|output|outputs|music|extracted-audio|records|dist)$/i;
const SENSITIVE_PATTERNS = [
  ['本机个人目录', /(?:[a-z]:[\\/]Users[\\/][^\s/\\]+|\/(?:Users|home)\/[^\s/]+)/i],
  ['私钥', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['常见凭据格式', /\b(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|AIza[A-Za-z0-9_-]{30,}|xox[baprs]-[A-Za-z0-9-]{10,})/],
  ['网址中的口令参数', /[?&](?:pwd|passcode|password|access_token|api_key|secret)=[^\s&"'<>]{3,}/i],
];

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const fail = message => { throw new Error(message); };

async function info(filename) {
  try { return await lstat(filename); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
}

function inside(root, filename) {
  const relative = path.relative(root, filename);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function noSymlinks(root, relative) {
  const parts = relative.split('/');
  if (parts.some(part => !part || part === '.' || part === '..') || path.isAbsolute(relative)) fail('路径不在允许范围内。');
  let filename = root;
  for (const part of parts) {
    filename = path.join(filename, part);
    const entry = await info(filename);
    if (entry?.isSymbolicLink()) fail(`拒绝符号链接：${relative}`);
  }
  if (!inside(root, filename)) fail('路径越过工作区边界。');
  return filename;
}

async function readSource(root, relative) {
  const filename = await noSymlinks(root, relative);
  const entry = await info(filename);
  if (!entry?.isFile()) fail(`白名单文件缺失或不是普通文件：${relative}`);
  if (entry.nlink > 1) fail(`拒绝源文件硬链接：${relative}`);
  if (entry.size >= 100 * 1024 * 1024) fail(`文件达到 100 MiB 限制：${relative}`);
  return readFile(filename);
}

async function sourceFiles(root, relative, extensions) {
  const directory = await noSymlinks(root, relative);
  const result = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (PRIVATE_NAME.test(entry.name)) continue;
    const filename = `${relative}/${entry.name}`;
    if (entry.isSymbolicLink()) fail(`拒绝源文件符号链接：${filename}`);
    if (entry.isDirectory()) result.push(...await sourceFiles(root, filename, extensions));
    else if (entry.isFile() && extensions.has(path.extname(entry.name))) result.push(filename);
    else fail(`源码目录出现未审核文件类型，请先更新白名单：${filename}`);
  }
  return result;
}

function checkText(relative, bytes) {
  if (BINARY_EXTENSIONS.has(path.extname(relative))) return;
  const lines = bytes.toString('utf8').split(/\r?\n/);
  for (const [index, line] of lines.entries()) for (const [kind, pattern] of SENSITIVE_PATTERNS) {
    if (pattern.test(line)) fail(`公开检查停止：${relative}:${index + 1} 疑似${kind}；不会输出该值。`);
  }
}

function checkRuntimeAssets(plan) {
  const preload = plan.get('app/gesture-preload.tsx')?.toString('utf8') ?? '';
  const list = preload.match(/GESTURE_PRELOAD_URLS\s*=\s*\[([\s\S]*?)\]\.map/);
  if (!list) fail('无法检查手势预加载清单，请更新导出脚本。');
  const current = [...list[1].matchAll(/['"]([a-z0-9-]+)['"]/g)].map(match => match[1]).sort();
  if (JSON.stringify(current) !== JSON.stringify([...GESTURES].sort())) fail('运行手势清单已变化，请先审核并更新 26 项资源白名单。');
  // A retired CSS background is explicitly reset to none later in the same file.
  const retired = '/gestures/ice-reference-sheet-v1.optimized.webp';
  const css = plan.get('app/document-effects.css')?.toString('utf8') ?? '';
  if (css.includes(retired) && !/\.ice-photo\s*\{[^}]*background\s*:\s*none/.test(css)) fail('旧冰块背景重新生效，请重新审核资源清单。');
  for (const [relative, bytes] of plan) {
    if (!relative.startsWith('app/') && !relative.startsWith('lib/')) continue;
    for (const match of bytes.toString('utf8').matchAll(/\/(?:gestures|audio)\/[a-zA-Z0-9_./-]+\.(?:webp|png|wav|mp3)/g)) {
      if (match[0] === retired && relative === 'app/document-effects.css') continue;
      if (!plan.has(`public${match[0]}`)) fail(`源码引用的静态素材未列入白名单：${relative} → ${match[0]}`);
    }
  }
}

export async function buildPublicSourcePlan(root = SOURCE_ROOT) {
  root = await realpath(root);
  const files = [...SOURCE_FILES, ...AUDIO_FILES, ...GESTURES.map(name => `public/gestures/${name}.optimized.webp`)];
  for (const [directory, extensions] of SOURCE_DIRECTORIES) files.push(...await sourceFiles(root, directory, extensions));
  const plan = new Map();
  for (const relative of files.sort()) plan.set(relative, await readSource(root, relative));
  const sourceNotes = plan.get('public/audio/SOURCES.md').toString('utf8');
  const publicAudioNotice = '# 当前公开快照说明\n\n当前运行资源为 `lobby/laomushi-gondboy.mp3` 与 `results/` 下的 15 条结算语音。项目所有者已确认随本项目公开上传这些音频，但这不额外担保第三方权利，也不为这些音频统一授予 CC0 或其他开源许可。实际音轨选择见 `lib/lobby-music.ts` 与 `lib/settlement-catalog.ts`，固定内容校验见对应测试。\n\n以下保留历史选材与许可证记录，其中 active、未发布、待审批等措辞仅描述当时状态；下列旧动作音轨不包含在当前运行资源中。Kenney 许可证只适用于其明确列出的历史素材。\n\n---\n\n';
  // Avoid duplicating the notice when exporting an already public source tree.
  plan.set('public/audio/SOURCES.md', Buffer.from(sourceNotes.startsWith('# 当前公开快照说明\n') ? sourceNotes : publicAudioNotice + sourceNotes));
  const gitignore = (await readSource(root, '.gitignore')).toString('utf8');
  plan.set('.gitignore', Buffer.from(`${gitignore.trimEnd()}\n\n# Public snapshot administration (not application content)\n/${MARKER}\n`));
  // Reconstruct public configuration; never copy or parse production identifiers.
  plan.set('.openai/hosting.json', json({ project_id: 'appgprj_00000000000000000000000000000000', d1: 'DB', r2: null }));
  plan.set('wrangler.deploy.jsonc', json({
    $schema: 'node_modules/wrangler/config-schema.json', name: 'dadian-game',
    main: 'dist/server/index.js', compatibility_date: '2026-05-15',
    compatibility_flags: ['nodejs_compat'], no_bundle: true, workers_dev: true,
    assets: { directory: 'dist/client' },
    d1_databases: [{ binding: 'DB', database_name: 'dadian-game-db', database_id: DATABASE_PLACEHOLDER }],
    rules: [{ type: 'ESModule', globs: ['**/*.js', '**/*.mjs'] }],
    observability: { enabled: true },
  }));
  for (const [relative, bytes] of plan) checkText(relative, bytes);
  checkRuntimeAssets(plan);
  return new Map([...plan].sort(([a], [b]) => a.localeCompare(b)));
}

async function checkUnmanagedFiles(output, managed, relative = '') {
  for (const entry of await readdir(path.join(output, relative), { withFileTypes: true })) {
    const filename = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) fail(`导出目录包含符号链接，拒绝写入：${filename}`);
    if (entry.isDirectory()) {
      // Local verification and a separately initialized Git repository are not
      // source inputs. Do not traverse their potentially large private state.
      if (!relative && LOCAL_OUTPUT_DIRECTORIES.has(entry.name)) continue;
      await checkUnmanagedFiles(output, managed, filename);
    } else if (filename !== MARKER && !Object.hasOwn(managed, filename)
      && !['next-env.d.ts', 'tsconfig.tsbuildinfo'].includes(filename)) {
      fail(`导出目录包含非托管文件：${filename}；请人工处理，脚本不会删除。`);
    }
  }
}

async function checkDestination(root, plan) {
  const output = await noSymlinks(root, OUTPUT_RELATIVE);
  const existing = await info(output);
  let previous = {};
  if (existing) {
    if (!existing.isDirectory()) fail('导出目标已存在但不是目录。');
    const markerPath = await noSymlinks(output, MARKER);
    const markerInfo = await info(markerPath);
    if (!markerInfo?.isFile()) fail('目标目录已存在且没有管理标记；拒绝写入，不会删除任何文件。');
    if (markerInfo.nlink > 1) fail('管理标记是硬链接；拒绝写入。');
    let marker;
    try { marker = JSON.parse(await readFile(markerPath, 'utf8')); }
    catch { fail('管理标记无法解析；拒绝写入。'); }
    if (marker.format !== FORMAT || marker.destination !== OUTPUT_RELATIVE || !marker.files || Array.isArray(marker.files) || typeof marker.files !== 'object') fail('管理标记格式不匹配；拒绝写入。');
    previous = marker.files;
    await checkUnmanagedFiles(output, previous);
    for (const [relative, hash] of Object.entries(previous)) {
      if (!/^[a-f0-9]{64}$/.test(hash)) fail('管理标记含无效摘要；拒绝写入。');
      await noSymlinks(output, relative);
      if (!plan.has(relative)) fail(`旧托管文件已不在白名单中：${relative}；请人工处理，脚本不会删除。`);
    }
  }
  for (const [relative, bytes] of plan) {
    const target = await noSymlinks(output, relative);
    const entry = await info(target);
    if (!entry) continue;
    if (!entry.isFile() || entry.nlink > 1 || !Object.hasOwn(previous, relative)) fail(`目标有非托管文件或硬链接冲突：${relative}`);
    const actual = digest(await readFile(target));
    if (actual !== previous[relative] && actual !== digest(bytes)) fail(`目标文件被手工修改，拒绝覆盖：${relative}`);
  }
  return { output, previous };
}

async function writeManagedFile(output, relative, bytes) {
  const target = await noSymlinks(output, relative);
  const entry = await info(target);
  if (entry && (!entry.isFile() || entry.nlink > 1)) fail(`写入前检查失败，不是独立普通文件：${relative}`);
  await writeFile(target, bytes);
}

async function run() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log('用法：node scripts/export-public-source.mjs [--check]\n--check 只读校验，不创建或写入导出目录。');
    return;
  }
  if (args.some(arg => arg !== '--check') || args.length > 1) fail('仅支持 --check；输出位置固定，不能指定其他路径。');
  const root = await realpath(SOURCE_ROOT);
  const plan = await buildPublicSourcePlan(root);
  const { output, previous } = await checkDestination(root, plan);
  const total = [...plan.values()].reduce((sum, bytes) => sum + bytes.length, 0);
  if (args[0] === '--check') {
    console.log(`只读检查通过：${plan.size} 个文件，${total} 字节；26 个手势、16 个运行音频。未创建或写入导出目录。`);
    return;
  }
  await mkdir(output, { recursive: true });
  // An interrupted first export remains recoverable only with this exact marker.
  await writeManagedFile(output, MARKER, json({ format: FORMAT, destination: OUTPUT_RELATIVE, files: previous }));
  const managed = { ...previous };
  for (const [relative, bytes] of plan) {
    const target = await noSymlinks(output, relative);
    await mkdir(path.dirname(target), { recursive: true });
    if (!(await info(target)) || digest(await readFile(target)) !== digest(bytes)) await writeManagedFile(output, relative, bytes);
    managed[relative] = digest(bytes);
    await writeManagedFile(output, MARKER, json({ format: FORMAT, destination: OUTPUT_RELATIVE, files: managed }));
  }
  console.log(`已导出 ${plan.size} 个文件（${total} 字节）到 ${OUTPUT_RELATIVE}。未删除文件，未执行 Git 或上传；请在快照中重新测试和构建。`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch(error => { console.error(error.message); process.exitCode = 1; });
}
