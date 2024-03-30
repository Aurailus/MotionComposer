export const RazorPlayhead = 'K';
export const RangeStartToCursor = 'B';
export const RangeEndToCursor = 'N';

export const InsertAtCursor = '.';
export const OverwriteAtCursor = ',';

export const HoldTimelineMode = 'Control';
export const SwapTimelineMode = 'Tab';
export const ToggleSnapping = 'Alt';

export const RazorTool = 'R';
export const ShiftTool = 'E';
export const SelectTool = 'S';

type ShortcutMapping = { key: string, action: string, available?: () => boolean }[];

const mediaMapping: ShortcutMapping = [
	{ key: InsertAtCursor, action: 'Insert clip at cursor' },
	{ key: OverwriteAtCursor, action: 'Overwrite clip at cursor' },
];

const timelineMapping: ShortcutMapping = [
	{ key: RazorPlayhead, action: 'Cut at cursor' },
	{ key: RangeStartToCursor, action: 'Range start to cursor' },
	{ key: RangeEndToCursor, action: 'Range end to cursor' },
	{ key: SwapTimelineMode, action: 'Toggle mode' },
	{ key: ToggleSnapping, action: 'Toggle snapping' },
	{ key: RazorTool, action: 'Razor tool' },
	{ key: ShiftTool, action: 'Shift tool' },
	{ key: SelectTool, action: 'Select tool' },
];

/** Taken from Motion Canvas's `shortcuts.tsx` */
const viewportMapping: ShortcutMapping = [
	{ key: '0', action: 'Zoom to fit' },
	{ key: '=', action: 'Zoom in' },
	{ key: '-', action: 'Zoom out' },
	{ key: "'", action: 'Toggle grid' },
	{ key: 'P', action: 'Copy coordinates' },
	{
		key: 'I',
		action: 'Use color picker',
		// @ts-ignore
		available: () => typeof EyeDropper === 'function',
	},
];

/** Taken from Motion Canvas's `shortcuts.tsx` */
const globalMapping: ShortcutMapping = [
	{ key: 'Space', action: 'Toggle playback' },
	{ key: '<-', action: 'Previous frame' },
	{ key: '->', action: 'Next frame' },
	{ key: 'Shift <-', action: 'Reset to first frame' },
	{ key: 'Shift ->', action: 'Seek to last frame' },
	{ key: 'M', action: 'Toggle audio' },
	{ key: 'L', action: 'Toggle loop' },
];

export type ShortcutModule = 'global' | 'media' | 'timeline' | 'viewport';

export const ShortcutMappings: Record<ShortcutModule, ShortcutMapping> = {
	global: globalMapping,
	media: mediaMapping,
	timeline: timelineMapping,
	viewport: viewportMapping,
};
