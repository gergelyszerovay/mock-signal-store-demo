import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
  getState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { Injectable, computed, inject } from '@angular/core';
import { pipe, switchMap, tap, Observable, of, Subject } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  asWritableSignal,
  getWritableState,
  provideMockSignalStore,
} from '../src/mock-signal-store';
import { getRxMethodSpy } from '../src/fake-rx-method';

function asSpy<TArgs extends any[] = any[], TReturnValue = any>(
  fn: (...x: TArgs) => TReturnValue
): jest.Mock<TReturnValue, TArgs, any> {
  return fn as unknown as jest.Mock<TReturnValue, TArgs, any>;
}

function getCallCount<TArgs extends readonly any[] = any[], TReturnValue = any>(
  fn: (...x: TArgs) => TReturnValue
): number {
  return asSpy(fn).mock.calls.length;
}

function getLastCallArgs<TArgs extends any[] = any[], TReturnValue = any>(
  fn: (...x: TArgs) => TReturnValue
): TArgs {
  const lastCall = asSpy(fn).mock.lastCall;
  if (!lastCall) {
    return undefined as unknown as TArgs;
  }
  return lastCall;
}

function getSpyFn() {
  return jest.fn();
}

@Injectable()
class SampleService {
  getTripleValue(n: number): Observable<number> {
    return of(n * 3);
  }
}

const initialState = {
  value: 1,
  object: {
    objectValue: 2,
    nestedObject: {
      nestedObjectValue: 3,
    },
  },
};

const SampleSignalStore = signalStore(
  withState(initialState),
  withComputed(({ value }) => ({
    doubleNumericValue: computed(() => value() * 2),
    tripleNumericValue: computed(() => value() * 3),
  })),
  withMethods((store) => ({
    setValue(value: number): void {
      patchState(store, () => ({
        value,
      }));
    },
    asyncSetValue: async (value: number) => {
      patchState(store, () => ({
        value,
      }));
    },
    setNestedObjectValue(nestedObjectValue: number): void {
      patchState(store, () => ({
        object: {
          ...store.object(),
          nestedObject: {
            ...store.object.nestedObject(),
            nestedObjectValue,
          },
        },
      }));
    },
  })),
  withMethods((store, service = inject(SampleService)) => ({
    rxMethod: rxMethod<number>(
      pipe(
        tap(() => store.setValue(10)),
        switchMap((n) => service.getTripleValue(n)),
        tapResponse(
          (response) => {
            store.setNestedObjectValue(response);
          },
          (errorResponse: HttpErrorResponse) => {
            store.setNestedObjectValue(0);
          }
        )
      )
    ),
  }))
);

describe('mockSignalStore', () => {
  describe('with default parameters + jest.fn spies', () => {
    // we have to use InstanceType<T> to get the real type of a SignalStore
    // https://ngrx.io/guide/signals/faq
    let store: InstanceType<typeof SampleSignalStore>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          SampleService,
          provideMockSignalStore(SampleSignalStore, {
            getSpyFn,
            initialComputedValues: {
              doubleNumericValue: 20,
              tripleNumericValue: 30,
            },
          }),
        ],
      });
      store = TestBed.inject(SampleSignalStore);
    });

    it('should set the original initial values', () => {
      expect(store.value()).toBe(initialState.value);
      expect(store.object()).toEqual(initialState.object);
    });

    it("should set the computed signal's initial value", () => {
      expect(store.doubleNumericValue()).toBe(20);
    });

    it('should mock the computed signal with a writable signal', () => {
      expect(store.doubleNumericValue()).toBe(20);
      asWritableSignal(store.doubleNumericValue).set(33);
      expect(store.doubleNumericValue()).toBe(33);
    });

    it('should mock the plain updater function with a Spy', () => {
      expect(getCallCount(store.setValue)).toBe(0);
      store.setValue(11);
      expect(getCallCount(store.setValue)).toBe(1);
      expect(getLastCallArgs(store.setValue)).toEqual([11]);
    });

    it('should mock the async updater function with a Spy', () => {
      expect(getCallCount(store.asyncSetValue)).toBe(0);
      store.asyncSetValue(12);
      expect(getCallCount(store.asyncSetValue)).toBe(1);
      expect(getLastCallArgs(store.asyncSetValue)).toEqual([12]);
    });

    it('should mock the rxMethod with a FakeRxMethod (imperative)', () => {
      expect(getCallCount(getRxMethodSpy(store.rxMethod))).toBe(0);
      store.rxMethod(22);
      expect(getCallCount(getRxMethodSpy(store.rxMethod))).toBe(1);
      expect(getLastCallArgs(getRxMethodSpy(store.rxMethod))).toEqual([22]);
    });

    it('should mock the rxMethod with a FakeRxMethod (declarative)', () => {
      const o = new Subject<number>();
      store.rxMethod(o);
      expect(getCallCount(getRxMethodSpy(store.rxMethod))).toBe(0);
      o.next(22);
      expect(getCallCount(getRxMethodSpy(store.rxMethod))).toBe(1);
      expect(getLastCallArgs(getRxMethodSpy(store.rxMethod))).toEqual([22]);
    });

    it('can alter the DeepSignal with patchState', () => {
      patchState(getWritableState(store), {
        value: 20,
      });
      expect(store.value()).toBe(20);
      expect(store.object()).toEqual(initialState.object);

      patchState(getWritableState(store), {
        object: {
          ...initialState.object,
          nestedObject: {
            ...initialState.object.nestedObject,
            nestedObjectValue: 40,
          },
        },
      });
      expect(store.object()).toEqual({
        ...initialState.object,
        nestedObject: {
          ...initialState.object.nestedObject,
          nestedObjectValue: 40,
        },
      });
    });
  });
  describe('parameters', () => {
    it('should throw an expection, if an inital value is missing for a computed Signal', () => {
      expect(() => {
        TestBed.configureTestingModule({
          providers: [
            SampleService,
            provideMockSignalStore(SampleSignalStore, {
              initialComputedValues: {
                doubleNumericValue: 20,
              },
            }),
          ],
        });
        const store = TestBed.inject(SampleSignalStore);
      }).toThrow(Error('tripleNumericValue should have an initial value'));
    });

    it('should throw an expection, if an inital value is missing for a computed Signal (2)', () => {
      expect(() => {
        TestBed.configureTestingModule({
          providers: [SampleService, provideMockSignalStore(SampleSignalStore)],
        });
        const store = TestBed.inject(SampleSignalStore);
      }).toThrowError();
    });

    it('can keep the original computed signals', () => {
      TestBed.configureTestingModule({
        providers: [
          SampleService,
          provideMockSignalStore(SampleSignalStore, {
            mockComputedSignals: false,
          }),
        ],
      });
      const store = TestBed.inject(SampleSignalStore);

      expect(store.doubleNumericValue()).toBe(2);
      expect(store.tripleNumericValue()).toBe(3);
    });

    it('can update the initial value of the store by the initialStatePatch parameter', () => {
      TestBed.configureTestingModule({
        providers: [
          SampleService,
          provideMockSignalStore(SampleSignalStore, {
            initialComputedValues: {
              doubleNumericValue: 20,
              tripleNumericValue: 30,
            },
            initialStatePatch: {
              value: 22,
            },
          }),
        ],
      });
      const store = TestBed.inject(SampleSignalStore);

      expect(store.value()).toBe(22);
    });

    it('can update the initial value of the store by the initialStatePatch parameter (nested objects)', () => {
      TestBed.configureTestingModule({
        providers: [
          SampleService,
          provideMockSignalStore(SampleSignalStore, {
            initialComputedValues: {
              doubleNumericValue: