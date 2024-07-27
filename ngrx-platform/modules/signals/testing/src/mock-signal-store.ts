import {
  Provider,
  ProviderToken,
  Signal,
  WritableSignal,
  isSignal,
  untracked,
  signal,
  Injector,
  runInInjectionContext,
  DestroyRef,
} from '@angular/core';

import {
  MOCK_SIGNAL_STORE_CONFIG_TOKEN,
  StateSource,
  WritableStateSource,
  getState,
  patchState,
} from '@ngrx/signals';

import { newFakeRxMethod } from './fake-rx-method';

/**
 * Constructor type.
 */
interface Constructor<ClassType> {
  new (...args: never[]): ClassType;
}

/**
 * Type for the state of the singlaStore.
 */
type InitialState<T> = T extends StateSource<infer U> ? U : never;

/**
 * Given a type T, determines the keys of the signal properties.
 */
type SignalKeys<T> = {
  // -? makes the key required, opposite of ?
  [K in keyof T]-?: T[K] extends Signal<unknown> ? K : never;
}[keyof T];

/**
 * Type to extract the wrapped type from a Signal type.
 *
 * @template T - The original Signal type.
 * @returns The unwrapped type if T is a Signal, otherwise, 'never'.
 */
type UnwrapSignal<T> = T extends Signal<infer U> ? U : never;

/**
 * Parameters for providing a mock signal store.
 *
 * @template T The type of the original signal store.
 * @param initialStatePatch A partial initial state to override the original initial state.
 * @param initialComputedValues Initial values for computed signals.
 * @param mockComputedSignals Flag to mock computed signals (default is true).
 * @param mockMethods Flag to mock methods (default is true).
 * @param mockRxMethods Flag to mock RxMethods (default is true).
 * @param getSpyFn Returns a test/spy framework specific spy function (default: a function returning an empty function)
 * @param debug Flag to enable debug mode (default is false).
 */
export type ProvideMockSignalStoreParams<T> = {
  initialStatePatch?: Partial<InitialState<T>>;
  initialComputedValues?: Omit<
    {
      [K in SignalKeys<T>]?: UnwrapSignal<T[K]>;
    },
    keyof InitialState<T>
  >;
  mockComputedSignals?: boolean;
  mockMethods?: boolean;
  mockRxMethods?: boolean;
  getSpyFn?: () => () => unknown;
  debug?: boolean;
};

class SimpleDestoryRef extends DestroyRef {
  private callbackFns: Record<string, () => void> = {};
  private counter = 0;

  override onDestroy(callback: () => void): () => void {
    const callbackId = String(this.counter++);
    this.callbackFns[callbackId] = callback;
    return () => {
      if (this.callbackFns[callbackId]) {
        delete this.callbackFns[callbackId];
      }
    };
  }

  destroy(): void {
    Object.keys(this.callbackFns).forEach((callbackId) => {
      if (this.callbackFns[callbackId]) {
        this.callbackFns[callbackId]();
        delete this.callbackFns[callbackId];
      }
    });
  }
}

class MockInjector extends Injector {
  constructor(protected destroyRef: DestroyRef) {
    super();
  }
  get(token: unknown) {
    if (token === MOCK_SIGNAL_STORE_CONFIG_TOKEN) {
      return 'enabled';
    }
    if (token === DestroyRef) {
      return this.destroyRef;
    }
    if (token === Injector) {
      return this;
    }
    return undefined;
  }
  getDestryRef(): DestroyRef {
    return this.destroyRef;
  }
}

