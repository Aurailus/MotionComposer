/* @jsxImportSource preact */

import { findAndOpenFirstUserFile, useApplication, usePlayerState, useSubscribableValue } from '@motion-canvas/ui';

import styles from './Clip.module.scss';

import * as Icon from '../../icon';
import { ensure } from '../../Util';
import EventLabel from './EventLabel';
import Clip, { ClipChildProps } from './Clip';

export default function SceneClip({ clip, ...props }: ClipChildProps) {
	const scene = clip.cache.source?.scene;
	ensure(scene, 'SceneClip without scene.');

	const { player } = useApplication();
  const events = useSubscribableValue(scene.timeEvents.onChanged);

	async function handleGoToSource(e: MouseEvent) {
		e.stopPropagation();
		if (!scene.creationStack) return;
		await findAndOpenFirstUserFile(scene.creationStack);
	}

	return (
    <Clip
			{...props}
	 		clip={clip}
			class={styles.scene_clip}

			attachedChildren={
				events
					.filter(event => event.initialTime < clip.start + clip.length - player.status.framesToSeconds(1))
					.map(event => <EventLabel key={event.name} event={event} clip={clip}/>)
			}

			labelChildren={
				<div class={styles.clip_label}>
					<Icon.Scene/>
					<p className={styles.name}>
						<span
							className={styles.source}
							onDblClick={handleGoToSource}
							onMouseDown={e => (e.preventDefault(), e.stopPropagation())}
						>{scene.name}</span>
					</p>
				</div>
			}
		/>
  );
}
