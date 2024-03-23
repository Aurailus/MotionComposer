/* @jsxImportSource preact */

import { Signal } from '@preact/signals';
import { useContext } from 'preact/hooks';
import { usePlayerState } from '@motion-canvas/ui';

import styles from './Timeline.module.scss';

import { TimelineContext } from './TimelineContext';
import { PluginContext } from '../Context';

interface PlayheadProps {
  seeking: Signal<number | null>;
}

export function Playhead({ seeking }: PlayheadProps) {
  const { framesToPixels } = useContext(TimelineContext);
	const { playheadPos } = useContext(PluginContext);
  const { speed } = usePlayerState();
  // const time = usePlayerTime();
  const frame = seeking.value ?? playheadPos();

  return (
    <div
      className={styles.playhead}
      data-frame={formatFrames(frame, speed)}
      style={{
        left: `${framesToPixels(frame)}px`,
      }}
    />
  );
}

function formatFrames(frames: number, speed: number) {
  const round = speed % 1 === 0;
  if (round) {
    return frames;
  } else {
    return frames.toFixed(2);
  }
}