/**
 * Provides a mock version of signal store.
 *
 * @template ClassType The class type that extends StateSignal<object>.
 * @param classConstructor The constructor function for the class.
 * @param params Optional parameters for providing the mock signal store.
 * @returns The provider for the mock signal store.
 *
 * Usage:
 *
 * ```typescript
 * // component:
 *
 * export const ArticleListSignalStore = signalStore(
 *   withState<ArticleListState>(initialArticleListState),
 *   withComputed(({ articlesCount, pageSize }) => ({
 *      totalPages: computed(() => Math.ceil(articlesCount() / pageSize())),
 *   })),
 *   withComputed(({ selectedPage, totalPages }) => ({
 *     pagination: computed(() => ({ selectedPage: selectedPage(), totalPages: totalPages() })),
 *   })),
 *   // ...
 * );
 *
 * @Component(...)
 * export class ArticleListComponent_SS {
 *   readonly store = inject(ArticleListSignalStore);
 *   // ...
 * }
 *
 * // test:
 *
 * // we have to use UnwrapProvider<T> to get the real type of a SignalStore
 * let store: UnwrapProvider<typeof ArticleListSignalStore>;
 * let mockStore: MockSignalStore<typeof store>;
 *
 * await TestBed.configureTestingModule({
 *   imports: [
 *     ArticleListComponent_SS,
 *     MockComponent(UiArticleListComponent)
 *   ]
 * })
 * .overrideComponent(
 *   ArticleListComponent_SS,
 *   {
 *     set: {
 *       providers: [ // override the component level providers
 *         MockProvider(ArticlesService), // injected in ArticleListSignalStore
 *         provideMockSignalStore(ArticleListSignalStore, {
 *           // if mockComputedSignals is enabled (default),
 *           // you must provide an initial value for each computed signals
 *           initialComputedValues: {
 *             totalPages: 0,
 *             pagination: { selectedPage: 0, totalPages: 0 }
 *           }
 *         })
 *       ]
 *     }
 *   }
 * )
 * .compileComponents();
 *
 * store = component.store;
 * mockStore = asMockSignalStore(store);
 *
 * ```
 */

export function provideMockSignalStore<ClassType extends StateSource<object>>(
  classConstructor: Constructor<ClassType>,
  params?: ProvideMockSignalStoreParams<ClassType>
): Provider {
  let cachedStore: ClassType | undefined = undefined;
  return {
    provide: classConstructor,
    useFactory: () => {
      // use the cached instance of the store to work around Angular
      // attaching created items to certain nodes.
      if (cachedStore) {
        return cachedStore;
      }
      let store!: ClassType;
      const destroyRef = new SimpleDestoryRef();
      const mockInjector = new MockInjector(destroyRef);

      runInInjectionContext(mockInjector, () => {
        store = Reflect.construct(classConstructor, []);
      });
      cachedStore = store;
      destroyRef.destroy();

      const keys = Object.keys(store) as Array<keyof ClassType>;

      function defaultGetSpyFunction() {}

      const getSpyFn = params?.getSpyFn || defaultGetSpyFunction;

      const pluckerSignals = keys.filter(
        (k) => isSignal(store[k]) && k in getState(store)
      );
      const combinedSignals = keys.filter(
        (k) => isSignal(store[k]) && !pluckerSignals.includes(k)
      );
      const rxMethods = keys.filter(
        (k) =>
          typeof store[k] === 'function' &&
          !isSignal(store[k]) &&
          'unsubscribe' in (store[k] as object)
      );
      const methods = keys.filter(
        (k) =>
          typeof store[k] === 'function' &&
          !isSignal(store[k]) &&
          !rxMethods.includes(k)
      );

      if (params?.debug === true) {
        console.debug('pluckerSignals', pluckerSignals);
        console.debug('combinedSignals', combinedSignals);
        console.debug('rxMethods', rxMethods);
        console.debug('methods', methods);
      }

      if (params?.mockComputedSignals !== false) {
        combinedSignals.forEach((k) => {
          if (
            params?.initialComputedValues &&
            k in params.initialComputedValues
          ) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            store[k] = signal(params?.initialComputedValues?.[k]);
          } else {
            throw new Error(`${String(k)} should have an initial value`);
          }
        });
      }

      if (params?.mockMethods !== false) {
        methods.forEach((k) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          store[k] = getSpyFn();
        });
      }

      if (params?.mockRxMethods !== false) {
        rxMethods.forEach((k) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          store[k] = newFakeRxMethod<unknown>(getSpyFn());
        });
      }

      if (params?.initialStatePatch) {
        untracked(() => {
          patchState(getWritableState(store), (s) => ({
            ...s,
            ...params.initialStatePatch,
          }));
        });
      }

      if (params?.debug === true) {
        console.debug('Mocked store:', store);
      }

      return store;
    },
  };
}

/**
 * Converts the type of a (mocked) Signal to a WritableSignal
 */
export function asWritableSignal<T>(s: Signal<T>): WritableSignal<T> {
  return s as WritableSignal<T>;
}

export function getWritableState<T extends object>(
  s: WritableStateSource<T> | StateSource<T>
): WritableStateSource<T> {
  return s as unknown as WritableStateSource<T>;
}
