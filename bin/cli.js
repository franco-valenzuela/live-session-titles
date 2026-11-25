#!/usr/bin/env node
// live-session-titles CLI: installer plus helpers for agents that have no native rename tool.
// No dependencies. Works on Windows, macOS and Linux (Node 18+).
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const readline = require('readline');
const { spawnSync } = require('child_process');

const PKG_ROOT = path.resolve(__dirname, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'));
const VERSION = PKG.version;
const NAME = 'live-session-titles';
const HOME = os.homedir();
const IS_WIN = process.platform === 'win32';
const DATA_DIR = path.join(HOME, '.live-session-titles');
const APP_DIR = path.join(DATA_DIR, 'app');
const HISTORY_DIR = path.join(DATA_DIR, 'history');
const MANIFEST = path.join(DATA_DIR, 'manifest.json');
const UPDATE_CACHE = path.join(DATA_DIR, 'update.json');
const BLOCK_START = '<!-- live-session-titles:start -->';
const BLOCK_END = '<!-- live-session-titles:end -->';
const COMMANDS = ['title', 'retitle-all', 'retitle-sidebar', 'retitle-undo'];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ---------- small helpers ----------

function die(msg, code = 1) { console.error(`${NAME}: ${msg}`); process.exit(code); }
function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }
function readJSON(p, fallback) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } }
function writeJSON(p, data) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n'); }
function stamp() { return new Date().toISOString().replace(/[:.]/g, '-'); }
function tilde(p) { return p.startsWith(HOME) ? '~' + p.slice(HOME.length).replace(/\\/g, '/') : p; }

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') && ['agents', 'lang', 'max-words'].includes(k)) out[k] = argv[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

function backupOnce(file) {
  // One backup per file per day; never overwrite an older backup.
  if (!exists(file)) return null;
  const day = new Date().toISOString().slice(0, 10);
  const bak = `${file}.lst-backup-${day}`;
  if (!exists(bak)) fs.copyFileSync(file, bak);
  return bak;
}

// ---------- agents ----------

const AGENTS = {
  claude: {
    label: 'Claude Code (desktop app and CLI)',
    detect: () => exists(path.join(HOME, '.claude')),
    skillDir: () => path.join(HOME, '.claude', 'skills', NAME),
    commandsDir: () => path.join(HOME, '.claude', 'commands'),
    rulesFile: () => path.join(HOME, '.claude', 'CLAUDE.md'),
  },
  codex: {
    label: 'Codex (CLI and desktop)',
    detect: () => exists(path.join(HOME, '.codex')),
    skillDir: () => path.join(HOME, '.codex', 'skills', NAME),
    commandsDir: () => path.join(HOME, '.codex', 'prompts'),
    rulesFile: () => path.join(HOME, '.codex', 'AGENTS.md'),
  },
  opencode: {
    label: 'OpenCode',
    detect: () => exists(path.join(HOME, '.config', 'opencode')),
    skillDir: () => path.join(HOME, '.config', 'opencode', 'skills', NAME),
    commandsDir: () => path.join(HOME, '.config', 'opencode', 'commands'),
    rulesFile: () => path.join(HOME, '.config', 'opencode', 'AGENTS.md'),
  },
  gemini: {
    label: 'Gemini CLI',
    detect: () => exists(path.join(HOME, '.gemini')),
    rulesFile: () => path.join(HOME, '.gemini', 'GEMINI.md'),
  },
  antigravity: {
    label: 'Antigravity',
    detect: () => exists(path.join(HOME, '.gemini', 'antigravity')) || exists(path.join(HOME, '.antigravity')),
    rulesFile: () => path.join(HOME, '.gemini', 'GEMINI.md'),
  },
  windsurf: {
    label: 'Windsurf',
    detect: () => exists(path.join(HOME, '.codeium', 'windsurf')),
    rulesFile: () => path.join(HOME, '.codeium', 'windsurf', 'memories', 'global_rules.md'),
  },
  cursor: {
    label: 'Cursor (manual step: paste rule in Settings > Rules)',
    detect: () => exists(path.join(HOME, '.cursor')),
    manual: true,
  },
};

