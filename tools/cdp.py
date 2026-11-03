"""Minimal Chrome DevTools driver for headless screenshots and checks (dev tooling, not part of the game)."""
import asyncio, json, os, shutil, subprocess, tempfile, time, base64, urllib.request
import websockets

# $CHROME overrides; otherwise the first browser on PATH (cloud images usually only have chromium)
CHROME = os.environ.get('CHROME') or next((p for p in map(shutil.which, ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) if p), None)
PROFILE = os.path.join(tempfile.gettempdir(), f'claude-{os.getuid()}', 'cdpprof')
# Cloud sandboxes may block cdn.jsdelivr.net; requests to it are answered from npm packages cached here instead
NPM_CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.npmcache')
CDN = 'https://cdn.jsdelivr.net/npm/'

def cdn_file(url):
    """Local copy of a cdn.jsdelivr.net/npm/<pkg>@<ver>/<path> file, fetched with `npm pack` on first use (None if unavailable)."""
    spec, _, rel = url[len(CDN):].split('?')[0].partition('/')
    pkg = os.path.join(NPM_CACHE, spec)
    if not os.path.isdir(pkg) and shutil.which('npm'):
        os.makedirs(NPM_CACHE, exist_ok=True)
        r = subprocess.run(['npm', 'pack', spec, '--silent'], cwd=NPM_CACHE, capture_output=True, text=True)
        tgz = os.path.join(NPM_CACHE, r.stdout.strip().splitlines()[-1]) if r.returncode == 0 and r.stdout.strip() else None
        if tgz and os.path.exists(tgz):
            os.makedirs(pkg); subprocess.run(['tar', 'xzf', tgz, '-C', pkg, '--strip-components=1']); os.remove(tgz)
    f = os.path.join(pkg, rel)
    return f if os.path.isfile(f) else None

class CDP:
    def __init__(self, port=9333): self.port = port; self.id = 0; self.logs = []
    async def start(self, url, w=1280, h=720):
        if not CHROME: raise SystemExit('no Chrome/Chromium found: install one or set $CHROME')
        os.makedirs(PROFILE, exist_ok=True)
        self.proc = subprocess.Popen([CHROME, '--headless=new', f'--remote-debugging-port={self.port}', '--use-angle=swiftshader',
                                      '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check', f'--window-size={w},{h}',
                                      *(['--no-sandbox'] if os.getuid() == 0 else []),  # containers run as root; Chrome refuses its sandbox there
                                      f'--user-data-dir={PROFILE}', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        pages = []
        for _ in range(100):  # the endpoint can answer before the first tab exists, so wait for a page
            try: pages = [t for t in json.load(urllib.request.urlopen(f'http://127.0.0.1:{self.port}/json')) if t['type'] == 'page']
            except Exception: pass
            if pages: break
            time.sleep(0.2)
        if not pages: raise SystemExit(f'Chrome DevTools on port {self.port} showed no page tab')
        t = pages[0]
        self.ws = await websockets.connect(t['webSocketDebuggerUrl'], max_size=2**28)
        self.pending = {}; asyncio.create_task(self._reader())
        await self.send('Runtime.enable'); await self.send('Page.enable')
        await self.send('Network.enable'); await self.send('Network.setCacheDisabled', cacheDisabled=True)
        await self.send('Fetch.enable', patterns=[{'urlPattern': CDN + '*'}])
        await self.send('Page.navigate', url=url)
    async def _reader(self):
        async for m in self.ws:
            d = json.loads(m)
            if 'id' in d and d['id'] in self.pending: self.pending.pop(d['id']).set_result(d)
            elif d.get('method') == 'Runtime.consoleAPICalled': self.logs.append(' '.join(str(a.get('value', a.get('description', ''))) for a in d['params']['args']))
            elif d.get('method') == 'Runtime.exceptionThrown': self.logs.append('EXC ' + json.dumps(d['params']['exceptionDetails'])[:1500])
            elif d.get('method') == 'Fetch.requestPaused': asyncio.create_task(self._serve_cdn(d['params']))
    async def _serve_cdn(self, p):
        f = await asyncio.to_thread(cdn_file, p['request']['url'])
        if not f: return await self.send('Fetch.continueRequest', requestId=p['requestId'])  # let the real CDN try
        ctype = 'text/javascript' if f.endswith(('.js', '.mjs')) else 'application/octet-stream'
        await self.send('Fetch.fulfillRequest', requestId=p['requestId'], responseCode=200, body=base64.b64encode(open(f, 'rb').read()).decode(),
                        responseHeaders=[{'name': 'Content-Type', 'value': ctype}, {'name': 'Access-Control-Allow-Origin', 'value': '*'}])
    async def send(self, method, **params):
        self.id += 1; f = asyncio.get_event_loop().create_future(); self.pending[self.id] = f
        await self.ws.send(json.dumps({'id': self.id, 'method': method, 'params': params})); return await f
    async def ev(self, expr):
        r = await self.send('Runtime.evaluate', expression=expr, awaitPromise=True, returnByValue=True)
        if 'exceptionDetails' in r.get('result', {}): return 'ERR ' + json.dumps(r['result']['exceptionDetails'])[:1500]
        return r['result']['result'].get('value')
    async def shot(self, path):
        r = await self.send('Page.captureScreenshot', format='png'); open(path, 'wb').write(base64.b64decode(r['result']['data']))
    async def key(self, code, down=True):
        await self.ev(f"dispatchEvent(new KeyboardEvent('{'keydown' if down else 'keyup'}',{{code:'{code}'}}))")
    async def boot(self, url='http://127.0.0.1:8765/index.html', w=1568, h=800, timeout=120):
        await self.start(url, w, h)
        for _ in range(timeout):
            await asyncio.sleep(1)
            if await self.ev("!!(window.__game && __game.G.city)"): return True
        return False
    async def new_game(self):
        await self.ev("localStorage.removeItem('onecity_daggerfall_settings'); Object.assign(__game.settings,{dbgFly:false,dbgStamina:false})")
        await self.ev("__game.beginNewGame({name:'T',race:'Breton',cls:'Warrior',attr:{STR:50,INT:50,WIL:50,AGI:50,END:50,PER:50,SPD:50,LUC:50}})")
        await self.ev("__game.UI.close(true); __game.Input.fallback=true")
    def errors(self): return [l for l in self.logs if 'favicon' not in l]
    def stop(self): self.proc.kill()
