import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  FakeRxMethod,
  asFakeRxMethod,
  getRxMethodSpy,
  newFakeRxMethod,
} from '../src/fake-rx-method';
import { Subject } from 'rxjs';
import { RxMethod } from '@ngrx/signals/rxjs-interop';

function asJestSpy<TArgs extends any[] = any[], TReturnValue = any>(
  fn: (...x: TArgs) => TReturnValue
): jest.Mock<TReturnValue, TArgs, any> {
  return fn as unknown as jest.Mock<TReturnValue, TArgs, any>;
}

@Component({
  selector: 'app-test',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
})
export class TestComponent {
  fakeRxMethod = newFakeRxMethod<number>(jest.fn());
}

describe('FakeRxMethod', () => {
  describe('newFakeRxMethod and getRxMethodSpy', () => {
    let component: TestComponent;
    let fixture: ComponentFixture<TestComponent>;
    let fakeRxMethod: FakeRxMethod<number>;
    let fakeRxMethodJestSpy: jest.Mock<unknown, [p: number], any>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [TestComponent],
      }).compileComponents();

      fixture = TestBed.createComponent(TestComponent);
      component = fixture.componentInstance;
      fakeRxMethod = component.fakeRxMethod;
      fakeRxMethodJestSpy = asJestSpy(getRxMethodSpy(fakeRxMethod));
    });

    it('updates the Spy on imperative calls', () => {
      fakeRxMethod(11);
      expect(fakeRxMethodJestSpy.mock.calls.length).toBe(1);
      expect(fakeRxMethodJestSpy.mock.lastCall).toEqual([11]);
    });

    it('updates the Spy when an observable input emits', () => {
      const o = new Subject<number>();
      fakeRxMethod(o);
      o.next(11);
      expect(fakeRxMethodJestSpy.mock.calls.length).toBe(1);
      expect(fakeRxMethodJestSpy.mock.lastCall).toEqual([11]);
      o.next(22);
      expect(fakeRxMethodJestSpy.mock.calls.length).toBe(2);
      expect(fakeRxMethodJestSpy.mock.lastCall).toEqual([22]);
    });

    it('updates the Sinon fake when a signal input emits (1)', () => {
      const s = signal(72);
      fakeRxMethod(s);
      fixture.detectChanges();
      expect(fakeRxMethodJestSpy.mock.calls.length).toBe(1);
      expect(fakeRxMethodJestSpy.mock.lastCall).toEqual([72]);
      s.set(23);
      fixture.detectChanges();
      expect(fakeRxMethodJestSpy.mock.calls.length).toBe(2);
      expect(fakeRxMethodJestSpy.mock.lastCall).toEqual([23]);
    });

    it('updates the Sinon fake when a signal input emits (2)', () => {
      const s = signal(72);
      fakeRxMethod(s);
      s.set(23);
      fixture.detectChanges();
      expect(fakeRxMethodJestSpy.mock.calls.length).toBe(1);
      expect(fakeRxMethodJestSpy.mock.lastCall).toEqual([23]);
    });
  });

  describe('asFakeRxMethod', () => {
    it('should return the input wihtout change', () => {
      TestBed.runInInjectionContext(() => {
        const rxMethod = newFakeRxMethod<number>() as RxMethod<number>;
        expect(asFakeRxMethod(rxMethod)).toEqual(rxMethod);
      });
    });
  });
});
