import { MutableRefObject } from 'preact/compat';
import { useCallback, useState, useMemo } from 'preact/hooks';

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
