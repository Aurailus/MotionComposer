import { MutableRefObject } from 'preact/compat';
import { useCallback, useState, useMemo } from 'preact/hooks';

export function ensure<T = any>(condition: T, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

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

export type Store<T> = typeof StoreFnType<T>;

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

export function setUUIDNext(next: number) {
	uuidNext = next;
}

export function getUUIDNext() {
	return uuidNext;
}

export function getUUID() {
	return uuidNext++;
}

export function useUUID() {
	return useMemo(() => getUUID(), []);
}
