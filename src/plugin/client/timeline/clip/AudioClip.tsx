/* @jsxImportSource preact */

import {
  useLayoutEffect,
  useState,
  useContext,
  useRef,
  useMemo,
} from "preact/hooks";

import styles from "./Clip.module.scss";

import * as Icon from "../../icon";
import { useAudio } from "../../Contexts";
import Clip, { ClipChildProps } from "./Clip";
import { TimelineContext } from "../TimelineContext";
import { useApplication } from "@motion-canvas/ui";
import { clamp } from "@motion-canvas/core";

const CANVAS = document.createElement("canvas");
const CTX = CANVAS.getContext("2d");

const CHUNKINESS = 3;
const OVERFLOW = 256;
const WAVEFORM_AMP = 6;
const WAVEFORM_EXP = 1.7;

export default function AudioClip({ clip, ...props }: ClipChildProps) {
  const audio = useAudio();
  const { player } = useApplication();
  const audioData = audio.getAudioData(clip.cache.source).value;
  const clipRef = useRef<HTMLDivElement>();
  const [imgSrc, setImgSrc] = useState<string>("");
  const [imgLeft, setImgLeft] = useState<number>(0);

  const {
    firstVisibleFrame: viewStartFrame,
    lastVisibleFrame: viewEndFrame,
    pixelsToFrames,
    framesToPixels,
  } = useContext(TimelineContext);

  const lastWaveformProps = useRef<[number, number, number, number]>([
    0, 0, 0, 0,
  ]);
  const recomputeOffset = useMemo(() => clip.uuid % OVERFLOW, [clip.uuid]);
  const [viewFirstPx, viewLastPx] = useMemo(
    () => [
      Math.floor(
        (framesToPixels(viewStartFrame) + recomputeOffset) / OVERFLOW
      ) *
        OVERFLOW -
        recomputeOffset,
      Math.ceil((framesToPixels(viewEndFrame) + recomputeOffset) / OVERFLOW) *
        OVERFLOW -
        recomputeOffset,
    ],
    [viewStartFrame, framesToPixels, recomputeOffset]
  );

  useLayoutEffect(() => {
    if (!audioData || !clipRef.current) return;

    let clipFirstPx =
      Math.floor(
        (framesToPixels(clip.cache.clipRange[0]) + recomputeOffset) / OVERFLOW
      ) *
        OVERFLOW -
      recomputeOffset;
    let clipLastPx =
      Math.ceil(
        (framesToPixels(clip.cache.clipRange[1]) + recomputeOffset) / OVERFLOW
      ) *
        OVERFLOW -
      recomputeOffset;

    const parentBoundingRect =
      clipRef.current.parentElement.getBoundingClientRect();
    const clipBoundingRect =
      clipRef.current.children[0].children[0].getBoundingClientRect();
    const clipLeftPx = clipBoundingRect.left - parentBoundingRect.left;
    const clipRightPx = clipBoundingRect.right - parentBoundingRect.left;

    let croppedFirstPx = clamp(
      viewFirstPx,
      viewLastPx,
      Math.max(clipFirstPx, clipLeftPx)
    );
    let croppedLastPx = clamp(
      viewFirstPx,
      viewLastPx,
      Math.min(clipLastPx, clipRightPx)
    );
    const lengthPx = croppedLastPx - croppedFirstPx;
    const viewLengthFrames = viewEndFrame - viewStartFrame;

    if (
      lastWaveformProps.current[0] === croppedFirstPx &&
      lastWaveformProps.current[1] === croppedLastPx &&
      lastWaveformProps.current[2] === lengthPx &&
      lastWaveformProps.current[3] === viewLengthFrames
    )
      return;
    lastWaveformProps.current = [
      croppedFirstPx,
      croppedLastPx,
      lengthPx,
      viewLengthFrames,
    ];
    if (!lengthPx) return;

    // Okay, finally we've gotten to where we make the image.

    CANVAS.width = lengthPx;
    const HEIGHT = 16;
    CANVAS.height = HEIGHT * 2;

    CTX.clearRect(0, 0, lengthPx, HEIGHT * 2);
    const color = getComputedStyle(clipRef.current).getPropertyValue("--color");
    CTX.fillStyle = color;

    const startSec =
      player.status.framesToSeconds(
        pixelsToFrames(croppedFirstPx - clip.cache.clipRange[0])
      ) + clip.start;
    const endSec =
      player.status.framesToSeconds(
        pixelsToFrames(croppedLastPx - clip.cache.clipRange[0])
      ) + clip.start;

    let waveformInd = 0;
    const numChunks = Math.ceil(lengthPx / CHUNKINESS);
    while (true) {
      const waveform = audioData.peaks[waveformInd];
      const numSamples = (endSec - startSec) * waveform.sampleRate;
      const sampleStep = numSamples / numChunks;
      if (sampleStep <= 4 || waveformInd === audioData.peaks.length - 1) break;
      waveformInd++;
    }

    const waveform = audioData.peaks[waveformInd];
    const numSamples = (endSec - startSec) * waveform.sampleRate;
    const sampleStep = numSamples / numChunks;
    const startSample = startSec * waveform.sampleRate;

    for (let i = 0; i < numChunks; i++) {
      let amp = 0;
      const numSamples =
        Math.ceil(startSample + (i + 1) * sampleStep) -
        Math.floor(startSample + i * sampleStep);
      for (
        let j = Math.floor(startSample + i * sampleStep);
        j < Math.ceil(startSample + (i + 1) * sampleStep);
        j++
      )
        amp += waveform.peaks[j] / 0xffff;
      amp /= numSamples;
      amp = Math.pow(amp, WAVEFORM_EXP);
      amp *= audioData.absoluteMax * clip.volume * WAVEFORM_AMP * HEIGHT;

      // TODO: collapse into one fillRect function
      CTX.fillRect(
        i * CHUNKINESS,
        HEIGHT - Math.abs(amp),
        CHUNKINESS - 1,
        Math.abs(amp)
      );
      CTX.fillRect(i * CHUNKINESS, HEIGHT, CHUNKINESS - 1, Math.abs(amp));
    }

    setImgSrc(CANVAS.toDataURL());
    setImgLeft(croppedFirstPx - clipLeftPx);
  }, [
    viewFirstPx,
    viewLastPx,
    Math.round(viewStartFrame - viewEndFrame),
    framesToPixels,
    audioData,
    clipRef.current,
  ]);

  return (
    <Clip
      {...props}
      clip={clip}
      class={styles.audio_clip}
      ref={clipRef}
      stickyChildren={
        <>
          <Icon.Audio />
          <p className={styles.name}>
            <span
              className={styles.source}
              onMouseDown={(e) => (e.preventDefault(), e.stopPropagation())}
            >
              {clip.cache.source?.name ?? clip.path}
            </span>
          </p>
        </>
      }
      staticChildren={
        <img class={styles.waveform} src={imgSrc} style={{ left: imgLeft }} />
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
