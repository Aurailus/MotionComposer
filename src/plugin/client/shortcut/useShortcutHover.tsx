import { RefObject } from 'preact/compat';

import { useHover } from '../Hooks';
import { useShortcuts } from '../Contexts';
import { ShortcutModule } from './ShortcutMappings';

export default function useShortcutHover<T extends HTMLElement>(module: ShortcutModule): [ RefObject<T>, boolean ] {
  const { setCurrentModule } = useShortcuts();
	const [ref, value] = useHover<T>(() => setCurrentModule(module), () => setCurrentModule('global'));
  return [ref, value];
}
