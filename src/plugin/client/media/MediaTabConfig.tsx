/* @jsxImportSource preact */

import { useEffect } from 'preact/hooks';
import { Pane, PluginTabConfig, PluginTabProps, Tab } from '@motion-canvas/ui';

import styles from './Media.module.scss';

import { useUIContext } from '../Contexts';
import MediaPane from './MediaPane';

function MediaTabIcon({ tab }: PluginTabProps) {
	return (
		<Tab title='Clips & Media' id='zzz-clips-and-media' tab={tab}>
			<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M120-120q-33 0-56.5-23.5T40-200v-480q0-17 11.5-28.5T80-720q17 0 28.5 11.5T120-680v480h640q17 0 28.5 11.5T800-160q0 17-11.5 28.5T760-120H120Zm160-160q-33 0-56.5-23.5T200-360v-440q0-33 23.5-56.5T280-880h167q16 0 30.5 6t25.5 17l57 57h280q33 0 56.5 23.5T920-720v360q0 33-23.5 56.5T840-280H280Zm0-80h560v-360H527l-80-80H280v440Zm0 0v-440 440Zm250-140-46-60q-6-8-16-8t-16 8l-67 88q-8 10-2.5 21t18.5 11h318q13 0 18.5-11t-2.5-21l-97-127q-6-8-16-8t-16 8l-76 99Z"/></svg>
		</Tab>
	);
}

function MediaTab() {
	// Let the plugin know that the media tab is open.
	const ctx = useUIContext();
	useEffect(() => {
		ctx.updateMediaTabOpen(true);
		return () => ctx.updateMediaTabOpen(false);
	}, []);

	// Render the media tab.
	return (
		<Pane title='Scenes & Media'>
			<div class={styles.media_tab}>
				<MediaPane/>
			</div>
		</Pane>
	);
}

export const MediaTabConfig: PluginTabConfig = {
  name: 'Clips & Media',
	tabComponent: MediaTabIcon,
	paneComponent: MediaTab,
};