function ruleText(agent) {
  const base = fs.readFileSync(path.join(PKG_ROOT, 'rules', 'global-rule.md'), 'utf8').trim();
  const how = {
    claude: 'Rename with `mcp__ccd_session_mgmt__set_session_title` (`session_id: "self"`) in the desktop app; in the terminal CLI show `Session: <title>` instead.',
    codex: 'Rename with `live-session-titles codex-rename --current "<title>"`.',
    opencode: 'Rename with `opencode.session.rename` (Code Mode); fallback `live-session-titles opencode-rename <sessionID> "<title>"`.',
  }[agent] || 'This agent cannot rename the real chat: show `Session: <title>` as the first line of your reply once per stage.';
  return `${BLOCK_START}\n${base}\n- ${how}\n${BLOCK_END}`;
}

function upsertBlock(file, block) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const old = exists(file) ? fs.readFileSync(file, 'utf8') : '';
  let next;
  const re = new RegExp(`${BLOCK_START}[\\s\\S]*?${BLOCK_END}`);
  if (re.test(old)) next = old.replace(re, block);
  else next = (old.trimEnd() ? old.trimEnd() + '\n\n' : '') + block + '\n';
  if (next === old) return false;
  backupOnce(file);
  fs.writeFileSync(file, next);
  return true;
}

function removeBlock(file) {
  if (!exists(file)) return false;
  const old = fs.readFileSync(file, 'utf8');
  const re = new RegExp(`\\n*${BLOCK_START}[\\s\\S]*?${BLOCK_END}\\n?`);
  if (!re.test(old)) return false;
  backupOnce(file);
  const next = old.replace(re, '\n').replace(/\n{3,}/g, '\n\n');
  // The installer created this file just for the rule: remove it instead of leaving it empty.
  if (!next.trim()) fs.unlinkSync(file);
  else fs.writeFileSync(file, next);
  return true;
}

// ---------- Claude hook ----------

function hookCommand() {
  const script = path.join(APP_DIR, 'hooks', 'session-start.js').replace(/\\/g, '/');
  return `node "${script}"`;
}

function addClaudeHook() {
  const file = path.join(HOME, '.claude', 'settings.json');
  const s = readJSON(file, {});
  s.hooks = s.hooks || {};
  const list = (s.hooks.SessionStart = s.hooks.SessionStart || []);
  const has = list.some(g => (g.hooks || []).some(h => String(h.command || '').includes(NAME)));
  if (has) return false;
  backupOnce(file);
  list.push({ hooks: [{ type: 'command', command: hookCommand() }] });
  writeJSON(file, s);
  return true;
}

function removeClaudeHook() {
  const file = path.join(HOME, '.claude', 'settings.json');
  if (!exists(file)) return false;
  const s = readJSON(file, null);
  if (!s || !s.hooks || !s.hooks.SessionStart) return false;
  const before = JSON.stringify(s.hooks.SessionStart);
  s.hooks.SessionStart = s.hooks.SessionStart
    .map(g => ({ ...g, hooks: (g.hooks || []).filter(h => !String(h.command || '').includes(NAME)) }))
    .filter(g => g.hooks.length);
  if (JSON.stringify(s.hooks.SessionStart) === before) return false;
  if (!s.hooks.SessionStart.length) delete s.hooks.SessionStart;
  if (!Object.keys(s.hooks).length) delete s.hooks;
  backupOnce(file);
  writeJSON(file, s);
  return true;
}

// ---------- launcher on PATH ----------

function binDir() { return path.join(HOME, '.local', 'bin'); }

