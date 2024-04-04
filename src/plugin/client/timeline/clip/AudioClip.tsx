/* @jsxImportSource preact */

import { useLayoutEffect, useState, useContext, useRef } from 'preact/hooks';

import styles from './Clip.module.scss';

import * as Icon from '../../icon';
import { useAudio } from '../../Contexts';
import Clip, { ClipChildProps } from './Clip';
import { TimelineContext } from '../TimelineContext';
import { useApplication } from '@motion-canvas/ui';
import { Color } from '@motion-canvas/core';

const CANVAS = document.createElement('canvas');
const CTX = CANVAS.getContext('2d');

export default function AudioClip({ clip, ...props }: ClipChildProps) {
	const audio = useAudio();
	const { player } = useApplication();
	const waveform = audio.getWaveform(clip.cache.source).value;
	const [ imgSrc, setImgSrc ] = useState<string>('');
	const clipRef = useRef<HTMLDivElement>();

	const {
    viewLength,
    firstVisibleFrame,
    lastVisibleFrame,
    density,
    framesToPercents,
    pixelsToFrames,
		framesToPixels
  } = useContext(TimelineContext);

	useLayoutEffect(() => {
    if (!waveform || !clipRef.current) return;

		const clipBody = clipRef.current.children[0] as HTMLElement;
		// const imageWidth = Math.min(clipBody.offsetWidth, viewLength);
		const imageWidth = clipBody.offsetWidth;

		CANVAS.width = imageWidth;
		const HEIGHT = 16;
		CANVAS.height = HEIGHT * 2;

		console.log(imageWidth);

    CTX.clearRect(0, 0, viewLength, HEIGHT * 2);
		const color = getComputedStyle(clipRef.current).getPropertyValue('--color');
		CTX.fillStyle = color;

		const startSec = clip.start;
		const startSample = startSec * waveform.sampleRate;
		const numSamplesAcrossImage = player.status.framesToSeconds(pixelsToFrames(imageWidth)) * waveform.sampleRate;


		// console.log(sampleStep);
		const CHUNKINESS = 3;

		const numSamples = Math.ceil(imageWidth / CHUNKINESS);
		const sampleStep = numSamplesAcrossImage / numSamples;
		console.log('image width: ', imageWidth, numSamples);

    // const flooredStart = Math.floor(start);
    // const padding = flooredStart - start;
    // const length = end - start;
		// const step = 1;
		// const cellWidth = end - start;
		// console.log(cellWidth);


		// const step = Math.ceil(density);
    for (let i = 0; i < numSamples; i++) {
      // const offset = index - start;
      const sample = Math.round(startSample + i * sampleStep);

      // if (sample >= waveform.peaks.length) break;

			// const min = Math.min(waveform.peaks[sample], waveform.peaks[sample + 1]) / waveform.absoluteMax * HEIGHT;
			// const max = Math.max(waveform.peaks[sample], waveform.peaks[sample + 1]) / waveform.absoluteMax * HEIGHT;
			const min = -Math.max(waveform.peaks[sample], waveform.peaks[sample + 1]) / waveform.absoluteMax * HEIGHT;
			const max = Math.max(waveform.peaks[sample], waveform.peaks[sample + 1]) / waveform.absoluteMax * HEIGHT;

			// const opacity = Math.abs(min) / HEIGHT;
			// const fill = new Color(color).hex('rgb') + Math.min(Math.floor(opacity * 255), 255).toString(16);
			// CTX.fillStyle = fill;
			CTX.fillRect(i * CHUNKINESS, HEIGHT - Math.abs(min), CHUNKINESS - 1, Math.abs(min));
			CTX.fillRect(i * CHUNKINESS, HEIGHT, CHUNKINESS - 1, Math.abs(max));
			// CTX.fillRect(offset, HEIGHT - min, 2, -min + max);
    }

		setImgSrc(CANVAS.toDataURL());
	}, [
		waveform, density, clipRef.current, clip.start, clip.length
	]);

// )
	const left = 0;
	// const left = clip.cache.clipRange[0] - firstVisibleFrame;

	return (
		<Clip
			{...props}
			clip={clip}
			class={styles.audio_clip}
			ref={clipRef}
			stickyChildren={
				<>
					<Icon.Audio/>
					<p className={styles.name}>
						<span
							className={styles.source}
							onMouseDown={e => (e.preventDefault(), e.stopPropagation())}
						>{clip.cache.source?.name ?? clip.path}</span>
					</p>
				</>
			}
			staticChildren={
				<img
					class={styles.waveform}
					src={imgSrc}
					style={{ left: framesToPixels(left) }}
				/>
			}
		/>
	);
}

