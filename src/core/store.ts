/**
 * Minimaler, typisierter Event-Store (Architektur §1: "eigener Store, ~80 Zeilen").
 *
 * - Kein Framework, keine Dependencies.
 * - `set()` merged flach und benachrichtigt nur, wenn sich wirklich etwas geaendert hat.
 * - `select()` abonniert einen abgeleiteten Wert und feuert nur bei dessen Aenderung.
 * - Zusaetzlich ein winziger Event-Bus fuer Spiel-Events (`showFinished`, `victimDrawn`, …).
 */

export type Listener<T> = (state: T, previous: T) => void;
export type Unsubscribe = () => void;

export interface Store<T extends object> {
  get(): Readonly<T>;
  set(patch: Partial<T> | ((state: Readonly<T>) => Partial<T>)): void;
  /** Ersetzt den kompletten State (fuer Reset / Hydration aus localStorage). */
  replace(next: T): void;
  subscribe(listener: Listener<T>): Unsubscribe;
  select<S>(selector: (state: Readonly<T>) => S, listener: (value: S, previous: S) => void): Unsubscribe;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state: T = initial;
  const listeners = new Set<Listener<T>>();

  const emit = (previous: T): void => {
    for (const listener of listeners) listener(state, previous);
  };

  const changed = (patch: Partial<T>): boolean => {
    for (const key of Object.keys(patch) as (keyof T)[]) {
      if (!Object.is(state[key], patch[key])) return true;
    }
    return false;
  };

  return {
    get: () => state,

    set(patch) {
      const resolved = typeof patch === 'function' ? patch(state) : patch;
      if (!changed(resolved)) return;
      const previous = state;
      state = { ...state, ...resolved };
      emit(previous);
    },

    replace(next) {
      if (Object.is(next, state)) return;
      const previous = state;
      state = next;
      emit(previous);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    select(selector, listener) {
      let current = selector(state);
      return this.subscribe((nextState) => {
        const next = selector(nextState);
        if (Object.is(next, current)) return;
        const previous = current;
        current = next;
        listener(next, previous);
      });
    },
  };
}

/* ------------------------------------------------------------------ */
/* Event-Bus                                                           */
/* ------------------------------------------------------------------ */

/** Frei waehlbare Event-Map: Key = Event-Name, Value = Payload-Typ. */
export type EventMap = object;
export type Handler<P> = (payload: P) => void;

export interface EventBus<E> {
  on<K extends keyof E>(event: K, handler: Handler<E[K]>): Unsubscribe;
  once<K extends keyof E>(event: K, handler: Handler<E[K]>): Unsubscribe;
  emit<K extends keyof E>(event: K, payload: E[K]): void;
  clear(): void;
}

export function createEventBus<E extends EventMap>(): EventBus<E> {
  const handlers = new Map<keyof E, Set<Handler<never>>>();

  const bus: EventBus<E> = {
    on(event, handler) {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(handler as Handler<never>);
      return () => {
        handlers.get(event)?.delete(handler as Handler<never>);
      };
    },

    once(event, handler) {
      const off = bus.on(event, (payload) => {
        off();
        handler(payload);
      });
      return off;
    },

    emit(event, payload) {
      const set = handlers.get(event);
      if (!set) return;
      // Kopie, damit Handler sich waehrend des Emits abmelden duerfen.
      for (const handler of [...set]) (handler as Handler<E[typeof event]>)(payload);
    },

    clear() {
      handlers.clear();
    },
  };

  return bus;
}
