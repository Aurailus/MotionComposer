/* @jsxImportSource preact */

import clsx from 'clsx';
import { useMemo, useContext } from 'preact/hooks';

import styles from './Timeline.module.scss';

import { useTimeline } from '../Contexts';

interface Props {
  firstFrame: number;
  lastFrame: number;
  density: number;
}

export function Timestamps({ firstFrame, lastFrame, density }: Props) {
  const { framesToPixels } = useTimeline();

  const timestamps = useMemo(() => {
    const timestamps = [];
    const clamped = Math.max(1, density);
    for (let i = firstFrame; i < lastFrame; i += clamped) {
      if (i === 0) continue;
			timestamps.push(
        <div key={i} data-frame={i}
          class={clsx(styles.timestamp, (density > 0 && (i / density) % 2 !== 0) && styles.odd)}
          style={{ left: `${framesToPixels(i)}px` }}
        />,
      );
    }
    return timestamps;
  }, [ firstFrame, lastFrame, framesToPixels, density ]);

  return <>{timestamps}</>;
}
