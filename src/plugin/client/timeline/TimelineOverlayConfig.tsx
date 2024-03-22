/* @jsxImportSource preact */

import styles from './Timeline.module.scss';

import { useState, useLayoutEffect } from 'preact/hooks';
import { OverlayWrapper, PluginOverlayConfig } from '@motion-canvas/ui';

import Timeline from './Timeline';

/**
 * Identifies the existing timeline in the DOM, and renders our new timeline overtop of it.
 * Listens for height change events so that we can always perfectly shadow the original timeline.
 */

function TimelineOverlay() {
	const [ height, setHeight ] = useState<number>(0);

	useLayoutEffect(() => {
		const heightStyleElem = document.querySelector('*[class^=_timelineWrapper]')
			.parentElement.parentElement.parentElement.children[0];

		const updateHeight = () => {
			const timeline = heightStyleElem.parentElement.children[2].querySelector('*[class^=_timelineWrapper]');
			if (!timeline) setHeight(0);
			else setHeight(timeline.getBoundingClientRect().height)
		};

		updateHeight();
		const observer = new MutationObserver(() => updateHeight());
		observer.observe(heightStyleElem, { attributes: true, attributeFilter: ['style'] });
	}, []);

  return (
    <OverlayWrapper>
			{height > 0 && <div class={styles.overlay} style={{ height: `${height}px` }}>
				<Timeline/>
			</div>}
    </OverlayWrapper>
  );
}
export const TrackBarOverlayConfig: PluginOverlayConfig = {
  component: TimelineOverlay,
};
