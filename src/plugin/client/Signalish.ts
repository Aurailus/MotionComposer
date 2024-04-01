import { useMemo } from 'preact/hooks';

export type Signalish<T = any> = (value?: (T | ((oldValue: T) => T))) => T;

export function createSignalish<T = any>(getter: () => T,
	setter: (value: (T | ((oldValue: T) => T))) => T): Signalish<T> {

	return function(value: (T | ((oldValue: T) => T))) {
		if (arguments.length === 0) return getter();
		const newValue = (typeof value === 'function') ? (value as any)(getter()) : value;
		setter(newValue);
		return newValue;
	};
};

export function useSignalish<T = any>(
	getter: () => T,
	setter: (value: (T | ((oldValue: T) => T))) => T,
	deps?: any[]): Signalish<T> {

	const [ actualGetter, actualSetter ] = (deps !== undefined) ?
		useMemo(() => [ getter, setter ], deps) : [ getter, setter ];

	return useMemo(() => createSignalish(actualGetter, actualSetter), [ actualGetter, actualSetter ]);
};
