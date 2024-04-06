/* @jsxImportSource preact */

import clsx from 'clsx';
import { useApplication } from '@motion-canvas/ui';
import { useRef, useMemo, useEffect, useLayoutEffect } from 'preact/hooks';

import styles from './Clip.module.scss';

import { Clip } from '../../Types';
import { useTimeline } from '../../Contexts';
import { AudioData } from '../../audio/AudioController';

const CANVAS = document.createElement('canvas');
const CTX = CANVAS.getContext('2d');

const CHUNKINESS = 3;
const OVERFLOW = 256;
const WAVEFORM_AMP = 6;
const WAVEFORM_EXP = 1.7;
const BLANK_IMG_SRC = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

interface Props {
	clip: Clip;
	audio: AudioData;
	height: number;
}

export default function Waveform({ audio, clip, height }: Props) {
	const { player } = useApplication();

  const imgRef = useRef<HTMLImageElement>();
	const imgSrc = useRef<string>(BLANK_IMG_SRC);
  const imgLeft = useRef<number>(0);
	const imgWidth = useRef<number>(0);

  const {
    firstFrame: viewFirstFrame,
    lastFrame: viewLastFrame,
    density,
    framesToPixels,
    pixelsToFrames
  } = useTimeline();

  const lastWaveformProps = useRef<[number, number, number, number]>([ 0, 0, 0, 0 ]);
  const recomputeOffset = useMemo(() => clip.uuid % OVERFLOW, [clip.uuid]);

	const [ viewFirstPx, viewLastPx ] = useMemo(() => [
    Math.floor((framesToPixels(viewFirstFrame) + recomputeOffset) / OVERFLOW) * OVERFLOW - recomputeOffset,
    Math.ceil((framesToPixels(viewLastFrame) + recomputeOffset) / OVERFLOW) * OVERFLOW - recomputeOffset,
  ], [ viewFirstFrame, framesToPixels, recomputeOffset ]);


  useLayoutEffect(() => {
    if (!audio) return;

    const rawClipLeftPx = framesToPixels(clip.cache.clipRange[0]);
    const rawClipRightPx = framesToPixels(clip.cache.clipRange[1]);

    if (rawClipRightPx < viewFirstPx || rawClipLeftPx > viewLastPx) return;

    const imgFirstPx = Math.max(viewFirstPx, rawClipLeftPx);
    const imgLastPx = Math.min(viewLastPx, rawClipRightPx);
    const imgWidthPx = Math.ceil(imgLastPx - imgFirstPx);

    if (!imgWidthPx) {
      imgSrc.current = BLANK_IMG_SRC;
      if (imgRef.current) imgRef.current.src = BLANK_IMG_SRC;
      return;
    }

    const drawFirstPx = Math.floor(imgFirstPx / CHUNKINESS) * CHUNKINESS;
    const drawLastPx = Math.ceil(imgLastPx / CHUNKINESS) * CHUNKINESS;
    const drawWidth = drawLastPx - drawFirstPx;
    const drawInsetPx = Math.max(0, drawFirstPx - rawClipLeftPx);

    const drawFirstFrame = pixelsToFrames(drawInsetPx) + clip.cache.startFrames;
    const drawLastFrame = pixelsToFrames(drawWidth) + drawFirstFrame;
    const drawLengthFrames = drawLastFrame - drawFirstFrame;

    if (lastWaveformProps.current[0] === imgFirstPx &&
      lastWaveformProps.current[1] === imgLastPx &&
      lastWaveformProps.current[2] === drawWidth &&
      lastWaveformProps.current[3] === drawLengthFrames) return;

    lastWaveformProps.current = [ imgFirstPx, imgLastPx, drawWidth, drawLengthFrames ];

    CANVAS.width = imgWidthPx;
    CANVAS.height = height;

    CTX.clearRect(0, 0, imgWidthPx, height);
    CTX.fillStyle = getComputedStyle(imgRef.current).getPropertyValue('--color');

    const startSec = player.status.framesToSeconds(drawFirstFrame);
    const endSec = player.status.framesToSeconds(drawLastFrame);
    const lenSecs = endSec - startSec;

    const pixelsPerFrame = 1/density;

    let waveformInd = 0;
    while (true) {
      const waveform = audio.peaks[waveformInd];
      const samplesPerFrame = waveform.sampleRate / 30;
      if (samplesPerFrame / pixelsPerFrame < 2 || waveformInd === audio.peaks.length - 1) break;
      waveformInd++;
    }

    const numChunks = Math.ceil(drawWidth / CHUNKINESS);
    const waveform = audio.peaks[waveformInd];
    const numSamples = (lenSecs) * waveform.sampleRate;
    const sampleStep = numSamples / numChunks;
    const startSample = startSec * waveform.sampleRate;

    const startOffsetPx = drawFirstPx - imgFirstPx;

    for (let i = 0; i < numChunks; i++) {
      let amp = 0;
      const numSamples = Math.ceil(startSample + (i + 1) * sampleStep) - Math.floor(startSample + i * sampleStep);
      for (let j = Math.floor(startSample + i * sampleStep); j < Math.ceil(startSample + (i + 1) * sampleStep); j++)
        amp += waveform.peaks[j] / 0xffff;
      amp /= numSamples;
      amp = Math.pow(amp, WAVEFORM_EXP);
      amp *= audio.absoluteMax * clip.volume * WAVEFORM_AMP * height / 2;

      CTX.rect(
        i * CHUNKINESS + startOffsetPx,
        height / 2 - Math.abs(amp),
        CHUNKINESS - 1,
        Math.abs(amp) * 2
      );
    }

    CTX.fill();

    imgSrc.current = CANVAS.toDataURL();
    imgLeft.current = imgFirstPx - rawClipLeftPx;
    imgWidth.current = imgWidthPx;

		if (imgRef.current) {
			imgRef.current.src = imgSrc.current;
			imgRef.current.style.left = `${imgLeft.current}px`;
			imgRef.current.style.width = `${imgWidth.current}px`;
		}
  }, [
    clip.cache.clipRange[0],
    clip.cache.clipRange[1],
    viewFirstPx,
    viewLastPx,
    framesToPixels,
    pixelsToFrames,
    audio,
		imgRef.current
  ]);

	return (
		<div class={styles.hide_overflow}>
			<div class={clsx(styles.invert_gap, styles.relative)}>
				<img ref={imgRef} class={styles.waveform} src={imgSrc.current}
					style={{ left: `${imgLeft.current}px`, width: `${imgWidth.current}px` }} />
			</div>
		</div>
	)
}
