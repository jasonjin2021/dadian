export const LOBBY_MUSIC_FILE = '/audio/lobby/laomushi-gondboy.mp3';
export const LOBBY_MUSIC_VOLUME = .1;
export type MusicStatus = 'ready' | 'loading' | 'playing' | 'paused' | 'error';
type MusicEnvironment = {
  context: () => AudioContext;
  load: (context: AudioContext, signal: AbortSignal) => Promise<AudioBuffer>;
  status: (status: MusicStatus) => void;
};

/** One loop, cancellable even while the file is decoding or autoplay is blocked. */
export class LobbyMusicPlayer {
  private context?: AudioContext;
  private buffer?: AudioBuffer;
  private loading?: Promise<AudioBuffer>;
  private source?: AudioBufferSourceNode;
  private gain?: GainNode;
  private request?: AbortController;
  private generation = 0;
  private pending = false;
  private disposed = false;
  private unlocked = false;
  private enabled = true;
  private visible = true;
  private offset = 0;
  private startedAt = 0;

  private env: MusicEnvironment;
  constructor(env: MusicEnvironment) { this.env = env; }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.pause();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    if (!visible) this.pause();
    else if (this.unlocked && this.enabled) void this.play();
  }

  async play() {
    if (this.disposed || !this.enabled || !this.visible || this.source || this.pending) return;
    const token = ++this.generation;
    this.pending = true;
    this.env.status('loading');
    try {
      const context = this.context ??= this.env.context();
      // Must be called synchronously inside the click/key event, before fetching.
      const resumed = context.resume().then(() => { if (!this.disposed) this.unlocked = true; });
      if (!this.buffer && !this.loading) {
        this.request = new AbortController();
        const loading = this.env.load(context, this.request.signal);
        this.loading = loading;
        // Clear a failed fetch even if this play request was cancelled meanwhile.
        void loading.catch(() => { if (this.loading === loading) this.loading = undefined; });
      }
      const [buffer] = await Promise.all([this.buffer ?? this.loading!, resumed]);
      this.buffer = buffer;
      if (this.disposed || token !== this.generation || !this.enabled || !this.visible) return;
      if (context.state !== 'running') { this.env.status('ready'); return; }
      this.unlocked = true;
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      gain.connect(context.destination);
      const now = context.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(LOBBY_MUSIC_VOLUME, now + .8);
      this.startedAt = now;
      source.start(0, this.offset % buffer.duration);
      this.source = source;
      this.gain = gain;
      this.env.status('playing');
    } catch (error) {
      if (token === this.generation && !this.disposed) {
        this.loading = undefined;
        this.env.status(error instanceof Error && error.name === 'NotAllowedError' ? 'ready' : 'error');
      }
    } finally {
      if (token === this.generation) this.pending = false;
    }
  }

  private pause() {
    this.generation++;
    this.pending = false;
    if (this.source && this.context && this.buffer) {
      this.offset = (this.offset + this.context.currentTime - this.startedAt) % this.buffer.duration;
      try { this.source.stop(); } catch { /* Already stopped. */ }
      this.source.disconnect();
    }
    this.source = undefined;
    this.gain?.disconnect();
    this.gain = undefined;
    if (this.context && this.context.state !== 'closed') void this.context.suspend().catch(() => {});
    if (!this.disposed) this.env.status('paused');
  }

  dispose() {
    this.disposed = true;
    this.pause();
    this.request?.abort();
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
  }
}
