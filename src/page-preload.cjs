// Runs in every web page's top frame, in Weber's own isolated world (pages can't see or
// reach it), with the page sandboxed. It does one job: the password manager. It notices
// when you sign in so Weber can offer to save the password, and offers saved logins
// (or a strong new password) when you click into a sign-in field. Passwords only ever
// travel between this script and Weber's main process; the browser UI never sees them.
const { ipcRenderer } = require('electron');

if (/^https?:$/.test(location.protocol)) {
  const isInput = (el) => el instanceof HTMLInputElement && !el.disabled && !el.readOnly;
  const isPw = (el) => isInput(el) && el.type === 'password';
  const USERISH = /user|email|e-mail|login|account|identifier|phone|mail/i;
  const isUser = (el) =>
    isInput(el) && ['text', 'email', 'tel', ''].includes(el.type) && (el.autocomplete === 'username' || el.autocomplete === 'email' || USERISH.test(`${el.name} ${el.id} ${el.autocomplete} ${el.getAttribute('aria-label') ?? ''} ${el.placeholder}`));
  const visible = (el) => el.offsetParent !== null || el.getClientRects().length > 0;

  let lastUser = '';
  const sent = new Set();
  document.addEventListener('input', (e) => isUser(e.target) && e.target.value && (lastUser = e.target.value.trim()), true);

  // ---------- noticing a sign-in ----------
  function usernameFor(pw) {
    const scope = pw.form ?? document;
    const fields = [...scope.querySelectorAll('input')].filter((i) => isUser(i) && i.value);
    const before = fields.filter((i) => i.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING);
    return (before.at(-1) ?? fields[0])?.value.trim() || lastUser || document.querySelector('input[autocomplete="username"]')?.value?.trim() || '';
  }
  function capture(scope) {
    const pws = [...(scope ?? document).querySelectorAll('input[type="password"]')].filter((p) => p.value);
    if (!pws.length) return;
    const pw = pws.find((p) => p.autocomplete === 'new-password') ?? pws.at(-1);
    const username = usernameFor(pw);
    const key = username + '\u0000' + pw.value;
    if (sent.has(key)) return;
    sent.add(key);
    ipcRenderer.send('pw:submitted', { username, password: pw.value });
  }
  document.addEventListener('submit', (e) => capture(e.target), true);
  document.addEventListener('keydown', (e) => e.key === 'Enter' && isPw(e.target) && capture(e.target.form ?? document), true);
  document.addEventListener(
    'click',
    (e) => {
      const b = e.target instanceof Element && e.target.closest('button, input[type="submit"], [role="button"]');
      if (b) setTimeout(() => capture(), 0);
    },
    true,
  );
  addEventListener('pagehide', () => capture());

  // ---------- offering saved logins ----------
  const setValue = (el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  let host = null, box = null, forField = null;
  const KEY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M16 7l3 3M14 9l2 2"/></svg>';
  const SPARK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6L4.5 11l5.6-1.9z"/></svg>';
  function close() {
    host?.remove();
    host = box = forField = null;
  }
  function open(field, rows) {
    close();
    forField = field;
    host = document.createElement('weber-autofill');
    const root = host.attachShadow({ mode: 'closed' });
    const r = field.getBoundingClientRect();
    root.innerHTML = `<style>
      :host { all: initial; }
      .b { position: fixed; z-index: 2147483647; left: ${Math.round(r.left)}px; top: ${Math.round(r.bottom + 6)}px; min-width: ${Math.max(260, Math.round(r.width))}px; max-width: 420px;
        padding: 6px; border-radius: 14px; background: rgb(24 25 31 / .97); color: #f3f4f7; font: 500 13px/1.35 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif;
        box-shadow: 0 0 0 1px rgb(255 255 255 / .09), 0 18px 48px rgb(0 0 0 / .45); animation: in .16s cubic-bezier(.2,.9,.3,1); }
      @keyframes in { from { opacity: 0; transform: translateY(-4px); } }
      .r { display: flex; align-items: center; gap: 11px; padding: 9px 11px; border-radius: 10px; cursor: default; }
      .r:hover, .r:focus { background: rgb(255 255 255 / .08); outline: none; }
      .i { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; background: rgb(159 182 255 / .16); color: #b8c8ff; flex: none; }
      b { display: block; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      small { display: block; color: rgb(255 255 255 / .5); font-size: 11.5px; }
      .f { margin: 4px 4px 0; padding: 7px 8px 3px; border-top: 1px solid rgb(255 255 255 / .08); color: rgb(255 255 255 / .42); font-size: 11px; }
    </style><div class="b" role="listbox"></div>`;
    box = root.querySelector('.b');
    for (const row of rows) {
      const el = document.createElement('div');
      el.className = 'r';
      el.tabIndex = 0;
      el.innerHTML = `<span class="i">${row.gen ? SPARK : KEY}</span><span><b></b><small></small></span>`;
      el.querySelector('b').textContent = row.title;
      el.querySelector('small').textContent = row.sub;
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        row.pick();
      });
      box.append(el);
    }
    const foot = document.createElement('div');
    foot.className = 'f';
    foot.textContent = 'Weber passwords · encrypted by Windows';
    box.append(foot);
    document.documentElement.append(host);
  }
  async function offer(field) {
    if (!visible(field)) return;
    const isNew = isPw(field) && field.autocomplete === 'new-password';
    const saved = await ipcRenderer.invoke('pw:list');
    if (document.activeElement !== field) return;
    const rows = [];
    if (!isNew)
      for (const s of saved ?? [])
        rows.push({
          title: s.username || '(no username)',
          sub: 'Saved password',
          pick: async () => {
            const c = await ipcRenderer.invoke('pw:fill', s.id);
            close();
            if (!c) return;
            const scope = field.form ?? document;
            const pw = isPw(field) ? field : [...scope.querySelectorAll('input[type="password"]')].find(visible);
            const user = isUser(field) ? field : pw && usernameFor(pw) === '' ? [...scope.querySelectorAll('input')].find((i) => isUser(i) && visible(i)) : null;
            if (user && c.username) setValue(user, c.username);
            if (pw) setValue(pw, c.password);
          },
        });
    if (isPw(field) && (isNew || !rows.length))
      rows.push({
        title: 'Use a strong password',
        sub: 'Weber makes one and saves it when you sign up',
        gen: true,
        pick: async () => {
          const p = await ipcRenderer.invoke('pw:generate');
          close();
          const scope = field.form ?? document;
          for (const f of scope.querySelectorAll('input[type="password"]')) if (f === field || f.autocomplete === 'new-password') setValue(f, p);
        },
      });
    if (rows.length && (rows.some((r) => !r.gen) || isNew)) open(field, rows);
  }
  document.addEventListener('focusin', (e) => (isPw(e.target) || isUser(e.target)) && offer(e.target), true);
  document.addEventListener('focusout', (e) => e.target === forField && setTimeout(() => document.activeElement !== forField && close(), 120), true);
  document.addEventListener('keydown', (e) => e.key === 'Escape' && close(), true);
  addEventListener('scroll', () => host && close(), true);
}
