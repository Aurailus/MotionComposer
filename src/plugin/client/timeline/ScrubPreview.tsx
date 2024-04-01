/* @jsxImportSource preact */

import { RefObject } from 'preact/compat';
import { useRef, useEffect, useContext, useCallback } from 'preact/hooks';
import { useApplication, useDocumentEvent, useDuration, usePreviewSettings, useSharedSettings, useSize, useStateChange } from '@motion-canvas/ui';

import styles from './Timeline.module.scss';

import { useShortcut } from '../Hooks';
import { TimelineContext } from './TimelineContext';
import * as Shortcut from '../shortcut/ShortcutMappings';

interface Props {
	show: boolean;
	frame?: RefObject<number>;
	setFrame?: RefObject<(frame: number, pixels?: number) => void>;
	wrapper: RefObject<HTMLDivElement>;
}

export default function ScrubPreview(props: Props) {
	const { range } = useSharedSettings();
	const duration = useDuration();
	const { fps } = usePreviewSettings();
	const { meta, player } = useApplication();
	const { pointerToFrames, framesToPixels } = useContext(TimelineContext);

	const ref = useRef<HTMLDivElement>();
	const frame = useRef(0);

  const handleRangeToCursor = useCallback((side: 'left' | 'right') => {
		if (!props.wrapper.current.matches(':hover')) return;

		const rangeStartFrames = player.status.secondsToFrames(range[0]);
		const rangeEndFrames = player.status.secondsToFrames(range[1]);

		if (side === 'left') {
			meta.shared.range.update(frame.current, Math.max(rangeEndFrames, frame.current), duration, fps);
		}
		else if (side === 'right') {
			meta.shared.range.update(Math.min(rangeStartFrames, frame.current), frame.current, duration, fps);
		}
  }, [ range, props.wrapper.current, pointerToFrames, duration, fps, player.status.secondsToFrames ]);

  useShortcut(Shortcut.RangeStartToCursor, () => handleRangeToCursor('left'), [ handleRangeToCursor ]);
  useShortcut(Shortcut.RangeEndToCursor, () => handleRangeToCursor('right'), [ handleRangeToCursor ]);

	useDocumentEvent('keydown', useCallback(event => {
		if (!props.wrapper.current.matches(':hover')) return;
		if (event.key.toUpperCase() !== 'I') return;
		event.preventDefault();
		event.stopPropagation();
	}, []));

  // useShortcut("I", { press: () => handleRangeToCursor('left'), elem: props.wrapper.current }, [ handleRangeToCursor, props.wrapper.current ]);

	const setFrame = useCallback((newFrame: number, pixels?: number) => {
		frame.current = newFrame;
		if (props.frame) props.frame.current = frame.current;
		if (ref.current) ref.current.style.left = `${pixels ?? framesToPixels(frame.current)}px`;
	}, [ props.frame, ref.current, framesToPixels ]);

	useEffect(() => {
		if (props.setFrame) props.setFrame.current = setFrame;
		return () => props.setFrame.current = null;
	}, [ props.setFrame ]);

	useEffect(() => {
		if (!props.wrapper.current) return;

		function handleMouseMove(evt: PointerEvent) {
			setFrame(pointerToFrames(evt.clientX));
		}

		props.wrapper.current.addEventListener('pointermove', handleMouseMove);
		return () => props.wrapper.current?.removeEventListener('pointermove', handleMouseMove);
	}, [ props.wrapper, pointerToFrames, setFrame ]);

	return (
		<>
			{props.show && <div class={styles.scrub_line} ref={(r) => {
				ref.current = r;
				if (r) r.style.left = `${framesToPixels(frame.current)}px`;
			}}/>}
		</>
	);
}
