import { Clip } from "../Types";

export const BUFFER_QUEUE_LOOKAHEAD = 200;

export class AudioCache {
	private context: AudioContext;

	private volume: number = 1;
	private clips: Clip[] = [];
	private buffers = new Map<string, AudioBuffer>;
	private activeClips = new Map<number, [ Clip, AudioBufferSourceNode, GainNode ]>();

	private latencyBehaviour: 'desync' | 'prep_audio' | 'delay_video' = 'prep_audio';

	constructor() {
		this.context = new AudioContext({ latencyHint: 'interactive' });
	}

	async cacheClip(audio: string) {
		if (this.buffers.has(audio)) return;
		const buffer = await this.context.decodeAudioData(await (await fetch(`/media/${audio}`)).arrayBuffer());
		this.buffers.set(audio, buffer);
	}

	async setAudioClips(allClips: Clip[]) {
		this.clips = allClips.filter(clip => clip.type === 'audio' || clip.type === 'video');

		for (const clip of this.clips) {
			await this.cacheClip(clip.cache.source.name);
		}
	}

	getDuration() {
		return this.clips.reduce((max, clip) => Math.max(max, clip.length + clip.offset), 0);
	}

	stop() {
		this.activeClips.forEach(([ , source ]) => source.stop());
		this.activeClips.clear();
	}

	async play(time: number) {
		this.stop();
		this.bufferClips(time);

		if (this.latencyBehaviour === 'delay_video') {
			await new Promise<void>((res) => setTimeout(res, this.context.outputLatency));
		}
	}

	bufferClips(time: number) {
		if (this.latencyBehaviour === 'prep_audio') time += this.context.outputLatency;

		for (const clip of this.clips) {
			if (clip.length + clip.offset < time || clip.offset - BUFFER_QUEUE_LOOKAHEAD / 1000 > time) continue;
			if (this.activeClips.has(clip.uuid)) continue;

			const source = new AudioBufferSourceNode(this.context, { buffer: this.buffers.get(clip.cache.source.name) });
			const gain = new GainNode(this.context, { gain: Math.pow(clip.volume * this.volume, 1) });

			source.connect(gain).connect(this.context.destination);

			const when = ((clip.offset > time) ? clip.offset - time : 0) + this.context.currentTime;
			const offset = ((clip.offset > time) ? 0 : time - clip.offset) + clip.start;
			const duration = clip.length - offset + clip.start;

			source.start(when, offset, duration);
			this.activeClips.set(clip.uuid, [ clip, source, gain ]);
		}
	}

	setVolume(volume: number) {
		if (this.volume === volume) return;
		console.log('setting volume to ', volume);
		this.volume = volume;
		this.activeClips.forEach(([ clip, , gain ]) => gain.gain.value = Math.pow(clip.volume * this.volume, 1));
	}
}
