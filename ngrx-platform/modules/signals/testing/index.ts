/*
 * Public API Surface of fake-rx-method
 */

export {
  FakeRxMethod,
  RX_METHOD_SPY as FAKE_RX_METHOD,
  newFakeRxMethod,
  asFakeRxMethod,
  getRxMethodSpy as getRxMethodFake,
} from './src/fake-rx-method';

/*
 * Public API Surface of mock-signal-store
 */

export {
  ProvideMockSignalStoreParams,
  provideMockSignalStore,
  getWritableState,
  asWritableSignal,
} from './src/mock-signal-store';
