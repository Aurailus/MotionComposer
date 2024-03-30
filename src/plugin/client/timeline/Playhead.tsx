/* @jsxImportSource preact */

import { Signal } from '@preact/signals';
import { useContext } from 'preact/hooks';
import { usePlayerState, usePlayerTime } from '@motion-canvas/ui';

import styles from './Timeline.module.scss';

import { TimelineContext } from './TimelineContext';

interface PlayheadProps {
  seeking: Signal<number | null>;
}

export function Playhead({ seeking }: PlayheadProps) {
  const { framesToPixels } = useContext(TimelineContext);
  const { speed } = usePlayerState();
  const time = usePlayerTime();

  const frame = seeking.value ?? time.frame;

  return (
    <div
      className={styles.playhead}
      data-frame={formatFrames(frame, speed)}
      style={{ left: `${framesToPixels(frame)}px` }}
    />
  );
}

function formatFrames(frames: number, speed: number) {
  if (speed % 1 === 0) return frames;
  else return frames.toFixed(2);
}
