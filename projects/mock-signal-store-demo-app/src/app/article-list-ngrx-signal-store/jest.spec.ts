import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArticleListComponent_SS } from './article-list-signal-store.component';
import { ArticleListSignalStore } from './article-list-signal-store.store';
import {
  FAKE_RX_METHOD,
  // MockSignalStore,
  getWritableState,
  asFakeRxMethod,
  // asMockSignalStore,
  // asSinonSpy,
  provideMockSignalStore,
  // getRxMethodFake,
  asWritableSignal,
  // MockSignalStore,
} from '@ngrx/signals/testing';
import {
  // ArticlesService,
  HttpRequestStates,
} from '../services/articles.service';
import { patchState } from '@ngrx/signals';
import { screen } from '@testing-library/angular';
import { UiArticleListComponent } from '../ui-components/ui-article-list.component';
import { Article, Articles } from '../models/article.model';
import { By } from '@angular/platform-browser';
import { UiPaginationComponent } from '../ui-components/ui-pagination.component';
import { MockComponent } from 'ng-mocks';
import { RxMethod } from '@ngrx/signals/rxjs-interop';

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

function resetHistory<TArgs extends readonly any[] = any[], TReturnValue = any>(
  fn: (...x: TArgs) => TReturnValue
): void {
  asSpy(fn).mockClear();
}

function getSpyFn() {
  return jest.fn();
}

export function getRxMethodSpy<T>(rxMethod: RxMethod<T>) {
  return asSpy(asFakeRxMethod(rxMethod)[FAKE_RX_METHOD]);
}

