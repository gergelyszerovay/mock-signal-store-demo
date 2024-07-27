import { RxMethod, rxMethod } from '@ngrx/signals/rxjs-interop';
import { tap } from 'rxjs';

/**
 * FakeRxMethod mock type, it's an extended version of RxMethod, with an additional
 * [RX_METHOD_SPY] property containing a Spy function.
 */
export const RX_METHOD_SPY = Symbol('RX_METHOD_SPY');
export type FakeRxMethod<T> = RxMethod<T> & {
  [RX_METHOD_SPY]: (p: T) => unknown;
};

/**
 * Creates a new rxMethod mock.
 * The returned function accepts a static value, signal, or observable as an input argument.
 *
 * The Spy is called and it stores the call information, when:
 * - the generated function was called with a static value.
 * - the generated function was called with a signal argument, and the signal's value changes.
 * - the generated function was called with an observable argument, and the observable emits.
 *
 * @template T - The type of the parameter of the rxMethod function.
 *
 * @param {((p: T) => unknown)} [spyFn] - An optional, test-framework specific spy function.
 * If not provided, a default empty spy function is used.
 *
 * @returns {FakeRxMethod<T>} A new rxMethod mock.
 */
export function newFakeRxMethod<T>(spyFn?: (p: T) => unknown): FakeRxMethod<T> {
  function defaultGetSpyFunction() {}
  spyFn = spyFn || defaultGetSpyFunction;
  const r = rxMethod(tap((x) => spyFn(x))) as FakeRxMethod<T>;
  r[RX_METHOD_SPY] = spyFn;
  return r;
}

/**
 * Converts the type of a (mocked) RxMethod into a FakeRxMethod.
 *
 * @template T - The argument type of the RxMethod.
 * @param {RxMethod<T>} rxMethod - The (mocked) RxMethod to be converted.
 * @returns {FakeRxMethod<T>} The converted FakeRxMethod.
 */
export function asFakeRxMethod<T>(rxMethod: RxMethod<T>): FakeRxMethod<T> {
  return rxMethod as unknown as FakeRxMethod<T>;
}

/**
 * Gets the Spy from a mocked RxMethod.
 *
 * @template T - The argument type of the RxMethod.
 * @param {RxMethod<T>} rxMethod - The (mocked) RxMethod for which to retrieve the Spy.
 * @returns {(p: T) => unknown>} The Spy function capturing calls to the RxMethod.
 */
export function getRxMethodSpy<T>(rxMethod: RxMethod<T>): (p: T) => unknown {
  return asFakeRxMethod(rxMethod)[RX_METHOD_SPY] as (p: T) => unknown;
}