// const CANVAS_WIDTH = 1024;
// const CANVAS_HEIGHT = 24;
// const CHONKYNESS = 3;
// const LAYERS = 4;

// interface AudioClipProps {
// 	clip: Clip;
// 	range: [ number, number ];
// }

// export function AudioClip({ clip, range }: AudioClipProps) {
// 	const { player } = useApplication();

// 	const containerRef = useRef<HTMLDivElement>();
// 	const canvasRef = useRef<HTMLCanvasElement>();
// 	const context = useMemo(() => canvasRef.current?.getContext('2d'), [ canvasRef.current ]);
// 	const { pixelsToFrames, framesToPixels } = useContext(TimelineContext);

// 	const audioData = useSubscribableValue(player.audio.onDataChanged);
// 	const {
// 		density,
// 		firstVisibleFrame,
// 		lastVisibleFrame
// 	} = useContext(TimelineContext);

// 	useLayoutEffect(() => {
//     if (!context) return;
//     context.clearRect(0, 0, CANVAS_WIDTH, 40);
//     if (!audioData) return;

// 		context.fillStyle = getComputedStyle(context.canvas).getPropertyValue('fill');

//     const start =
//       (player.status.framesToSeconds(firstVisibleFrame) - 0) *
//       audioData.sampleRate;
//     const end =
//       (player.status.framesToSeconds(lastVisibleFrame) - 0) *
//       audioData.sampleRate;

//     const flooredStart = Math.floor(start);
//     const padding = flooredStart - start;
//     const length = end - start;
//     const step = Math.ceil(density);


// 		const timePerChonk = player.status.framesToSeconds(pixelsToFrames(CHONKYNESS));
// 		const samplesPerChonk = timePerChonk * audioData.sampleRate;

// 		for (let i = 0; i < CANVAS_WIDTH / CHONKYNESS; i++) {
// 			let start = i * samplesPerChonk;

// 			for (let j = 0; j < LAYERS; j++) {
// 				const offset = Math.floor(start + samplesPerChonk / LAYERS * j / 2) * 2;
// 				const a = (audioData.peaks[offset] / audioData.absoluteMax) * CANVAS_HEIGHT / 2;
// 				const b = (audioData.peaks[offset + 1] / audioData.absoluteMax) * CANVAS_HEIGHT / 2;
// 				const min = Math.min(a, b);
// 				const max = Math.max(a, b);

// 				context.fillRect(
// 					i * CHONKYNESS,
// 					CANVAS_HEIGHT / 2 - max,
// 					CHONKYNESS,
// 					-min + max
// 				);
// 			}
// 		}
//   }, [,
//     context,
//     audioData,
//     density,
//     firstVisibleFrame,
//     lastVisibleFrame,
// 	]);

// 	return (
//     <Clip
// 			class={styles.audio_clip}
// 			clip={clip}
// 			labelChildren={
// 				<div className={styles.name} title='Go to source'>
// 					Audio
// 				</div>
// 			}>
// 				{/* <div ref={containerRef} className={styles.audio_container}>
// 					<canvas ref={canvasRef} className={styles.audio_waveform} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}/>
// 				</div> */}
//     </Clip>
//   );
// }
