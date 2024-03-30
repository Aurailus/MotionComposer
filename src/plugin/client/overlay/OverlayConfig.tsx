/* @jsxImportSource preact */

import styles from './Overlay.module.scss';

import { useState, useLayoutEffect } from 'preact/hooks';
import { OverlayWrapper, PluginOverlayConfig } from '@motion-canvas/ui';

import Timeline from '../timeline/Timeline';
import { FooterShortcuts } from '../shortcut/FooterShortcuts';

/**
 * Identifies the existing timeline in the DOM, and renders our new timeline overtop of it.
 * Listens for height change events so that we can always perfectly shadow the original timeline.
 */

function Overlay() {
	const [ timelineHeight, setTimelineHeight ] = useState<number>(0);

	useLayoutEffect(() => {
		const heightStyleElem = document.querySelector('*[class^=_timelineWrapper]')
			.parentElement.parentElement.parentElement.children[0];

		const updateHeight = () => {
			const timeline = heightStyleElem.parentElement.children[2].querySelector('*[class^=_timelineWrapper]');
			if (!timeline) setTimelineHeight(0);
			else setTimelineHeight(timeline.getBoundingClientRect().height)
		};

		updateHeight();
		const observer = new MutationObserver(() => updateHeight());
		observer.observe(heightStyleElem, { attributes: true, attributeFilter: ['style'] });
	}, []);

	return (
		<OverlayWrapper>
			{timelineHeight > 0 && <div class={styles.timeline_overlay} style={{
				height: `${timelineHeight}px` }}>
				<Timeline/>
			</div>}
			<div class={styles.shortcuts_overlay}>
				<FooterShortcuts/>
			</div>
		</OverlayWrapper>
	);
}

export const OverlayConfig: PluginOverlayConfig = {
	component: Overlay,
};
