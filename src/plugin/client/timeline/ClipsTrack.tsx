/* @jsxImportSource preact */

import { useContext } from 'preact/hooks';
import { useApplication, useScenes, useSharedSettings } from '@motion-canvas/ui';

import styles from './Timeline.module.scss';

import { PluginContext } from '../Context';
import { MissingClip, SceneClip } from './Clip';
import { TimelineContext } from './TimelineContext';

export default function ClipsTrack() {
  const scenes = useScenes();
  const { player } = useApplication();
  const { range } = useSharedSettings();
  const { framesToPixels } = useContext(TimelineContext);
  const { getClipFrameRange, clips }= useContext(PluginContext);

  return (
    <div className={styles.clips_track}
    style={{ width: framesToPixels(player.status.secondsToFrames(range[1])) }}>
      {(clips()[0] ?? []).map(clip => {
        const range = getClipFrameRange(clip);

        switch (clip.type) {
          case 'scene': {
            const scene = scenes.find(s => s.name === clip.path);
            if (!scene) break;
            return <SceneClip clip={clip} scene={scene} range={range} />;
          }
          default: {
            break;
          }
        }
        return <MissingClip clip={clip} range={range}/>;
      })}
    </div>
  );
}
