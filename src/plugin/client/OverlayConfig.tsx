/* @jsxImportSource preact */

import styles from './Overlay.module.scss';

import { useState, useLayoutEffect } from 'preact/hooks';
import { NumberInputSelectProps, OverlayWrapper, PluginOverlayConfig } from '@motion-canvas/ui';

import Timeline from './timeline/Timeline';
import Playback from './playback/Playback';

/**
 * Identifies the existing timeline in the DOM, and renders our new timeline overtop of it.
 * Listens for height change events so that we can always perfectly shadow the original timeline.
 */

function Overlay() {
	const [ timelineHeight, setTimelineHeight ] = useState<number>(0);
	const [ playbackWidth, setPlaybackWidth ] = useState<number>(0);

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

	useLayoutEffect(() => {
		const playback = document.querySelector('*[class^=_playback_]>*[class^=_controls_]').parentElement;
		const widthStyleElem = playback.parentElement.parentElement.parentElement.children[0];

		const updateWidth = () => {
			setPlaybackWidth(playback.getBoundingClientRect().width)
		};

		updateWidth();
		const observer = new MutationObserver(() => updateWidth());
		observer.observe(widthStyleElem, { attributes: true, attributeFilter: ['style'] });
	});

  return (
    <OverlayWrapper>
			{timelineHeight > 0 && <div class={styles.timeline_overlay} style={{
				height: `${timelineHeight}px` }}>
				<Timeline/>
			</div>}
			<div class={styles.playback_overlay} style={{ width: `${playbackWidth}px`, bottom: `${timelineHeight + 30}px` }}>
				<Playback/>
			</div>
    </OverlayWrapper>
  );
}
export const OverlayConfig: PluginOverlayConfig = {
  component: Overlay,
};
