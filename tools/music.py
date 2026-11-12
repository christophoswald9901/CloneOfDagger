"""Render a composed music piece offline in headless Chrome to WAV and MP3, with level stats per instrument.

python3 tools/music.py [mood] [index]      e.g. python3 tools/music.py wild 0, or wild:rain 0
Writes tools/out/music/<mood>_<index>.wav/.mp3 (needs the local server on :8765, or MUSIC_URL, and ffmpeg for the mp3).
Renders on tools/music.html, a bare page with only src/02_music.js, so it does not need a build. STEMS=0 skips the per-instrument renders."""
import asyncio, sys, os, base64, subprocess, json, functools
print = functools.partial(print, flush=True)
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
OUT = os.path.join(os.path.dirname(__file__), 'out', 'music')
JS_STATS = """(async()=>{const b=await __game.Music.render(%s,%d,%s);const L=b.getChannelData(0),R=b.getChannelData(1);
 let pk=0,ss=0;const win=[];let ws=0,wn=0;for(let i=0;i<L.length;i++){const v=(Math.abs(L[i])+Math.abs(R[i]))/2;pk=Math.max(pk,Math.abs(L[i]),Math.abs(R[i]));const q=(L[i]*L[i]+R[i]*R[i])/2;ss+=q;ws+=q;wn++;if(wn===b.sampleRate*10){win.push(+(10*Math.log10(ws/wn+1e-12)).toFixed(1));ws=0;wn=0;}}
 let act=0,an=0;for(let i=0;i+b.sampleRate<=L.length;i+=b.sampleRate){let e=0;for(let k=i;k<i+b.sampleRate;k+=4)e+=(L[k]*L[k]+R[k]*R[k])/2;e/=b.sampleRate/4;if(e>1e-5){act+=e;an++;}}
 window.__mbuf=b;return JSON.stringify({playingDb:+(10*Math.log10(act/Math.max(1,an)+1e-12)).toFixed(1),sec:+b.duration.toFixed(1),peakDb:+(20*Math.log10(pk)).toFixed(1),rmsDb:+(10*Math.log10(ss/L.length)).toFixed(1),per10s:win});})()"""
JS_WAV = """(()=>{const b=window.__mbuf,n=b.length,L=b.getChannelData(0),R=b.getChannelData(1);const buf=new ArrayBuffer(44+n*4),d=new DataView(buf);
 const w=(o,s)=>{for(let i=0;i<s.length;i++)d.setUint8(o+i,s.charCodeAt(i));};w(0,'RIFF');d.setUint32(4,36+n*4,true);w(8,'WAVE');w(12,'fmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,2,true);
 d.setUint32(24,b.sampleRate,true);d.setUint32(28,b.sampleRate*4,true);d.setUint16(32,4,true);d.setUint16(34,16,true);w(36,'data');d.setUint32(40,n*4,true);
 for(let i=0;i<n;i++){d.setInt16(44+i*4,Math.max(-1,Math.min(1,L[i]))*32767,true);d.setInt16(46+i*4,Math.max(-1,Math.min(1,R[i]))*32767,true);}
 const u=new Uint8Array(buf);let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));window.__mwav=btoa(s);return window.__mwav.length;})()"""
async def once():
    mood = sys.argv[1] if len(sys.argv) > 1 else 'wild'; idx = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    os.makedirs(OUT, exist_ok=True); c = CDP()
    try: await render(c, mood, idx)
    finally: c.stop()
async def render(c, mood, idx):
    if not await c.boot(url=os.environ.get('MUSIC_URL', 'http://127.0.0.1:8765/tools/music.html'), timeout=150): print('boot failed'); return
    print('warnings', await c.ev("(()=>{const w=[];const o=console.warn;console.warn=(...a)=>w.push(a.join(' '));try{__game.Music.score(%s,%d)}finally{console.warn=o}return JSON.stringify(w)})()" % (json.dumps(mood), idx)))
    insts = json.loads(await c.ev("JSON.stringify([...new Set(__game.Music.score(%s,%d).ev.map(e=>e.inst))])" % (json.dumps(mood), idx)))
    for inst in (insts if os.environ.get('STEMS', '1') != '0' else []):
        print(f'{inst:8s}', await c.ev(JS_STATS % (json.dumps(mood), idx, json.dumps(inst))))
    print('mix     ', await c.ev(JS_STATS % (json.dumps(mood), idx, 'null')))
    n = await c.ev(JS_WAV); parts = []
    for i in range(0, n, 4_000_000): parts.append(await c.ev(f"window.__mwav.slice({i},{i + 4_000_000})"))
    wav = os.path.join(OUT, f"{mood.replace(':', '-')}_{idx}.wav"); open(wav, 'wb').write(base64.b64decode(''.join(parts)))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-b:a', '192k', wav[:-4] + '.mp3'])
    print('wrote', wav, 'and .mp3')
    for l in c.errors()[:8]: print('LOG', l[:600])
async def main():
    # the headless tab is sometimes lost mid-render ("target navigated or closed"); start over then
    for attempt in range(3):
        try: return await once()
        except KeyError: print('lost the tab, retrying'); os.system('pkill -f "chrome.*[r]emote-debugging-port=' + os.environ.get('CDP_PORT', '9333') + '" >/dev/null 2>&1')
asyncio.run(main())