function installLauncher() {
  const dir = binDir();
  fs.mkdirSync(dir, { recursive: true });
  const cli = path.join(APP_DIR, 'bin', 'cli.js');
  if (IS_WIN) {
    fs.writeFileSync(path.join(dir, `${NAME}.cmd`), `@echo off\r\nnode "${cli}" %*\r\n`);
  } else {
    const f = path.join(dir, NAME);
    fs.writeFileSync(f, `#!/bin/sh\nexec node "${cli}" "$@"\n`);
    fs.chmodSync(f, 0o755);
  }
  const onPath = (process.env.PATH || '').split(path.delimiter).some(p => path.resolve(p) === path.resolve(dir));
  return { dir, onPath };
}

function removeLauncher() {
  for (const f of [`${NAME}.cmd`, NAME]) { const p = path.join(binDir(), f); if (exists(p)) fs.unlinkSync(p); }
}

// ---------- interactive checklist ----------

async function pickAgents(preselected) {
  const keys = Object.keys(AGENTS);
  const sel = new Set(preselected);
  if (!process.stdin.isTTY) return [...sel];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = q => new Promise(r => rl.question(q, r));
  for (;;) {
    console.log('\nWhich agents should get live session titles?');
    keys.forEach((k, i) => {
      const found = AGENTS[k].detect() ? '' : '  (not detected)';
      console.log(`  ${i + 1}. [${sel.has(k) ? 'x' : ' '}] ${AGENTS[k].label}${found}`);
    });
    const ans = (await ask('Type numbers to toggle (e.g. "2 5"), Enter to install, q to quit: ')).trim();
    if (ans === '') break;
    if (ans.toLowerCase() === 'q') { rl.close(); process.exit(0); }
    for (const n of ans.split(/[\s,]+/)) {
      const k = keys[parseInt(n, 10) - 1];
      if (k) sel.has(k) ? sel.delete(k) : sel.add(k);
    }
  }
  rl.close();
  return keys.filter(k => sel.has(k));
}

// ---------- install / uninstall ----------

async function install(args) {
  let agents;
  if (args.agents) {
    agents = String(args.agents).split(',').map(s => s.trim()).filter(Boolean);
    const bad = agents.filter(a => !AGENTS[a]);
    if (bad.length) die(`unknown agent(s): ${bad.join(', ')}. Known: ${Object.keys(AGENTS).join(', ')}`);
  } else {
    const detected = Object.keys(AGENTS).filter(k => AGENTS[k].detect());
    agents = args.yes ? detected : await pickAgents(detected);
  }
  if (!agents.length) die('no agents selected. Nothing to do.');

  // Copy the app so hooks and the launcher keep working after npx cleans its cache.
  if (path.resolve(PKG_ROOT) !== path.resolve(APP_DIR)) {
    fs.rmSync(APP_DIR, { recursive: true, force: true });
    for (const d of ['bin', 'skills', 'commands', 'hooks', 'rules']) copyDir(path.join(PKG_ROOT, d), path.join(APP_DIR, d));
    fs.copyFileSync(path.join(PKG_ROOT, 'package.json'), path.join(APP_DIR, 'package.json'));
  }

  // Merge with a previous install so uninstall still finds files from agents dropped on reinstall.
  const prev = readJSON(MANIFEST, { agents: [], files: [], rules: [] });
  const manifest = { version: VERSION, installed_at: new Date().toISOString(), agents: [...new Set([...prev.agents, ...agents])], files: [...prev.files], rules: [], hook: false };
  const log = [];

  for (const a of agents) {
    const ag = AGENTS[a];
    if (ag.manual) {
      log.push(`${ag.label}: paste this rule in Cursor Settings > Rules > User Rules:\n\n${ruleText(a).split('\n').slice(1, -1).join('\n')}\n`);
      continue;
    }
    if (ag.skillDir) {
      copyDir(path.join(PKG_ROOT, 'skills', NAME), ag.skillDir());
      manifest.files.push(ag.skillDir());
    }
    if (ag.commandsDir) {
      fs.mkdirSync(ag.commandsDir(), { recursive: true });
      for (const c of COMMANDS) {
        const dst = path.join(ag.commandsDir(), `${c}.md`);
        if (exists(dst) && !fs.readFileSync(dst, 'utf8').includes(NAME) && !fs.readFileSync(dst, 'utf8').includes('live-session-titles')) {
          log.push(`${ag.label}: skipped /${c}, a different command with that name already exists (${tilde(dst)}).`);
          continue;
        }
        fs.copyFileSync(path.join(PKG_ROOT, 'commands', `${c}.md`), dst);
        manifest.files.push(dst);
      }
    }
    const rf = ag.rulesFile();
    if (!manifest.rules.includes(rf)) {
      upsertBlock(rf, ruleText(a));
      manifest.rules.push(rf);
    }
    if (a === 'claude') { addClaudeHook(); manifest.hook = true; }
    log.push(`${ag.label}: done.`);
  }

  const launcher = installLauncher();
  for (const r of prev.rules) if (!manifest.rules.includes(r)) manifest.rules.push(r);
  manifest.files = [...new Set(manifest.files)];
  writeJSON(MANIFEST, manifest);

  console.log(`\n${NAME} ${VERSION} installed.\n`);
  for (const l of log) console.log('  ' + l);
  if (!launcher.onPath) console.log(`\n  Note: add ${launcher.dir} to your PATH so agents can run "${NAME}".`);
  console.log(`\nRestart your agents to load the skill. Uninstall any time: ${NAME} uninstall`);
}

