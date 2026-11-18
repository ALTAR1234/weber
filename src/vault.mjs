// Saved passwords. Every password is encrypted with Windows' own protection for the
// signed-in user (DPAPI, through Electron's safeStorage) before it touches the disk;
// nothing is ever written in plain text, and if Windows can't encrypt, nothing is saved.
// Showing or copying a password first asks Windows Hello (face, fingerprint or PIN).
import { safeStorage } from 'electron';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';

export class Vault {
  constructor(file) {
    this.file = file;
    this.items = []; // { id, origin, username, secret (base64 ciphertext), created, used }
    this.never = []; // origins the user said never to save for
  }
  get available() {
    return safeStorage.isEncryptionAvailable();
  }
  async load() {
    try {
      const j = JSON.parse(await fsp.readFile(this.file, 'utf8'));
      this.items = Array.isArray(j.items) ? j.items : [];
      this.never = Array.isArray(j.never) ? j.never : [];
    } catch {}
  }
  async persist() {
    await fsp.writeFile(this.file, JSON.stringify({ items: this.items, never: this.never }));
  }
  /** What the manager lists: no secrets. */
  list(origin) {
    return this.items.filter((i) => !origin || i.origin === origin).map(({ id, origin: o, username, created, used }) => ({ id, origin: o, username, created, used }));
  }
  /** 'new' | 'update' | 'same' | 'never' for a login someone just submitted. */
  status(origin, username, password) {
    if (this.never.includes(origin)) return 'never';
    const hit = this.items.find((i) => i.origin === origin && i.username === username);
    if (!hit) return 'new';
    return this.reveal(hit.id) === password ? 'same' : 'update';
  }
  async save(origin, username, password) {
    if (!this.available) throw new Error('Windows encryption is not available, so the password was not saved.');
    const secret = safeStorage.encryptString(password).toString('base64');
    const hit = this.items.find((i) => i.origin === origin && i.username === username);
    if (hit) Object.assign(hit, { secret, used: Date.now() });
    else this.items.push({ id: crypto.randomUUID(), origin, username, secret, created: Date.now(), used: Date.now() });
    await this.persist();
  }
  reveal(id) {
    const hit = this.items.find((i) => i.id === id);
    if (!hit) return null;
    try {
      return safeStorage.decryptString(Buffer.from(hit.secret, 'base64'));
    } catch {
      return null;
    }
  }
  touch(id) {
    const hit = this.items.find((i) => i.id === id);
    if (hit) {
      hit.used = Date.now();
      this.persist().catch(() => {});
    }
  }
  async remove(id) {
    this.items = this.items.filter((i) => i.id !== id);
    await this.persist();
  }
  async neverFor(origin) {
    if (!this.never.includes(origin)) this.never.push(origin);
    await this.persist();
  }
  async forgetNever(origin) {
    this.never = this.never.filter((o) => o !== origin);
    await this.persist();
  }
}

/** A strong password for sign-up forms: 18 characters from four groups, no look-alikes. */
export function generatePassword() {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '-_.!?@#'];
  const all = sets.join('');
  const pick = (s) => s[crypto.randomInt(s.length)];
  const chars = sets.map(pick);
  while (chars.length < 18) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// ---------- Windows Hello ----------

const HELLO = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); [void]$t.Wait(-1); $t.Result }
$null = [Windows.Security.Credentials.UI.UserConsentVerifier, Windows.Security.Credentials.UI, ContentType = WindowsRuntime]
$a = Await ([Windows.Security.Credentials.UI.UserConsentVerifier]::CheckAvailabilityAsync()) ([Windows.Security.Credentials.UI.UserConsentVerifierAvailability])
if ("$a" -ne 'Available') { "unavailable:$a"; exit }
if ($env:WEBER_HELLO_CHECK -eq '1') { 'available'; exit }
$r = Await ([Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync($env:WEBER_HELLO_MSG)) ([Windows.Security.Credentials.UI.UserConsentVerificationResult])
"$r"
`;
function runHello(env) {
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', HELLO], { env: { ...process.env, ...env }, windowsHide: true, timeout: 120000 }, (err, out) => resolve(err ? 'error' : String(out).trim()));
  });
}
/** Is Windows Hello set up? (shows nothing on screen) */
export const helloAvailable = async () => (await runHello({ WEBER_HELLO_CHECK: '1' })) === 'available';

let verifiedUntil = 0;
/** 'verified' | 'unavailable' | 'denied': ask Windows Hello before showing a password (remembered for a minute, like Chrome). */
export async function verifyUser(message) {
  if (Date.now() < verifiedUntil) return 'verified';
  const r = await runHello({ WEBER_HELLO_MSG: message });
  if (r === 'Verified') {
    verifiedUntil = Date.now() + 60_000;
    return 'verified';
  }
  if (r.startsWith('unavailable') || r === 'error') return 'unavailable';
  return 'denied';
}
