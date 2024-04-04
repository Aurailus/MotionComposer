import { signal, Signal } from '@preact/signals';
import { AudioData } from '@motion-canvas/core';

import { Clip, ClipSource, Track } from '../Types';

export const BUFFER_QUEUE_LOOKAHEAD = 200;

export default class AudioController {
	private context: AudioContext;

	private volume: number = 1;

	private clips: Clip[] = [];
	// private tracks: Track[] = [];
	private audibleTracks: boolean[];

	private data = new Map<string, Signal<AudioData | null>>;
	private buffers = new Map<string, AudioBuffer>;
	private buffering = new Set<string>();

	private activeClips = new Map<number, [ Clip, AudioBufferSourceNode, GainNode ]>();

	private latencyBehaviour: 'desync' | 'prep_audio' | 'delay_video' = 'prep_audio';

	constructor() {
		this.context = new AudioContext({ latencyHint: 'interactive' });
	}

	async cacheSource(audio: string) {
		if (this.buffers.has(audio) || this.buffering.has(audio)) return;
		this.buffering.add(audio);
		const buffer = await this.context.decodeAudioData(await (await fetch(`/media/${audio}`)).arrayBuffer());
		this.buffers.set(audio, buffer);
		this.generateWaveform(audio);
		this.buffering.delete(audio);
	}

	async setClips(allClips: Clip[]) {
		this.clips = allClips.filter(clip => (clip.type === 'audio' || clip.type === 'video') && clip.cache.source);

		for (const clip of this.clips) {
			await this.cacheSource(clip.cache.source.name);
		}
	}

	async setTracks(tracks: Track[]) {
		const numSolos = tracks.filter(track => track.solo).length;
		this.audibleTracks = [];
		for (let i = 0; i < tracks.length; i++) {
			if (numSolos === 0) this.audibleTracks.push(!tracks[i].muted);
			else if (numSolos === 1) this.audibleTracks.push(tracks[i].solo);
			else this.audibleTracks.push(tracks[i].solo && !tracks[i].muted);
		}
		this.setVolume(this.volume, true);
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
			const trackVolume = this.audibleTracks[clip.cache.channel] ? 1 : 0;

			const source = new AudioBufferSourceNode(this.context, { buffer: this.buffers.get(clip.cache.source.name) });
			const gain = new GainNode(this.context, { gain: Math.pow(clip.volume * this.volume * trackVolume, 1) });

			source.connect(gain).connect(this.context.destination);

			const when = ((clip.offset > time) ? clip.offset - time : 0) + this.context.currentTime;
			const offset = ((clip.offset > time) ? 0 : time - clip.offset) + clip.start;
			const duration = clip.length - offset + clip.start;

			source.start(when, offset, duration);
			this.activeClips.set(clip.uuid, [ clip, source, gain ]);
		}
	}

	setVolume(volume: number, force?: boolean) {
		if (this.volume === volume && !force) return;
		this.volume = volume;
		this.activeClips.forEach(([ clip, , gain ]) => {
			const trackVolume = this.audibleTracks[clip.cache.channel] ? 1 : 0;
			gain.gain.value = Math.pow(clip.volume * this.volume * trackVolume, 1)
		});
	}

	getWaveform(source: ClipSource) {
		let data = this.data.get(source.name);
		if (!data) this.data.set(source.name, data = signal(null));
		return data;
	}

	private generateWaveform(audio: string) {
		const buffer = this.buffers.get(audio);
		if (!buffer) return;

		const sampleSize = 256;
    const samples = ~~(buffer.length / sampleSize);
    const peaks = [];

    let absoluteMax = 0;

    for (let channelId = 0; channelId < buffer.numberOfChannels; channelId++) {
      const channel = buffer.getChannelData(channelId);
      for (let i = 0; i < samples; i++) {
        const start = ~~(i * sampleSize);
        const end = ~~(start + sampleSize);

        let min = channel[start];
        let max = min;

        for (let j = start; j < end; j++) {
          const value = channel[j];
          if (value > max) {
            max = value;
          }
          if (value < min) {
            min = value;
          }
        }

        if (channelId === 0 || max > peaks[i * 2]) peaks[i * 2] = max;
        if (channelId === 0 || min < peaks[i * 2 + 1]) peaks[i * 2 + 1] = min;

        if (max > absoluteMax) absoluteMax = max;
        if (Math.abs(min) > absoluteMax) absoluteMax = Math.abs(min);
      }
    }

		let data = this.data.get(audio);
		if (!data) this.data.set(audio, data = signal(null));
		data.value = {
			peaks,
			absoluteMax,
			length: samples,
			sampleRate: buffer.sampleRate / sampleSize,
		};
		return data;
	}
}