function uninstall(args) {
  const m = readJSON(MANIFEST, null);
  if (!m) die('not installed (no manifest found).');
  for (const f of m.files) fs.rmSync(f, { recursive: true, force: true });
  for (const r of m.rules) removeBlock(r);
  removeClaudeHook();
  removeLauncher();
  fs.rmSync(APP_DIR, { recursive: true, force: true });
  fs.rmSync(MANIFEST, { force: true });
  console.log(`${NAME} removed. Rule blocks, commands, skill and hook are gone.`);
  console.log(`History kept in ${tilde(HISTORY_DIR)}${args.purge ? '' : ' (use --purge to delete it)'}.`);
  if (args.purge) fs.rmSync(DATA_DIR, { recursive: true, force: true });
}

function status() {
  const m = readJSON(MANIFEST, null);
  if (!m) { console.log('Not installed.'); return; }
  console.log(`${NAME} ${m.version}, installed ${m.installed_at}`);
  console.log(`Agents: ${m.agents.join(', ')}`);
  const c = readJSON(UPDATE_CACHE, null);
  if (c && c.latest && newer(c.latest, m.version)) console.log(`Update available: ${c.latest} (run "${NAME} update")`);
}

function update() {
  const m = readJSON(MANIFEST, null);
  const agents = m ? m.agents.join(',') : '';
  const npx = IS_WIN ? 'npx.cmd' : 'npx';
  const args = ['-y', `${NAME}@latest`, 'install', '--yes'];
  if (agents) args.push('--agents', agents);
  const r = spawnSync(npx, args, { stdio: 'inherit', shell: IS_WIN });
  process.exit(r.status || 0);
}

// ---------- update check ----------

function newer(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return true; if ((pa[i] || 0) < (pb[i] || 0)) return false; }
  return false;
}