describe('ArticleListComponent_SS - mockComputedSignals: true + mock all child components', () => {
  let component: ArticleListComponent_SS;
  let fixture: ComponentFixture<ArticleListComponent_SS>;
  // we have to use InstanceType<T> to get the real type of a SignalStore
  // https://ngrx.io/guide/signals/faq
  let store: InstanceType<typeof ArticleListSignalStore>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ArticleListComponent_SS,
        MockComponent(UiArticleListComponent),
        MockComponent(UiPaginationComponent),
      ],
      providers: [],
    })
      .overrideComponent(ArticleListComponent_SS, {
        set: {
          providers: [
            // override the component level providers
            // MockProvider(ArticlesService), // injected in ArticleListSignalStore
            provideMockSignalStore(ArticleListSignalStore, {
              getSpyFn,
              // if mockComputedSignals is enabled (default),
              // you must provide an initial value for each computed signals
              initialComputedValues: {
                totalPages: 0,
                pagination: { selectedPage: 0, totalPages: 0 },
              },
            }),
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ArticleListComponent_SS);
    component = fixture.componentInstance;
    // access to a service provided on the component level
    store = fixture.debugElement.injector.get(ArticleListSignalStore);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  describe('router inputs ➡️ store (effect)', () => {
    it("should update the store's state initially", () => {
      expect(getCallCount(getRxMethodSpy(store.loadArticles))).toBe(1);
    });

    it('should call loadArticles if the selectedPage router input changes', () => {
      resetHistory(getRxMethodSpy(store.loadArticles));
      fixture.componentRef.setInput('selectedPage', '22');
      fixture.detectChanges();
      expect(getCallCount(getRxMethodSpy(store.loadArticles))).toBe(1);
    });

    it('should call loadArticles if the pageSize router input changes', () => {
      resetHistory(getRxMethodSpy(store.loadArticles));
      fixture.componentRef.setInput('pageSize', '11');
      fixture.detectChanges();
      expect(getCallCount(getRxMethodSpy(store.loadArticles))).toBe(1);
    });

    it('should call loadArticles only once, even if the both the selectedPage and pageSize router inputs change', () => {
      resetHistory(getRxMethodSpy(store.loadArticles));
      fixture.componentRef.setInput('selectedPage', '22');
      fixture.componentRef.setInput('pageSize', '11');
      fixture.detectChanges();
      expect(getCallCount(getRxMethodSpy(store.loadArticles))).toBe(1);
    });
  });

  describe('Main UI states', () => {
    it('should render the loading message if the request state is FETCHING', () => {
      patchState(getWritableState(store), () => ({
        httpRequestState: HttpRequestStates.FETCHING,
      }));
      fixture.detectChanges();
      expect(screen.queryByText(/loading/i)).toBeDefined();
      expect(screen.queryByText(/error1/i)).toBeNull();
    });

    it('should render the loading message if the request state is INITIAL', () => {
      patchState(getWritableState(store), () => ({
        httpRequestState: HttpRequestStates.INITIAL,
      }));
      fixture.detectChanges();
      expect(screen.queryByText(/loading/i)).toBeDefined();
      expect(screen.queryByText(/error1/i)).toBeNull();
    });

    it('should render the error message if the request state is error', () => {
      patchState(getWritableState(store), () => ({
        httpRequestState: { errorMessage: 'error1' },
      }));
      fixture.detectChanges();
      expect(screen.queryByText(/loading/i)).toBeNull();
      expect(screen.queryByText(/error1/i)).toBeDefined();
    });

    describe('Main UI state: FETCHED', () => {
      let uiPaginationComponent: UiPaginationComponent;
      let uiArticleListComponent: UiArticleListComponent;
      beforeEach(() => {
        patchState(getWritableState(store), () => ({
          httpRequestState: HttpRequestStates.FETCHED,
          articles: [{ slug: 'slug 1', id: 1 } as Article],
        }));
        asWritableSignal(store.pagination).set({
          totalPages: 4,
          selectedPage: 1,
        });
        fixture.detectChanges();

        uiArticleListComponent = fixture.debugElement.queryAll(
          By.directive(UiArticleListComponent)
        )[0]?.componentInstance as UiArticleListComponent;

        uiPaginationComponent = fixture.debugElement.queryAll(
          By.directive(UiPaginationComponent)
        )[0]?.componentInstance as UiPaginationComponent;
      });

      describe('Child component: article list', () => {
        it('should render the articles', () => {
          const uiArticleListComponent = fixture.debugElement.queryAll(
            By.directive(UiArticleListComponent)
          )[0]?.componentInstance as UiArticleListComponent;
          expect(uiArticleListComponent).toBeDefined();
          expect(uiArticleListComponent.articles).toEqual([
            { slug: 'slug 1', id: 1 } as Article,
          ] as Articles);
          expect(screen.queryByText(/loading/i)).toBeNull();
          expect(screen.queryByText(/error1/i)).toBeNull();
        });

        it('should get the article list from the store', () => {
          expect(uiArticleListComponent.articles).toEqual([
            { slug: 'slug 1', id: 1 } as Article,
          ] as Articles);
        });
      });

      describe('Child component: pagination', () => {
        it('should render the pagination component', () => {
          const uiPaginationComponent = fixture.debugElement.queryAll(
            By.directive(UiPaginationComponent)
          )[0]?.componentInstance as UiPaginationComponent;
          expect(uiPaginationComponent).toBeDefined();
          expect(uiPaginationComponent.totalPages).toEqual(4);
          expect(uiPaginationComponent.selectedPage).toEqual(1);
        });

        it('should get the selected page and the number of the total pages from the store', () => {
          asWritableSignal(store.pagination).set({
            selectedPage: 6,
            totalPages: 7,
          });
          fixture.detectChanges();
          expect(uiPaginationComponent.selectedPage).toBe(6);
          expect(uiPaginationComponent.totalPages).toBe(7);
        });

        describe('When the user selects a page', () => {
          beforeEach(() => {
            resetHistory(getRxMethodSpy(store.loadArticles));
            resetHistory(asSpy(store.setSelectedPage));

            uiPaginationComponent.onPageSelected.emit(2);
          });
          it('should update the selected page in the store', () => {
            expect(getCallCount(asSpy(store.setSelectedPage))).toBe(1);
            expect(getLastCallArgs(asSpy(store.setSelectedPage))).toEqual([2]);
          });

          it('should fetch the articles from the server', () => {
            expect(getCallCount(getRxMethodSpy(store.loadArticles))).toBe(1);
          });
        });
      });
    });
  });
});
