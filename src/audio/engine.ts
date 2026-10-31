/**
 * 心靈充電所音效引擎（Web Audio API 即時合成，參考 OSCE Island 的合成音樂架構）
 *
 * - 預設所有聲音皆為程式即時合成的原創音效／器樂。
 * - 室內氛圍：佛堂為「合成誦唱氛圍音＋木魚＋引磬＋鐘聲」，教堂為「合成詩班和聲＋管風琴＋鐘聲」。
 *   合成人聲只有母音、沒有經文或歌詞，介面上標示為合成氛圍音，不冒充真實誦經或聖詩錄音。
 *   若在 public/audio/ 放入經授權的錄音（temple-chant.mp3、church-hymn.mp3），會自動改播錄音（見 docs/ASSETS.md）。
 * - 區域：戶外播放蟲鳴鳥叫；進入佛堂／教堂後戶外聲淡出、室內氛圍淡入；在門口附近可隱約聽見室內聲音。
 * - 匯流排：master ← nature(← outdoor 區域淡入淡出) / interior(← 區域淡入淡出) / music / sfx（木魚另有 fish 子音量）
 * - 瀏覽器規定需使用者操作後才能播放，因此由「開啟聲音」按鈕呼叫 start()。
 */
import type { DayPhase } from '../lib/timeOfDay';
import type { Settings } from '../world/settings';

export type Track = 'zen' | 'piano' | 'organ';
export type Zone = 'outdoor' | 'temple' | 'church';
export type InteriorSource = 'none' | 'recording' | 'synth';

const TEMPLE_BELL = [
  [0.5, 0.5, 9],
  [1, 1, 8],
  [2.01, 0.45, 6],
  [2.42, 0.35, 5],
  [3.03, 0.2, 3.5],
  [4.12, 0.12, 2.5],
  [5.43, 0.06, 1.5],
] as const;
const CHURCH_BELL = [
  [0.5, 0.6, 5],
  [1, 1, 4],
  [1.19, 0.4, 3],
  [1.5, 0.3, 2.6],
  [2, 0.35, 2.2],
  [2.51, 0.15, 1.6],
  [3.01, 0.1, 1.2],
] as const;
/** 引磬（小型缽鈴）：清亮、長尾音 */
const QING = [
  [1, 1, 5],
  [2.74, 0.45, 3.2],
  [5.2, 0.18, 1.6],
] as const;

