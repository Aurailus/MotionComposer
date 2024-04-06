/* @jsxImportSource preact */

import styles from './Clip.module.scss';

import * as Icon from '../../icon';
import Clip, { ClipChildProps } from './Clip';

export default function MissingClip({ clip, ...props }: ClipChildProps) {
	return (
		<Clip
			{...props}
			clip={clip}
			class={styles.missing_clip}
			stickyChildren={
				<>
					<Icon.Missing/>
					<p class={styles.name}>
						<span
							class={styles.source}
							onMouseDown={e => (e.preventDefault(), e.stopPropagation())}
						>Missing '{clip.cache.source?.name ?? clip.path}'</span>
					</p>
				</>
			}
		/>
	);
}
