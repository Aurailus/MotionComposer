/* @jsxImportSource preact */

import styles from './Clip.module.scss';

import * as Icon from '../../icon';
import Clip, { ClipChildProps } from './Clip';
import { useAudio } from '../../Contexts';
import { useRef } from 'preact/hooks';
import Waveform from './Waveform';

export default function VideoClip({ clip, ...props }: ClipChildProps) {
  const audio = useAudio();
  const clipRef = useRef<HTMLDivElement>();
  const audioData = audio.getAudioData(clip.cache.source).value;

	return (
    <Clip
			ref={clipRef}
			{...props}
	 		clip={clip}
			class={styles.video_clip}
			stickyChildren={
				<>
					<Icon.Video/>
					<p class={styles.name}>
						<span
							class={styles.source}
							onMouseDown={e => (e.preventDefault(), e.stopPropagation())}
						>{clip.cache.source.name ?? clip.path}</span>
					</p>
				</>
			}
      staticChildren={
				<Waveform audio={audioData} clip={clip} height={40} />
      }
		/>
  );
}