/** 共振峰（男聲母音近似值，Hz）：只有母音，不含任何經文或歌詞 */
const VOWELS: Record<string, [number, number, number]> = {
  a: [730, 1090, 2440],
  o: [570, 840, 2410],
  u: [320, 870, 2240],
  e: [530, 1840, 2480],
  m: [260, 900, 2300],
};

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private nature!: GainNode;
  /** 戶外聲音的區域淡入淡出（進入室內時降為 0） */
  private outdoor!: GainNode;
  /** 室內氛圍：使用者音量 → 區域淡入淡出 */
  private interiorUser!: GainNode;
  private interiorZone!: GainNode;
  private interiorVerbIn!: GainNode;
  /** 合成人聲（共用的共振峰濾波鏈） */
  private voice: { oscs: OscillatorNode[]; f1: BiquadFilterNode; f2: BiquadFilterNode; f3: BiquadFilterNode; env: GainNode; scene: 'temple' | 'church' } | null = null;
  private zone: Zone = 'outdoor';
  private zoneScene: 'temple' | 'church' = 'temple';
  private near = 0;
  private interiorNext = 0;
  private interiorStep = 0;
  private nextBigBell = 0;
  private recordings: Partial<Record<'temple' | 'church', AudioBuffer | null>> = {};
  private recordingSrc: AudioBufferSourceNode | null = null;
  private recordingScene: 'temple' | 'church' | null = null;
  private crickets = [0, 0, 0, 0];
  onInteriorSource: ((scene: 'temple' | 'church', src: InteriorSource) => void) | null = null;
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
    // 柔和限幅：避免多個聲音同時出現時音量突然變大
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 8;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.005;
    limiter.release.value = 0.3;
    this.master.connect(limiter).connect(ctx.destination);
    const bus = () => {
      const g = ctx.createGain();
      g.connect(this.master);
      return g;
    };
    this.nature = bus();
    this.outdoor = ctx.createGain();
    this.outdoor.connect(this.nature);
    this.interiorUser = bus();
    this.interiorZone = ctx.createGain();
    this.interiorZone.gain.value = 0;
    this.interiorZone.connect(this.interiorUser);
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
    // 室內殘響（大殿空間感），輸出受區域淡入淡出控制
    const hall = ctx.createConvolver();
    hall.buffer = ir;
    this.interiorVerbIn = ctx.createGain();
    this.interiorVerbIn.gain.value = 0.55;
    this.interiorVerbIn.connect(hall);
    hall.connect(this.interiorZone);

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
    this.windGain.gain.value = 0.13;
    this.loop(this.brown, [this.biquad('lowpass', 380, 0.5)], this.windGain, this.outdoor);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 0.08;
    lfo.connect(lfoAmt).connect(this.windGain.gain);
    lfo.start();

    // 流水：帶通噪音，中心頻率隨機飄動模擬水花
    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0;
    const bp = this.biquad('bandpass', 1100, 0.7);
    this.loop(this.noise, [bp, this.biquad('lowpass', 2600, 0.5)], this.waterGain, this.outdoor);
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
    this.loop(this.noise, [this.biquad('highpass', 2400, 0.4), this.biquad('lowpass', 9000, 0.5)], this.rainGain, this.outdoor);
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
    set(this.waterGain.gain, 0.03 + this.water * 0.22);
    set(this.interiorUser.gain, s.natureOnly || !s.interior ? 0 : s.chant);
    this.applyZone();
  }

  /**
   * 區域：zone 為玩家目前所在（戶外或某棟建築內），near 為在戶外時與建築的接近程度（0..1），
   * 用來讓門口附近隱約聽見室內的聲音。
   */
  setZone(zone: Zone, scene: 'temple' | 'church', near: number) {
    const changed = zone !== this.zone || scene !== this.zoneScene || Math.abs(near - this.near) > 0.05;
    this.zone = zone;
    this.zoneScene = scene;
    this.near = near;
    if (changed) this.applyZone();
  }

  private applyZone() {
    if (!this.ctx || !this.settings) return;
    const t = this.ctx.currentTime;
    const inside = this.zone !== 'outdoor';
    const keepNature = this.settings.natureOnly || !this.settings.interior;
    this.outdoor.gain.setTargetAtTime(inside && !keepNature ? 0 : 1, t, 0.7);
    this.interiorZone.gain.setTargetAtTime(inside ? 1 : this.near * 0.22, t, 0.7);
  }

  private get interiorWanted() {
    return !!this.settings && this.settings.interior && !this.settings.natureOnly && (this.zone !== 'outdoor' || this.near > 0.02);
  }

  setPhase(p: DayPhase) {
    this.phase = p;
  }

  /** 0..1：離小溪／瀑布越近越大聲 */
  setWater(v: number) {
    if (Math.abs(v - this.water) < 0.02) return;
    this.water = v;
    if (this.ctx) this.waterGain.gain.setTargetAtTime(0.03 + v * 0.22, this.ctx.currentTime, 0.5);
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
      const gap = this.phase === 'dawn' ? rand(1.2, 3) : this.phase === 'day' ? rand(2, 5) : rand(5, 10);
      this.nextBird = t + gap;
    }
    // 蟲鳴：數隻各自鳴叫形成柔和的合唱；白天稀疏輕柔，黃昏夜晚較多
    const insectRate = this.phase === 'night' ? 1 : this.phase === 'dusk' ? 0.7 : this.phase === 'dawn' ? 0.25 : 0.3;
    for (let i = 0; i < this.crickets.length; i++) {
      if (t < this.crickets[i]) continue;
      if (Math.random() < insectRate) this.cricket(t + 0.05, i);
      this.crickets[i] = t + rand(0.9, 2.2) / Math.max(0.35, insectRate);
    }
    // 樹葉沙沙聲
    if (t >= this.nextRustle) {
      this.rustle(t + 0.05);
      this.nextRustle = t + rand(6, 14);
    }
    // 室內氛圍（只在室內或門口附近時排程，節省效能）
    this.updateInterior(t, ahead);
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

  /** 溫和的鳥鳴：三種叫聲（雙音口哨、婉轉短鳴、低沉斑鳩聲），皆經低通濾波並隨機左右聲道 */
  private bird(t: number) {
    const ctx = this.ctx!;
    const pan = ctx.createStereoPanner();
    pan.pan.value = rand(-0.85, 0.85);
    const lp = this.biquad('lowpass', 4200, 0.5);
    lp.connect(pan).connect(this.outdoor);
    const kind = Math.random();
    const note = (f0: number, f1: number, s: number, d: number, peak: number, type: OscillatorType = 'sine') => {
      const o = ctx.createOscillator();
      o.type = type;
      const g = ctx.createGain();
      o.frequency.setValueAtTime(f0, s);
      o.frequency.exponentialRampToValueAtTime(f1, s + d * 0.8);
      // 輕微顫音讓聲音更自然
      const vib = ctx.createOscillator();
      vib.frequency.value = rand(5, 8);
      const va = ctx.createGain();
      va.gain.value = f0 * 0.012;
      vib.connect(va).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(peak, s + Math.min(0.04, d * 0.3));
      g.gain.setValueAtTime(peak, s + d * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, s + d);
      o.connect(g).connect(lp);
      o.start(s);
      vib.start(s);
      o.stop(s + d + 0.02);
      vib.stop(s + d + 0.02);
    };
    if (kind < 0.4) {
      // 雙音口哨「啾—嗚」
      const f = rand(2100, 2900);
      note(f, f * 1.12, t, 0.22, 0.018);
      note(f * 0.92, f * 0.8, t + 0.3, 0.26, 0.015);
    } else if (kind < 0.8) {
      // 婉轉短鳴
      const n = Math.floor(rand(4, 8));
      let f = rand(2500, 3300);
      for (let i = 0; i < n; i++) {
        const nf = f * rand(0.9, 1.12);
        note(f, nf, t + i * 0.085, 0.075, 0.011);
        f = nf;
      }
    } else {
      // 遠處的斑鳩「咕—咕咕」
      const f = rand(480, 560);
      note(f, f * 0.94, t, 0.32, 0.016, 'triangle');
      note(f * 1.05, f * 0.95, t + 0.45, 0.22, 0.013, 'triangle');
      note(f * 1.05, f * 0.92, t + 0.72, 0.3, 0.013, 'triangle');
    }
  }

  /** 蟋蟀：每隻有固定音高，一次 2～4 個柔和脈衝 */
  private cricket(t: number, voice: number) {
    const ctx = this.ctx!;
    const f = 3900 + voice * 220;
    const pan = ctx.createStereoPanner();
    pan.pan.value = [-0.7, -0.25, 0.3, 0.75][voice] ?? 0;
    const bp = this.biquad('bandpass', f, 6);
    bp.connect(pan).connect(this.outdoor);
    const peak = this.phase === 'night' ? 0.03 : this.phase === 'dusk' ? 0.022 : 0.012;
    const pulses = Math.floor(rand(2, 5));
    for (let i = 0; i < pulses; i++) {
      const s = t + i * 0.06;
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(peak, s + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.042);
      o.connect(g).connect(bp);
      o.start(s);
      o.stop(s + 0.05);
    }
  }

  private rustle(t: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = this.biquad('highpass', 2600, 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.03, t + 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + 1.6);
    src.connect(hp).connect(g).connect(this.outdoor);
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

  /* ------------------------- 室內氛圍 ------------------------- */

  private loadingRec = new Set<string>();

  private updateInterior(t: number, ahead: number) {
    if (!this.interiorWanted) {
      this.stopVoice();
      this.stopRecording();
      return;
    }
    const scene = this.zoneScene;
    if (!(scene in this.recordings)) void this.loadRecording(scene);
    const rec = this.recordings[scene] ?? null;
    if (rec) {
      this.stopVoice();
      if (this.recordingScene !== scene) this.startRecording(scene, rec);
    } else {
      this.stopRecording();
      if (!this.voice || this.voice.scene !== scene) {
        this.stopVoice();
        this.startVoice(scene);
        this.interiorNext = t + 0.4;
        this.interiorStep = 0;
      }
    }
    if (this.interiorNext < t) this.interiorNext = t + 0.1;
    while (this.interiorNext < ahead) {
      this.interiorNext += scene === 'temple' ? this.templeStep(this.interiorNext, this.interiorStep++, !!rec) : this.churchStep(this.interiorNext, this.interiorStep++, !!rec);
    }
    // 偶爾響起的大鐘
    if (this.nextBigBell === 0 || this.nextBigBell > t + 120) this.nextBigBell = t + 10;
    if (t >= this.nextBigBell) {
      if (scene === 'temple') this.bell(128, TEMPLE_BELL, 0.1, this.interiorZone, this.interiorVerbIn, t + 0.05);
      else for (let i = 0; i < 3; i++) this.bell(392, CHURCH_BELL, 0.05, this.interiorZone, this.interiorVerbIn, t + 0.05 + i * 2.6);
      this.nextBigBell = t + rand(45, 75);
    }
  }

  /** 若 public/audio/ 有授權錄音就改播錄音；沒有時使用合成氛圍音 */
  private async loadRecording(scene: 'temple' | 'church') {
    if (this.loadingRec.has(scene) || !this.ctx) return;
    this.loadingRec.add(scene);
    this.recordings[scene] = null;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}audio/${scene === 'temple' ? 'temple-chant' : 'church-hymn'}.mp3`);
      if (!res.ok || !(res.headers.get('content-type') || '').includes('audio')) throw new Error('no recording');
      this.recordings[scene] = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this.onInteriorSource?.(scene, 'recording');
    } catch {
      this.onInteriorSource?.(scene, 'synth');
    }
  }

  private startRecording(scene: 'temple' | 'church', buf: AudioBuffer) {
    this.stopRecording();
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0.8;
    src.connect(g).connect(this.interiorZone);
    src.start();
    this.recordingSrc = src;
    this.recordingScene = scene;
  }

  private stopRecording() {
    if (!this.recordingSrc) return;
    try {
      this.recordingSrc.stop();
    } catch {
      // ignore
    }
    this.recordingSrc = null;
    this.recordingScene = null;
  }

  /** 合成人聲：數個鋸齒波 → 三個共振峰帶通濾波 → 音量包絡 */
  private startVoice(scene: 'temple' | 'church') {
    const ctx = this.ctx!;
    const f1 = this.biquad('bandpass', 730, 7);
    const f2 = this.biquad('bandpass', 1090, 9);
    const f3 = this.biquad('bandpass', 2440, 12);
    const g2 = ctx.createGain();
    g2.gain.value = 0.55;
    const g3 = ctx.createGain();
    g3.gain.value = 0.2;
    const env = ctx.createGain();
    env.gain.value = 0;
    const soft = this.biquad('lowpass', 2800, 0.5);
    const mix = ctx.createGain();
    f1.connect(mix);
    f2.connect(g2).connect(mix);
    f3.connect(g3).connect(mix);
    mix.connect(env).connect(soft);
    soft.connect(this.interiorZone);
    soft.connect(this.interiorVerbIn);
    // 佛堂：三位男聲齊誦（略為走音形成群誦感）；教堂：四部和聲
    const detunes = scene === 'temple' ? [-9, 0, 7] : [-4, 3, -2, 5];
    const oscs = detunes.map((d) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(45);
      o.detune.value = d;
      const vib = ctx.createOscillator();
      vib.frequency.value = rand(4.5, 5.5);
      const va = ctx.createGain();
      va.gain.value = scene === 'temple' ? 4 : 8;
      vib.connect(va).connect(o.detune);
      vib.start();
      o.connect(f1);
      o.connect(f2);
      o.connect(f3);
      o.start();
      return o;
    });
    this.voice = { oscs, f1, f2, f3, env, scene };
  }

  private stopVoice() {
    const v = this.voice;
    if (!v || !this.ctx) return;
    const t = this.ctx.currentTime;
    v.env.gain.cancelScheduledValues(t);
    v.env.gain.setTargetAtTime(0, t, 0.2);
    v.oscs.forEach((o) => o.stop(t + 1.5));
    this.voice = null;
  }

  private setVowel(v: string, t: number) {
    if (!this.voice) return;
    const [a, b, c] = VOWELS[v] ?? VOWELS.a;
    this.voice.f1.frequency.setTargetAtTime(a, t, 0.04);
    this.voice.f2.frequency.setTargetAtTime(b, t, 0.04);
    this.voice.f3.frequency.setTargetAtTime(c, t, 0.04);
  }

  /**
   * 佛堂：一句 8 個音節（每音節 0.5 秒，最後一音節拉長並降一個全音），四句後停頓並敲引磬；
   * 每個音節伴隨輕柔的木魚。只有母音，沒有經文內容。
   */
  private templeStep(t: number, step: number, rec: boolean): number {
    const CYCLE = 36;
    const k = step % CYCLE;
    if (k === 0 || k === 32) this.bell(1180, QING, 0.05, this.interiorZone, this.interiorVerbIn, t);
    if (k >= 32) {
      if (k === 32 && this.voice && !rec) this.voice.env.gain.setTargetAtTime(0, t, 0.08);
      return 0.5;
    }
    const pos = k % 8;
    const last = pos === 7;
    const dur = last ? 1 : 0.5;
    if (!rec && this.voice) {
      const seq = ['a', 'm', 'o', 'u', 'a', 'e', 'o', 'm'];
      this.setVowel(seq[(k + Math.floor(step / CYCLE) * 3) % seq.length], t);
      const pitch = midi(last ? 43 : 45);
      this.voice.oscs.forEach((o) => o.frequency.setTargetAtTime(pitch, t, 0.05));
      const g = this.voice.env.gain;
      g.setTargetAtTime(0.32, t, 0.03);
      g.setTargetAtTime(0.18, t + dur * 0.55, 0.06);
      if (last) g.setTargetAtTime(0.0, t + dur * 0.8, 0.08);
      this.fishAt(t, this.interiorZone, 0.28);
    }
    return dur;
  }

  /** 教堂：四部和聲（原創和弦進行，母音「啊」「喔」交替）＋柔和管風琴；每四個和弦有一聲手鈴 */
  private churchStep(t: number, step: number, rec: boolean): number {
    const CHORDS = [
      [48, 55, 64, 72],
      [53, 57, 65, 72],
      [45, 57, 64, 72],
      [43, 55, 62, 71],
      [48, 55, 64, 72],
      [50, 57, 65, 69],
      [43, 55, 62, 67],
      [48, 55, 60, 64],
    ];
    const dur = 6;
    const c = CHORDS[step % CHORDS.length];
    if (!rec && this.voice) {
      this.setVowel(step % 2 ? 'o' : 'a', t);
      this.voice.oscs.forEach((o, i) => o.frequency.setTargetAtTime(midi(c[i]), t, 0.18));
      const g = this.voice.env.gain;
      g.setTargetAtTime(0.16, t, 0.5);
      g.setTargetAtTime(0.06, t + dur - 0.9, 0.25);
      for (const n of c.slice(0, 3)) {
        for (const [h, a] of [
          [1, 0.022],
          [2, 0.01],
          [4, 0.004],
        ] as const) {
          const p = this.tone(midi(n - 12) * h, t, { peak: a, attack: 1.4, decay: dur + 0.5, out: this.interiorZone });
          p.g.connect(this.interiorVerbIn);
        }
      }
    }
    if (step % 4 === 2) this.bell(784, CHURCH_BELL, 0.025, this.interiorZone, this.interiorVerbIn, t + 2);
    return dur;
  }

  /* ------------------------- 互動音效 ------------------------- */

  /** 木魚：短促、溫潤的木質共鳴（合成音效） */
  playFish() {
    if (!this.ctx || !this.enabled) return;
    this.fishAt(this.ctx.currentTime + 0.01, this.fish, 1);
  }

  private fishAt(t: number, out: AudioNode, level: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(820, t);
    o.frequency.exponentialRampToValueAtTime(610, t + 0.04);
    this.env(g, t, 0.6 * level, 0.002, 0.16);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.2);
    this.tone(1530, t, { peak: 0.12 * level, attack: 0.001, decay: 0.05, out });
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = this.biquad('bandpass', 2200, 1.2);
    const ng = ctx.createGain();
    this.env(ng, t, 0.25 * level, 0.001, 0.025);
    src.connect(bp).connect(ng).connect(out);
    src.start(t, Math.random());
    src.stop(t + 0.05);
    const send = ctx.createGain();
    send.gain.value = 0.15;
    g.connect(send).connect(out === this.fish ? this.reverbIn : this.interiorVerbIn);
  }

  private bell(f: number, partials: readonly (readonly [number, number, number])[], peak: number, out?: AudioNode, verb?: AudioNode, at?: number) {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const t = at ?? ctx.currentTime + 0.01;
    for (const [ratio, amp, decay] of partials) {
      const p = this.tone(f * ratio, t, { peak: peak * amp, attack: 0.004, decay, out: out ?? this.sfx });
      p.g.connect(verb ?? this.reverbIn);
    }
  }

  /** 寺院鐘：低沉、不和諧泛音、長尾音 */
  playTempleBell() {
    this.bell(128, TEMPLE_BELL, 0.22);
  }

  /** 教堂鐘：明亮的鐘聲 */
  playChurchBell() {
    this.bell(392, CHURCH_BELL, 0.14);
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
