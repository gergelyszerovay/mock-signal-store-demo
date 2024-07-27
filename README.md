##### This is the Demo app for the prototype of the Mock Signal Store

- The source code of `@ngrx/signals/testing` with the `provideMockSignalStore` inside in my `gergelyszerovay/ngrx-platform` fork is [here](https://github.com/gergelyszerovay/ngrx-platform/tree/2024-07-feat-mock-signal-store/modules/signals/testing), [PR with the changes](https://github.com/gergelyszerovay/ngrx-platform/pull/1/files)
- The source code of `@ngrx/signals/testing` with the `provideMockSignalStore` function in this repo is [here](https://github.com/gergelyszerovay/mock-signal-store-demo/tree/main/ngrx-platform/modules/signals/testing) (this is the same code as the one in the `gergelyszerovay/ngrx-platform` repo)

This `@ngrx/signals/testing` implementation is assertation library independent:

- The component test with Jest assertations are [here](https://github.com/gergelyszerovay/mock-signal-store-demo/blob/main/projects/mock-signal-store-demo-app/src/app/article-list-ngrx-signal-store/jest.spec.ts])
- The component test with Sinon assertations are [here](https://github.com/gergelyszerovay/mock-signal-store-demo/blob/main/projects/mock-signal-store-demo-app/src/app/article-list-ngrx-signal-store/sinon.spec.ts)

This version of `provideMockSignalStore`:

- is assertation library independent
- contains a mock injector which mocks the services injected into the mocked store
- prevents the execution of the mocked store's lifecyce hooks
- makes the SignalStore's state unprotected

##### Parameters for `provideMockSignalStore`

```typescript
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
```

##### Usage

```typescript
// component:
export const ArticleListSignalStore = signalStore(
  withState<ArticleListState>(initialArticleListState),
  withComputed(({ articlesCount, pageSize }) => ({
     totalPages: computed(() => Math.ceil(articlesCount() / pageSize())),
  })),
  withComputed(({ selectedPage, totalPages }) => ({
    pagination: computed(() => ({ selectedPage: selectedPage(), totalPages: totalPages() })),
  })),
  withMethods((store) => ({
    setSelectedPage(selectedPage: string | number | undefined): void {
      // ...
    },
    loadArticles: rxMethod<void>(
      pipe(
        // ...
      )
    ),
  })),
  // ...
);

@Component(...)
export class ArticleListComponent_SS {
  readonly store = inject(ArticleListSignalStore);
  // ...
}

// test:

// we have to use InstanceType<T> to get the real type of a SignalStore
// https://ngrx.io/guide/signals/faq
let store: InstanceType<typeof ArticleListSignalStore>;

await TestBed.configureTestingModule({
  imports: [
    ArticleListComponent_SS,
    MockComponent(UiArticleListComponent)
  ]
})
.overrideComponent(
  ArticleListComponent_SS,
  {
    set: {
      providers: [ // override the component level providers
        MockProvider(ArticlesService), // injected in ArticleListSignalStore
        provideMockSignalStore(ArticleListSignalStore, {
          // You can use Jest spies
          getSpyFn: () => jest.fn(),
          // Or Sinion spies
          // getSpyFn: () => fake<T>(), // <= sinon.fake

          // if mockComputedSignals is enabled (default),
          // you must provide an initial value for each computed signals
          initialComputedValues: {
            totalPages: 0,
            pagination: { selectedPage: 0, totalPages: 0 }
          }
        })
      ]
    }
  }
)
.compileComponents();

// ...

// some helper functions

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

export function getRxMethodSpy<T>(rxMethod: RxMethod<T>) {
  return asSpy(asFakeRxMethod(rxMethod)[FAKE_RX_METHOD]);
}

// Jest assertation examples:

expect(getCallCount(asSpy(store.setSelectedPage))).toBe(1);
expect(getCallCount(getRxMethodSpy(store.loadArticles))).toBe(1);

```
