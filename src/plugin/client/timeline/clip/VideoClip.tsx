/* @jsxImportSource preact */

import styles from './Clip.module.scss';

import * as Icon from '../../icon';
import Clip, { ClipChildProps } from './Clip';

export default function VideoClip({ clip, ...props }: ClipChildProps) {
	return (
    <Clip
			{...props}
	 		clip={clip}
			class={styles.video_clip}
			stickyChildren={
				<>
					<Icon.Video/>
					<p className={styles.name}>
						<span
							className={styles.source}
							onMouseDown={e => (e.preventDefault(), e.stopPropagation())}
						>{clip.cache.source.name ?? clip.path}</span>
					</p>
				</>
			}
		/>
  );
}
