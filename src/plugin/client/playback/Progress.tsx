/* @jsxImportSource preact */

import styles from './Playback.module.scss';

interface ProgressProps {
  completion: number;
}

export default function Progress({ completion }: ProgressProps) {
  return (
    <div class={styles.progress}>
      <div
        class={styles.fill}
        style={{width: `${completion * 100}%`}}
      />
    </div>
  );
}
