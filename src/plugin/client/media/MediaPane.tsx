/* @jsxImportSource preact */

import clsx from 'clsx';
import { VNode } from 'preact';
import { useEffect, useState, useMemo, useCallback } from 'preact/hooks';
import { useScenes, Button, useStorage, useApplication} from '@motion-canvas/ui';

import styles from './Media.module.scss';

import * as Icon from '../icon';
import { useUIContext } from '../Contexts';
import { ClipSource, ClipSourceComponents, ClipTypes } from '../Types';
import { Vector2 } from '@motion-canvas/core';
import { useSources } from '../Sources';

export default function MediaPane() {
	const uiCtx = useUIContext()
	const clipSources = useSources();

	const [ view, setView ] = useStorage<'lg' | 'md' | 'sm' | 'list'>('md');

	useEffect(() => {
		if (uiCtx.addSource.value === null) return;

		const onDragMove = (evt: PointerEvent) => {
			console.log('move');
		}

		const onDragEnd = (evt: PointerEvent) => {
			console.log('end');
		}

		window.addEventListener('pointermove', onDragMove);
		window.addEventListener('pointerup', onDragEnd);

		return () => {
			window.removeEventListener('pointermove', onDragMove);
			window.removeEventListener('pointerup', onDragEnd);
		}
	}, [ uiCtx.addSource.value ]);

	const clipSourceElements = useMemo(() => {
		function onDragStart(source: ClipSource, evt: PointerEvent) {
			console.log('dragStart');
			uiCtx.addSource.value = source;
			uiCtx.addSourceDragPos.value = new Vector2(evt.clientX, evt.clientY);
		}

		function onDragMove(source: ClipSource, evt: PointerEvent) {
			console.log('dragMove');
			uiCtx.addSourceDragPos.value = new Vector2(evt.clientX, evt.clientY);
		}

		function onDragEnd(source: ClipSource, evt: PointerEvent) {
			console.log('dragEnd');
			uiCtx.addSource.value = null;
		}

		return clipSources
			.sort((a, b) => (ClipTypes.indexOf(a.type) - ClipTypes.indexOf(b.type)) || a.name.localeCompare(b.name))
			.map(s => {
				const Component = ClipSourceComponents[s.type];
				return (
					<Component
						key={s.path}
						source={s}
						onDragStart={(evt) => onDragStart(s, evt)}
						// onDragMove={(evt) => onDragMove(s, evt)}
						// onDragEnd={(evt) => onDragEnd(s, evt)}
					/>
				);
			});
	}, [ clipSources ]);

	return (
		<div class={styles.media_pane}>
			<div class={styles.view}>
				<Button onClick={() => setView('lg')} title='Large View'><Icon.ViewLg/></Button>
				<Button onClick={() => setView('md')} title='Medium View'><Icon.ViewMd/></Button>
				<Button onClick={() => setView('sm')} title='Small View'><Icon.ViewSm/></Button>
				<Button onClick={() => setView('list')} title='List View'><Icon.ViewList/></Button>
			</div>
			<div class={clsx(styles.media_container, styles[view])}>
				{clipSourceElements}
			</div>
		</div>
	);
}
