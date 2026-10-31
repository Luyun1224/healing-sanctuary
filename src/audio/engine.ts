/**
 * 心靈充電所音效引擎（Web Audio API 即時合成，參考 OSCE Island 的合成音樂架構）
 *
 * - 所有聲音皆為程式即時合成的原創音效／器樂，不含任何錄音素材。
 * - 不以合成聲音冒充佛經誦讀或聖詩錄音；這類內容需取得授權音檔後另外加入（見 docs/ASSETS.md）。
 * - 匯流排：master ← nature / music / sfx（木魚另有 fish 子音量）
 * - 瀏覽器規定需使用者操作後才能播放，因此由「開啟聲音」按鈕呼叫 start()。
 */
import type { DayPhase } from '../lib/timeOfDay';
import type { Settings } from '../world/settings';

export type Track = 'zen' | 'piano' | 'organ';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private nature!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private fish!: GainNode;
  private reverb!: ConvolverNode;
  private reverbIn!: GainNode;
  private waterGain!: GainNode;
  private rainGain!: GainNode;
  private windGain!: GainNode;
  private noise!: AudioBuffer;
  private brown!: AudioBuffer;
  private timer: number | null = null;
  private phase: DayPhase = 'day';
  private nextBird = 0;
  private nextCricket = 0;
  private nextRustle = 0;
  private track: Track | null = null;
  private trackStep = 0;
  private trackNext = 0;
  private enabled = false;
  private settings: Settings | null = null;
  private water = 0;
  private rain = false;

  static supported() {
    return typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);
  }

  get running() {
    return !!this.ctx && this.enabled;
  }

  /** 由使用者點擊觸發 */
  async start() {
    if (!AudioEngine.supported()) return false;
    if (!this.ctx) this.build();
    try {
      await this.ctx!.resume();
    } catch {
      return false;
    }
    this.enabled = true;
    this.applyGains();
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), 200);
    return true;
  }

  stop() {
    this.enabled = false;
    this.applyGains();
  }

  private build() {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    const bus = () => {
      const g = ctx.createGain();
      g.connect(this.master);
      return g;
    };
    this.nature = bus();
    this.music = bus();
    this.sfx = bus();
    this.fish = ctx.createGain();
    this.fish.connect(this.sfx);

    // 合成殘響（指數衰減噪音）
    this.reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 3;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.reverb.buffer = ir;
    this.reverbIn = ctx.createGain();
    this.reverbIn.gain.value = 0.35;
    this.reverbIn.connect(this.reverb);
    this.reverb.connect(this.master);

    // 噪音素材
    const n = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, n, ctx.sampleRate);
    this.brown = ctx.createBuffer(1, n, ctx.sampleRate);
    const w = this.noise.getChannelData(0);
    const b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      w[i] = Math.random() * 2 - 1;
      last = (last + 0.02 * w[i]) / 1.02;
      b[i] = last * 3.5;
    }

    // 微風：棕噪音＋低通，音量緩慢起伏
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.25;
    this.loop(this.brown, [this.biquad('lowpass', 520, 0.5)], this.windGain, this.nature);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 0.16;
    lfo.connect(lfoAmt).connect(this.windGain.gain);
    lfo.start();

    // 流水：帶通噪音，中心頻率隨機飄動模擬水花
    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0;
    const bp = this.biquad('bandpass', 1100, 0.7);
    this.loop(this.noise, [bp, this.biquad('lowpass', 3200, 0.5)], this.waterGain, this.nature);
    const wl = ctx.createOscillator();
    wl.type = 'triangle';
    wl.frequency.value = 0.9;
    const wla = ctx.createGain();
    wla.gain.value = 260;
    wl.connect(wla).connect(bp.frequency);
    wl.start();

    // 細雨
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    this.loop(this.noise, [this.biquad('highpass', 2400, 0.4), this.biquad('lowpass', 9000, 0.5)], this.rainGain, this.nature);
  }

  private biquad(type: BiquadFilterType, f: number, q: number) {
    const b = this.ctx!.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  }

  private loop(buf: AudioBuffer, chain: AudioNode[], gain: GainNode, out: AudioNode) {
    const src = this.ctx!.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    let node: AudioNode = src;
    for (const c of chain) node = node.connect(c);
    node.connect(gain).connect(out);
    src.start();
  }

  applySettings(s: Settings) {
    this.settings = s;
    this.rain = s.rain;
    this.applyGains();
  }

  private applyGains() {
    if (!this.ctx || !this.settings) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    const set = (g: AudioParam, v: number) => g.setTargetAtTime(v, t, 0.25);
    set(this.master.gain, this.enabled ? s.master : 0);
    set(this.nature.gain, s.nature);
    set(this.music.gain, s.natureOnly ? 0 : s.music * 0.8);
    set(this.sfx.gain, s.natureOnly ? 0 : s.sfx);
    set(this.fish.gain, s.fish);
    set(this.reverbIn.gain, s.natureOnly ? 0 : 0.35);
    set(this.rainGain.gain, this.rain ? 0.22 : 0);
    set(this.waterGain.gain, 0.04 + this.water * 0.32);
  }

  setPhase(p: DayPhase) {
    this.phase = p;
  }

  /** 0..1：離小溪／瀑布越近越大聲 */
  setWater(v: number) {
    if (Math.abs(v - this.water) < 0.02) return;
    this.water = v;
    if (this.ctx) this.waterGain.gain.setTargetAtTime(0.04 + v * 0.32, this.ctx.currentTime, 0.5);
  }

  setTrack(t: Track | null) {
    if (t === this.track) return;
    this.track = t;
    this.trackStep = 0;
    if (this.ctx) this.trackNext = this.ctx.currentTime + 0.3;
  }

  /* ------------------------- 排程 ------------------------- */

  private tick() {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime;
    const ahead = t + 0.5;

    // 鳥鳴：清晨最多、白天次之、黃昏少、夜晚無
    if (this.phase !== 'night' && !this.rain && t >= this.nextBird) {
      this.bird(t + 0.05);
      const gap = this.phase === 'dawn' ? rand(1.2, 3.5) : this.phase === 'day' ? rand(2.5, 6) : rand(6, 12);
      this.nextBird = t + gap;
    }
    // 蟲鳴：黃昏與夜晚
    if ((this.phase === 'night' || this.phase === 'dusk') && t >= this.nextCricket) {
      this.cricket(t + 0.05);
      this.nextCricket = t + rand(0.8, this.phase === 'night' ? 1.8 : 4);
    }
    // 樹葉沙沙聲
    if (t >= this.nextRustle) {
      this.rustle(t + 0.05);
      this.nextRustle = t + rand(5, 11);
    }
    // 背景音樂
    while (this.track && this.trackNext < ahead) {
      const dur = this.scheduleTrack(this.track, this.trackNext, this.trackStep++);
      this.trackNext += dur;
    }
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private tone(freq: number, t: number, opts: { type?: OscillatorType; peak: number; attack: number; decay: number; out: AudioNode; detune?: number }) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.detune) o.detune.value = opts.detune;
    const g = ctx.createGain();
    this.env(g, t, opts.peak, opts.attack, opts.decay);
    o.connect(g).connect(opts.out);
    o.start(t);
    o.stop(t + opts.attack + opts.decay + 0.05);
    return { o, g };
  }

  private bird(t: number) {
    const ctx = this.ctx!;
    const base = rand(2400, 4200);
    const notes = Math.floor(rand(2, 6));
    const pan = ctx.createStereoPanner();
    pan.pan.value = rand(-0.8, 0.8);
    pan.connect(this.nature);
    for (let i = 0; i < notes; i++) {
      const s = t + i * rand(0.09, 0.16);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(base * rand(0.9, 1.1), s);
      o.frequency.exponentialRampToValueAtTime(base * rand(1.15, 1.45), s + 0.05);
      o.frequency.exponentialRampToValueAtTime(base * rand(0.8, 1), s + 0.09);
      this.env(g, s, 0.05, 0.01, 0.09);
      o.connect(g).connect(pan);
      o.start(s);
      o.stop(s + 0.12);
    }
  }

  private cricket(t: number) {
    const ctx = this.ctx!;
    const f = rand(4000, 4800);
    const pan = ctx.createStereoPanner();
    pan.pan.value = rand(-0.9, 0.9);
    pan.connect(this.nature);
    const pulses = Math.floor(rand(3, 7));
    for (let i = 0; i < pulses; i++) {
      const s = t + i * 0.05;
      this.tone(f, s, { peak: 0.018, attack: 0.005, decay: 0.035, out: pan });
    }
  }

  private rustle(t: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = this.biquad('highpass', 2600, 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + 1.6);
    src.connect(hp).connect(g).connect(this.nature);
    src.start(t, rand(0, 1));
    src.stop(t + 1.7);
  }

  /** 回傳此步驟長度（秒） */
  private scheduleTrack(track: Track, t: number, step: number): number {
    if (track === 'zen') {
      // D 大調五聲音階的和緩撥弦＋長音背景（原創）
      const scale = [62, 64, 66, 69, 71, 74, 76, 78, 81];
      if (step % 8 === 0) {
        const roots = [50, 45, 47, 43];
        const r = roots[(step / 8) % roots.length];
        for (const n of [r, r + 7, r + 12]) this.tone(midi(n), t, { type: 'triangle', peak: 0.035, attack: 2.5, decay: 9, out: this.music });
      }
      if (Math.random() < 0.7) {
        const n = scale[Math.floor(Math.random() * scale.length)];
        const p = this.tone(midi(n), t, { type: 'triangle', peak: 0.07, attack: 0.008, decay: 2.6, out: this.music });
        p.g.connect(this.reverbIn);
      }
      return 1.4;
    }
    if (track === 'piano') {
      // C – Am – F – G 分解和弦，約 66 BPM（原創）
      const chords = [
        [48, 55, 60, 64, 67, 64, 60, 55],
        [45, 52, 57, 60, 64, 60, 57, 52],
        [41, 48, 53, 57, 60, 57, 53, 48],
        [43, 50, 55, 59, 62, 59, 55, 50],
      ];
      const melody = [76, 0, 74, 72, 0, 0, 72, 0, 74, 0, 76, 0, 77, 0, 76, 74, 72, 0, 69, 0, 71, 0, 72, 0, 74, 0, 72, 71, 67, 0, 0, 0];
      const c = chords[Math.floor(step / 8) % 4];
      this.piano(midi(c[step % 8]), t, 0.06);
      const m = melody[step % melody.length];
      if (m) this.piano(midi(m), t, 0.08);
      return 60 / 66 / 2;
    }
    // organ：緩慢的持續和弦
    const chords = [
      [48, 55, 64, 67],
      [45, 52, 60, 64],
      [41, 53, 57, 65],
      [43, 50, 59, 67],
    ];
    const c = chords[step % 4];
    for (const n of c) {
      for (const [h, a] of [
        [1, 0.03],
        [2, 0.015],
        [3, 0.008],
        [4, 0.005],
      ] as const) {
        const p = this.tone(midi(n) * h, t, { peak: a, attack: 1.2, decay: 5.4, out: this.music });
        p.g.connect(this.reverbIn);
      }
    }
    return 5.5;
  }

  private piano(f: number, t: number, peak: number) {
    for (const [h, a, d] of [
      [1, 1, 2.8],
      [2, 0.35, 1.6],
      [3, 0.15, 0.9],
      [4, 0.06, 0.5],
    ] as const) {
      const p = this.tone(f * h, t, { peak: peak * a, attack: 0.006, decay: d, out: this.music });
      p.g.connect(this.reverbIn);
    }
  }

  /* ------------------------- 互動音效 ------------------------- */

  /** 木魚：短促、溫潤的木質共鳴（合成音效） */
  playFish() {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(820, t);
    o.frequency.exponentialRampToValueAtTime(610, t + 0.04);
    this.env(g, t, 0.6, 0.002, 0.16);
    o.connect(g).connect(this.fish);
    o.start(t);
    o.stop(t + 0.2);
    this.tone(1530, t, { peak: 0.12, attack: 0.001, decay: 0.05, out: this.fish });
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = this.biquad('bandpass', 2200, 1.2);
    const ng = ctx.createGain();
    this.env(ng, t, 0.25, 0.001, 0.025);
    src.connect(bp).connect(ng).connect(this.fish);
    src.start(t, Math.random());
    src.stop(t + 0.05);
    const send = ctx.createGain();
    send.gain.value = 0.15;
    g.connect(send).connect(this.reverbIn);
  }

  private bell(f: number, partials: [number, number, number][], peak: number) {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime + 0.01;
    for (const [ratio, amp, decay] of partials) {
      const p = this.tone(f * ratio, t, { peak: peak * amp, attack: 0.004, decay, out: this.sfx });
      p.g.connect(this.reverbIn);
    }
  }

  /** 寺院鐘：低沉、不和諧泛音、長尾音 */
  playTempleBell() {
    this.bell(128, [
      [0.5, 0.5, 9],
      [1, 1, 8],
      [2.01, 0.45, 6],
      [2.42, 0.35, 5],
      [3.03, 0.2, 3.5],
      [4.12, 0.12, 2.5],
      [5.43, 0.06, 1.5],
    ], 0.22);
  }

  /** 教堂鐘：明亮的鐘聲 */
  playChurchBell() {
    this.bell(392, [
      [0.5, 0.6, 5],
      [1, 1, 4],
      [1.19, 0.4, 3],
      [1.5, 0.3, 2.6],
      [2, 0.35, 2.2],
      [2.51, 0.15, 1.6],
      [3.01, 0.1, 1.2],
    ], 0.14);
  }

  /** 點燈、點蠟燭的柔和鈴音 */
  playChime() {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime + 0.01;
    [88, 93, 95, 100].forEach((n, i) => {
      const p = this.tone(midi(n), t + i * 0.12, { peak: 0.05, attack: 0.004, decay: 1.6, out: this.sfx });
      p.g.connect(this.reverbIn);
    });
  }
}

export const audio = new AudioEngine();
export const audioSupported = AudioEngine.supported();
