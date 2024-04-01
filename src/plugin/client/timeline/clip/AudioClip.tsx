/* @jsxImportSource preact */

import styles from './Clip.module.scss';

import * as Icon from '../../icon';
import Clip, { ClipChildProps } from './Clip';

export default function AudioClip({ clip, ...props }: ClipChildProps) {
	return (
		<Clip
			{...props}
			clip={clip}
			class={styles.audio_clip}
			labelChildren={
				<div class={styles.clip_label}>
					<Icon.Audio/>
					<p className={styles.name}>
						<span
							className={styles.source}
							onMouseDown={e => (e.preventDefault(), e.stopPropagation())}
						>{clip.cache.source?.name ?? clip.path}</span>
					</p>
				</div>
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
