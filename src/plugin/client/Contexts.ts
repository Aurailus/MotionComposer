import { createContext } from 'preact';
import { Signal } from '@preact/signals';
import { useContext } from 'preact/hooks';
import { Vector2 } from '@motion-canvas/core';

import MotionComposer from './MotionComposer';
import AudioController from './audio/AudioController';
import { ShortcutModule } from './shortcut/ShortcutMappings';
import { ClipSource, EditorMode, EditorTool } from './Types';

/** Audio Context. */

export interface AudioContextData {
	audio: AudioController;
}

export const AudioContext = createContext<AudioContextData>({} as any);

export function useAudio() {
  return MotionComposer.audio;
}

/** UI Context. */

export interface UIContextData {
	mediaTabOpen: boolean;

	updateMediaTabOpen: (open: boolean) => void;

	addSource: Signal<ClipSource>;
	addSourceDragPos: Signal<Vector2>;
}

export const UIContext = createContext<UIContextData>({} as any);

export function useUIContext() {
	return useContext(UIContext);
}

/** Shortcuts Context. */

export interface ShortcutsContextData {
  currentModule: ShortcutModule;
  setCurrentModule: (module: ShortcutModule) => void;
};

export const ShortcutsContext = createContext<ShortcutsContextData>({} as any);

export function useShortcuts() {
  return useContext(ShortcutsContext);
}

/** Timeline Context */

export interface TimelineContextData {
  /** First visible frame */
  firstFrame: number;

  /** Last visible frame. */
  lastFrame: number;

  /** Frames per pixel rounded to the closest power of two. */
  density: number;

  /** View length in pixels. */
  viewLength: number;

  /** Scroll offset in pixels. */
  viewOffset: number;

  framesToPercents: (value: number) => number;
  framesToPixels: (value: number) => number;
  pixelsToFrames: (value: number) => number;
  pointerToFrames: (value: number) => number;

  tool: EditorTool;
  setTool: (tool: EditorTool) => void;

  mode: EditorMode;
  setMode: (mode: EditorMode) => void;

  snap: boolean;
  setSnap: (snap: boolean) => void;
}

export const TimelineContext = createContext<TimelineContextData>({} as any);

export function useTimeline() {
	return useContext(TimelineContext);
}
