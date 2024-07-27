import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { ArticleListSignalStore } from './article-list-signal-store.store';
import { UiArticleListComponent } from '../ui-components/ui-article-list.component';
import { UiPaginationComponent } from '../ui-components/ui-pagination.component';
import {
  HttpRequestStateErrorPipe,
  HttpRequestStates,
} from '../services/articles.service';

@Component({
  selector: 'app-article-list-ss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UiArticleListComponent,
    UiPaginationComponent,
    HttpRequestStateErrorPipe,
  ],
  providers: [ArticleListSignalStore],
  templateUrl: 'article-list-signal-store.component.html',
})
export class ArticleListComponent_SS {
  // we get these from the router, as we use withComponentInputBinding()
  selectedPage = input<string | undefined>(undefined);
  pageSize = input<string | undefined>(undefined);

  HttpRequestStates = HttpRequestStates;

  readonly store = inject(ArticleListSignalStore);

  constructor() {
    effect(() => {
      // 1️⃣ the effect() tracks this two signals only
      const selectedPage = this.selectedPage();
      const pageSize = this.pageSize();
      // 2️⃣ we wrap the function we want to execute on signal change
      // with an untracked() function
      untracked(() => {
        // 👈
        // we don't want to track anything in this block
        this.store.setSelectedPage(selectedPage);
        this.store.setPageSize(pageSize);
        this.store.loadArticles();
      });
    });
  }
}