function fetchLatest(timeoutMs) {
  return new Promise(resolve => {
    const req = https.get(`https://registry.npmjs.org/${NAME}/latest`, { timeout: timeoutMs }, res => {
      let s = '';
      res.on('data', d => (s += d));
      res.on('end', () => { try { resolve(JSON.parse(s).version || null); } catch { resolve(null); } });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

async function checkUpdate(args) {
  // Silent on any failure. Checks at most once a week. LST_NO_UPDATE_CHECK=1 turns it off.
  if (process.env.LST_NO_UPDATE_CHECK === '1') return null;
  const cache = readJSON(UPDATE_CACHE, {});
  let latest = cache.latest || null;
  if (args.force || !cache.checked_at || Date.now() - cache.checked_at > WEEK_MS) {
    const v = await fetchLatest(2000);
    if (v) { latest = v; writeJSON(UPDATE_CACHE, { checked_at: Date.now(), latest }); }
  }
  const msg = latest && newer(latest, VERSION) ? `live-session-titles ${latest} is available (installed ${VERSION}). Update: ${NAME} update` : null;
  if (args._ && args._[0] === 'check-update' && msg) console.log(msg);
  return msg;
}

// ---------- Codex ----------

const CODEX_DIR = path.join(HOME, '.codex');
const CODEX_INDEX = path.join(CODEX_DIR, 'session_index.jsonl');

function walk(dir, re, out = []) {
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, re, out); else if (re.test(e.name)) out.push(p);
  }
  return out;
}

function codexIndex() {
  const map = new Map();
  if (!exists(CODEX_INDEX)) return map;
  for (const line of fs.readFileSync(CODEX_INDEX, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const j = JSON.parse(line); if (j.id) map.set(j.id, j); } catch { /* skip bad line */ }
  }
  return map;
}

function codexIdFromFile(f) {
  const m = path.basename(f).match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return m ? m[1] : null;
}

function codexReadRollout(f) {
  const info = { cwd: null, preview: [] };
  let text;
  try { text = fs.readFileSync(f, 'utf8'); } catch { return info; }
  for (const line of text.split('\n')) {
    if (!line) continue;
    let j; try { j = JSON.parse(line); } catch { continue; }
    const p = j.payload || {};
    if (j.type === 'session_meta' && p.cwd) info.cwd = p.cwd;
    if (j.type === 'response_item' && p.type === 'message' && p.role === 'user') {
      const t = (p.content || []).map(c => c.text || '').join(' ').trim();
      if (t && !t.startsWith('#') && !t.startsWith('<')) info.preview.push(t.slice(0, 300));
    }
    if (info.preview.length >= 3) break;
  }
  return info;
}

function codexCurrentId() {
  const files = walk(path.join(CODEX_DIR, 'sessions'), /^rollout-.*\.jsonl$/);
  let best = null, bestT = 0;
  for (const f of files) { const t = fs.statSync(f).mtimeMs; if (t > bestT) { bestT = t; best = f; } }
  return best ? codexIdFromFile(best) : null;
}

function codexList(args) {
  const idx = codexIndex();
  const items = new Map();
  for (const f of walk(path.join(CODEX_DIR, 'sessions'), /^rollout-.*\.jsonl$/)) {
    const id = codexIdFromFile(f); if (!id) continue;
    const r = codexReadRollout(f);
    items.set(id, { source: 'codex', id, title: idx.get(id)?.thread_name || '', cwd: r.cwd, updated_at: idx.get(id)?.updated_at || fs.statSync(f).mtime.toISOString(), archived: false, preview: r.preview });
  }
  for (const f of walk(path.join(CODEX_DIR, 'archived_sessions'), /^rollout-.*\.jsonl(\.zst)?$/)) {
    const id = codexIdFromFile(f); if (!id || items.has(id)) continue;
    const r = f.endsWith('.zst') ? { cwd: null, preview: [] } : codexReadRollout(f);
    items.set(id, { source: 'codex', id, title: idx.get(id)?.thread_name || '', cwd: r.cwd, updated_at: idx.get(id)?.updated_at || fs.statSync(f).mtime.toISOString(), archived: true, preview: r.preview });
  }
  const list = [...items.values()].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  if (args.json) console.log(JSON.stringify(list, null, 2));
  else for (const s of list) console.log(`${s.id}  ${s.archived ? '[archived] ' : ''}${s.title || '(untitled)'}`);
}

function codexRename(args) {
  let [id, ...rest] = args._.slice(1);
  if (args.current) { rest = [id, ...rest].filter(Boolean); id = codexCurrentId(); }
  const title = rest.join(' ').trim();
  if (!id || !title) die('usage: codex-rename <id>|--current "<title>"');
  if (!exists(CODEX_DIR)) die('Codex folder ~/.codex not found.');
  backupOnce(CODEX_INDEX);
  // Append only. Codex reads the last line per id, the same way its own rename works.
  const line = JSON.stringify({ id, thread_name: title, updated_at: new Date().toISOString() });
  fs.appendFileSync(CODEX_INDEX, (exists(CODEX_INDEX) && !fs.readFileSync(CODEX_INDEX, 'utf8').endsWith('\n') ? '\n' : '') + line + '\n');
  console.log(`Codex session ${id} renamed: ${title}`);
}

// ---------- OpenCode ----------

function opencodeBin() {
  if (process.env.LST_OPENCODE_BIN) return process.env.LST_OPENCODE_BIN;
  const which = spawnSync(IS_WIN ? 'where' : 'which', ['opencode'], { encoding: 'utf8' });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.split(/\r?\n/)[0].trim();
  const candidates = IS_WIN
    ? [path.join(process.env.LOCALAPPDATA || '', 'Programs', 'ai.opencode.desktop', 'resources', 'opencode-cli.exe')]
    : ['/Applications/OpenCode.app/Contents/Resources/opencode-cli', path.join(HOME, '.opencode', 'bin', 'opencode')];
  return candidates.find(exists) || null;
}

function opencodeApi(bin, args) {
  const r = spawnSync(bin, ['api', ...args], { encoding: 'utf8', shell: IS_WIN && /\.cmd$/i.test(bin), maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || '').trim() || `opencode api exited ${r.status}`);
  try { return JSON.parse(r.stdout); } catch { throw new Error(r.stdout.trim().slice(0, 200)); }
}

function requireOpencode() {
  const bin = opencodeBin();
  if (!bin) die('OpenCode CLI not found. Install OpenCode or set LST_OPENCODE_BIN. Skipping OpenCode.', 2);
  return bin;
}

function opencodePreview(bin, id) {
  try {
    const res = opencodeApi(bin, ['session.message.list', '--param', `sessionID=${id}`]);
    return (res.data || []).filter(m => m.type === 'user')
      .map(m => (m.metadata && m.metadata.displayText) || (m.content || []).map(c => c.text || '').join(' '))
      .filter(Boolean).slice(0, 3).map(t => t.slice(0, 300));
  } catch { return []; }
}

function opencodeList(args) {
  const bin = requireOpencode();
  const out = [];
  for (const archived of [false, true]) {
    let cursor = null;
    for (let page = 0; page < 50; page++) {
      const p = ['session.list'];
      if (archived) p.push('--param', 'archived=true');
      if (cursor) p.push('--param', `cursor=${cursor}`);
      let res; try { res = opencodeApi(bin, p); } catch (e) { if (!archived) die(`OpenCode server error: ${e.message}`, 2); break; }
      for (const s of res.data || []) {
        if (s.parentID) continue; // child sessions belong to their parent
        if (out.some(o => o.id === s.id)) continue;
        out.push({ source: 'opencode', id: s.id, title: s.title || '', cwd: s.directory || null, updated_at: s.time && s.time.updated ? new Date(s.time.updated).toISOString() : null, archived, running: !!(s.time && s.time.busy && (!s.time.idle || s.time.busy > s.time.idle)) });
      }
      cursor = res.cursor && res.cursor.next;
      if (!cursor || !(res.data || []).length) break;
    }
  }
  if (args.preview !== 'false') for (const s of out) s.preview = opencodePreview(bin, s.id);
  if (args.json) console.log(JSON.stringify(out, null, 2));
  else for (const s of out) console.log(`${s.id}  ${s.archived ? '[archived] ' : ''}${s.title || '(untitled)'}`);
}

function opencodeRename(args) {
  const [id, ...rest] = args._.slice(1);
  const title = rest.join(' ').trim();
  if (!id || !title) die('usage: opencode-rename <sessionID> "<title>"');
  const bin = requireOpencode();
  try { opencodeApi(bin, ['session.update', '--param', `sessionID=${id}`, '--data', JSON.stringify({ title })]); }
  catch (e) { die(`could not rename ${id}: ${e.message}`); }
  console.log(`OpenCode session ${id} renamed: ${title}`);
}

// ---------- history (for /retitle-undo) ----------

function historyRuns() {
  if (!exists(HISTORY_DIR)) return [];
  return fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json')).sort().map(f => readJSON(path.join(HISTORY_DIR, f), null)).filter(Boolean);
}

function history(args) {
  const sub = args._[1];
  if (sub === 'save') {
    const file = args._[2];
    if (!file) die('usage: history save <file.json>');
    const items = readJSON(file, null);
    if (!Array.isArray(items)) die('history file must be a JSON array of {source,id,before,after}.');
    const id = stamp();
    writeJSON(path.join(HISTORY_DIR, `${id}.json`), { id, created_at: new Date().toISOString(), undone: false, items });
    console.log(`Saved run ${id} (${items.length} changes).`);
  } else if (sub === 'list') {
    const runs = historyRuns();
    if (!runs.length) return console.log('No runs saved.');
    for (const r of runs) console.log(`${r.id}  ${r.items.length} changes${r.undone ? '  (undone)' : ''}`);
  } else if (sub === 'last' || sub === 'show') {
    const runs = historyRuns();
    const r = sub === 'show' ? runs.find(x => x.id === args._[2]) : runs.filter(x => !x.undone).pop();
    if (!r) die(sub === 'show' ? 'run not found.' : 'no run to undo.');
    if (args.json) console.log(JSON.stringify(r, null, 2));
    else for (const i of r.items) console.log(`[${i.source}] ${i.after}  ->  ${i.before}`);
  } else if (sub === 'mark-undone') {
    const f = path.join(HISTORY_DIR, `${args._[2]}.json`);
    const r = readJSON(f, null);
    if (!r) die('run not found.');
    r.undone = true; r.undone_at = new Date().toISOString();
    writeJSON(f, r);
    console.log(`Run ${r.id} marked as undone.`);
  } else die('usage: history save|list|last|show|mark-undone');
}

// ---------- main ----------

const HELP = `${NAME} ${VERSION}

Usage: ${NAME} <command> [options]

Setup
  install [--yes] [--agents a,b]   Install for the chosen agents (checklist if no flags)
  uninstall [--purge]              Remove everything it added (history kept unless --purge)
  update                           Install the latest version for the same agents
  status                           Show version and agents
  check-update [--force]           Print a notice if a newer version exists

Helpers used by the skill
  codex-list [--json]              List Codex sessions with title, folder and preview
  codex-rename <id>|--current "<title>"
  opencode-list [--json]           List OpenCode sessions (needs the opencode CLI)
  opencode-rename <id> "<title>"
  history save <file> | list | last [--json] | show <id> [--json] | mark-undone <id>

Agents: ${Object.keys(AGENTS).join(', ')}
Env: LST_NO_UPDATE_CHECK=1 turns off the weekly update check.`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (args.version || cmd === 'version') return console.log(VERSION);
  switch (cmd) {
    case undefined: if (args.help) return console.log(HELP); return install(args);
    case 'install': return install(args);
    case 'uninstall': return uninstall(args);
    case 'update': return update();
    case 'status': return status();
    case 'check-update': return checkUpdate(args);
    case 'codex-list': return codexList(args);
    case 'codex-rename': return codexRename(args);
    case 'opencode-list': return opencodeList(args);
    case 'opencode-rename': return opencodeRename(args);
    case 'history': return history(args);
    case 'help': case '-h': return console.log(HELP);
    default: die(`unknown command "${cmd}". Run "${NAME} help".`);
  }
}

if (require.main === module) main().catch(e => die(e.message));
module.exports = { checkUpdate, VERSION };
