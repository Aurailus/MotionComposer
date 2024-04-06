/* @jsxImportSource preact */

import { useRef } from 'preact/hooks';

import styles from './Clip.module.scss';

import Waveform from './Waveform';
import * as Icon from '../../icon';
import { useAudio } from '../../Contexts';
import Clip, { ClipChildProps } from './Clip';


export default function AudioClip({ clip, ...props }: ClipChildProps) {
  const audio = useAudio();
  const clipRef = useRef<HTMLDivElement>();
  const audioData = audio.getAudioData(clip.cache.source).value;

  return (
    <Clip
      {...props}
      clip={clip}
      class={styles.audio_clip}
      ref={clipRef}
      stickyChildren={
        <>
          <Icon.Audio />
          <p class={styles.name}>
            <span
              class={styles.source}
              onMouseDown={(e) => (e.preventDefault(), e.stopPropagation())}
            >
              {clip.cache.source?.name ?? clip.path}
            </span>
          </p>
        </>
      }
      staticChildren={
				<Waveform audio={audioData} clip={clip} height={32} />
      }
    />
  );
}
