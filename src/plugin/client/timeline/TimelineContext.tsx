import { Signal } from '@preact/signals';
import { createContext } from 'preact';
import { EditorMode, EditorTool } from '../Types';

/**
 * Ripped from `@motion-canvas/ui/src/contexts/timeline.tsx`
 */

export interface TimelineContextData {
  /**
   * Length of the visible area in pixels.
   */
  viewLength: number;
  /**
   * Scroll offset from the left in pixels. Measured from frame 0.
   */
  offset: number;
  /**
   * First frame covered by the infinite scroll.
   */
  firstVisibleFrame: number;
  /**
   * Last frame covered by the infinite scroll.
   */
  lastVisibleFrame: number;
  /**
   * Frames per pixel rounded to the closest power of two.
   */
  density: number;
  /**
   * Frames per timeline segment.
   */
  segmentDensity: number;
  /**
   * Convert frames to percents.
   */
  framesToPercents: (value: number) => number;
  /**
   * Convert frames to pixels.
   */
  framesToPixels: (value: number) => number;
  /**
   * Convert pixels to frames.
   */
  pixelsToFrames: (value: number) => number;
  /**
   * Convert current pointer position to frames.
   */
  pointerToFrames: (value: number) => number;

  tool: Signal<EditorTool>;
  mode: Signal<EditorMode>;
}

export const TimelineContext = createContext<TimelineContextData>({} as any);
