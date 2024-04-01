import { ensure } from '../Util';
import { AudioCache, BUFFER_QUEUE_LOOKAHEAD } from './AudioController';

const BUFFER_INTERVAL = 100;

ensure(BUFFER_INTERVAL + 50 < BUFFER_QUEUE_LOOKAHEAD, 'BUFFER_INTERVAL must be less than BUFFER_QUEUE_LOOKAHEAD.');

export default class AudioProxy {
	private controller: AudioCache;

	private isMuted = false;
	private globalVolume = 1;
	private isPaused = true;

	private playbackTime = 0;
	private abort: AbortController | null = null;

	constructor (cache: AudioCache) {
		this.controller = cache;
	}

	get currentTime(): number {
		return this.playbackTime;
	}

	set currentTime(time) {
		this.playbackTime = time;
		if (!this.isPaused) this.play();
	}

	get muted(): boolean {
		return this.isMuted;
	}

	set muted(muted: boolean) {
		this.isMuted = muted;
		this.controller.setVolume(this.isMuted ? 0 : this.globalVolume);
	}

	get volume(): number {
		return this.globalVolume;
	}

	set volume(volume: number) {
		this.globalVolume = volume;
		this.controller.setVolume(this.isMuted ? 0 : this.globalVolume);
	}

	get duration(): number {
		return this.controller.getDuration();
	}

	get paused(): boolean {
		return this.isPaused;
	}

	set src(_: string) { /* No-op */ }

	pause() {
		this.abort?.abort();
		this.abort = null;
		if (this.isPaused) return;
		this.isPaused = true;
		this.controller.stop();
	}

	async play() {
		this.pause();
		this.isPaused = false;

		await this.controller.play(this.playbackTime);

		// If pausing happened before cache finished starting.
		if (this.paused) return;

		let lastTime = 0;
		let sinceLastBuffer = 0;
		const abort = new AbortController();
		this.abort = abort;

		const update = (time: number) => {
			if (abort.signal.aborted) return;
			if (lastTime === 0) lastTime = time;

			let delta = time - lastTime;
			this.playbackTime += delta / 1000;
			lastTime = time;
			sinceLastBuffer += delta;

			if (sinceLastBuffer > BUFFER_INTERVAL) {
				this.controller.bufferClips(this.playbackTime);
				sinceLastBuffer = 0;
			}

			requestAnimationFrame(update);
		}

		requestAnimationFrame(update);
	}
}
