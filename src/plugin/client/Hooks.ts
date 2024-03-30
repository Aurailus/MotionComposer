import { MutableRefObject, RefObject } from 'preact/compat';
import { useCallback, useState, useMemo, useRef, useEffect } from 'preact/hooks';
import { addEventListener } from './Util';

/** useRef() but the initial value takes a lazy initializer. */
export function useLazyRef<T = any>(initializer: () => T): MutableRefObject<T> {
	const [ref] = useState(() => ({ current: initializer() }));
	return ref;
}

type StoreReturnValue<T> = T extends Record<any, any> ? Readonly<T> : T extends Array<any> ? Readonly<T> : T;

function StoreFnType<T>(): StoreReturnValue<T>;
function StoreFnType<T>(v: T | ((value: T) => T)): StoreReturnValue<T>;
function StoreFnType<T>(_v?: T | ((value: T) => T)): StoreReturnValue<T> {
	throw new Error('This function is only for typing purposes.');
};

/** A store is basically a signal. `store()` is a getter, `store(value)` is a setter. */
export type Store<T> = typeof StoreFnType<T>;

/** Returns a store for the value provided. */
export function useStore<T>(initial: T | (() => T)): Store<T> {
	const value = useLazyRef(() => initial instanceof Function ? initial() : initial);
	const [ , setId ] = useState(0);

	const fn = useCallback(function (newValue?: T | ((value: T) => T)) {
		if (arguments.length === 0) return value.current;

		const oldValue = value.current;
		value.current = (newValue instanceof Function) ? (newValue as any)(value.current) : newValue!;
		if (value.current !== oldValue) setId(id => (id + 1) % Number.MAX_SAFE_INTEGER);

		return value.current;
	}, []);

	return fn as Store<T>;
}

let uuidNext = 0;

/** Set the next UUID. Use with caution. */
export function setUUIDNext(next: number) {
	uuidNext = next;
}

/** Get the next UUID. */
export function getUUIDNext() {
	return uuidNext;
}

/** Gets a UUID by returning uuidNext, and then incrementing it internally. */
export function getUUID() {
	return uuidNext++;
}

/** Returns a memoized ID for this component. Calls `getUUID()` under the hood. */
export function useUUID() {
	return useMemo(() => getUUID(), []);
}

export function useHover<T extends HTMLElement>(onHover?: () => void, onBlur?: () => void):
	[ RefObject<T>, boolean ] {

	const [ hovered, setHovered ] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
		const node = ref.current;
		if (!node) return;

		const handelMouseEnter = () => (setHovered(true), onHover?.());
		const handleMouseLeave = () => (setHovered(false), onBlur?.());

		node.addEventListener('mouseenter', handelMouseEnter);
		node.addEventListener('mouseleave', handleMouseLeave);

		return () => {
			node.removeEventListener('mouseenter', handelMouseEnter);
			node.removeEventListener('mouseleave', handleMouseLeave);
		};
	}, [ ref.current ]);

  return [ ref, hovered ];
}

type UseShortcutOptions = {
	press?: () => void;
	pressRelease?: () => void;
	hold?: () => void;
	holdRelease?: () => void;
	release?: () => void;
	elem?: HTMLElement,
	passive?: boolean;
}

const HOLD_DELAY_MS = 150;

export function useShortcut(key: string, shortcut: UseShortcutOptions | (() => void), deps: any[]) {
	const options: UseShortcutOptions = useMemo(() => {
		if (shortcut instanceof Function) return { press: shortcut };
		return shortcut;
	}, deps);


	useEffect(() => {
		const elem = options.elem || document.body;

		let held = false;
		let timeout: number | undefined;

		const listeners: (() => void)[] = [];

		listeners.push(addEventListener(elem, 'keydown', (e: KeyboardEvent) => {
			if (e.key.toUpperCase() !== key.toUpperCase()) return;
			if (!options.passive) {
				e.preventDefault();
				e.stopPropagation();
			}
			if (e.repeat) return;
			if (!options.hold) options.press?.();
			timeout = setTimeout(() => {
				options.hold?.();
				held = true;
			}, HOLD_DELAY_MS);
		}));

		listeners.push(addEventListener(elem, 'keyup', (e: KeyboardEvent) => {
			if (e.key.toUpperCase() !== key.toUpperCase()) return;
			if (!options.passive) {
				e.preventDefault();
				e.stopPropagation();
			}
			if (timeout) clearTimeout(timeout);

			if (!held) {
				if (options.hold) options.press?.();
				options.pressRelease?.();
			}
			else {
				options.holdRelease?.();
			}
			options.release?.();

			held = false;
			clearTimeout(timeout);
		}));

		return () => listeners.forEach(fn => fn());
	}, [ options ]);
}

/**
 * Creates a stateful value that is stored in local storage via a unique key, providing a simple way to
 * store persistent state. State is stored using `JSON.stringify` on update, and retrieved using `JSON.parse`.
 * Based on https://www.joshwcomeau.com/react/persisting-react-state-in-localstorage/.
 *
 * @param def - The default value if no stored value exists.
 * @param key - The unique key to store the value under.
 * @param serverDefault - The default value if the hook is used in SSR.
 * @returns the value and a function to update it, wrapped in an array.
 */

export function useStoredState<T>(def: T | (() => T), key: string, serverDefault?: T | (() => T)): [
	T, (value: T | ((currentValue: T) => T)) => void ] {

	const [ value, setValue ] = useState<T>(() => {
		const stored = window?.localStorage.getItem(key);
		try {
			return stored !== null && stored !== undefined ? JSON.parse(stored) : def;
		} catch (e) {
			console.warn('StoredState error:' + e);
			const defObj = ('window' in globalThis ? def : (serverDefault ?? def));
			return typeof defObj === 'function' ? (defObj as any)() : defObj;
		}
	});

	useEffect(() => window.localStorage.setItem(key, JSON.stringify(value)), [ key, value ]);

	return [ value, setValue ];
}
