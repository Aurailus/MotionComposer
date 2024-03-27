/* @jsxImportSource preact */

import styles from './Timeline.module.scss';
import { useContext } from 'preact/hooks';
import { PluginContext } from '../Context';
import { AudioClip, MissingClip } from './clip/Clip';

export default function AudioTrack() {
  const ctx = useContext(PluginContext);

  const clips = ctx.clips();

  return (
    <div className={styles.audio_track}>
      {(clips[1] ?? []).map(clip => {
        switch (clip.type) {
          case 'audio': {
            return <AudioClip clip={clip} range={[ 0, 2000 ]} />;
          }
          default: {
            break;
          }
        }
        return <MissingClip clip={clip} range={[ 0, 2000 ]}/>;
      })}
    </div>
  );
}
