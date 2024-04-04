/* @jsxImportSource preact */

import { useApplication } from '@motion-canvas/ui';
import { useRef, useMemo, useContext, useState } from 'preact/hooks';

import { Clip } from '../../Types';
import { TimelineContext } from '../TimelineContext';
import { AudioData } from '../../audio/AudioController';

interface Props {
	clip: Clip;
	audio: AudioData;
	width: number;
	height: number;
}

export default function Waveform({ audio, clip, width, height }: Props) {
	const { player } = useApplication();
  const clipRef = useRef<HTMLDivElement>();

  const imgRef = useRef<HTMLImageElement>();
	const imgSrc = useRef<string>('');
  const imgLeft = useRef<number>(0);

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
    const color = getComputedStyle(clipRef.current).getPropertyValue('--color');
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
}
