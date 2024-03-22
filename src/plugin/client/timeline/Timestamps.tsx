/* @jsxImportSource preact */

import clsx from 'clsx';
import { useMemo, useContext } from 'preact/hooks';

import styles from './Timeline.module.scss';

import { TimelineContext } from './TimelineContext';

export function Timestamps() {
  const {
    framesToPercents,
    framesToPixels,
    firstVisibleFrame,
    lastVisibleFrame,
    segmentDensity,
  } = useContext(TimelineContext);

  const timestamps = useMemo(() => {
    const timestamps = [];
    const clamped = Math.max(1, segmentDensity);
    for (let i = firstVisibleFrame; i < lastVisibleFrame; i += clamped) {
      if (i === 0) continue;
			timestamps.push(
        <div
          className={clsx(styles.timestamp, {
            [styles.odd]: segmentDensity > 0 && (i / segmentDensity) % 2 !== 0,
          })}
          style={{ left: `${framesToPixels(i)}px` }}
          key={i}
          data-frame={i}
        />,
      );
    }
    return timestamps;
  }, [firstVisibleFrame, lastVisibleFrame, framesToPercents, segmentDensity]);

  return <>{timestamps}</>;
}
