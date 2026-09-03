/**
 * Store- und Event-Bus-Tests (Architektur §1).
 */

import { describe, expect, it, vi } from 'vitest';
import { createEventBus, createStore } from '@/core/store';

describe('createStore', () => {
  it('liefert den Initialzustand', () => {
    const store = createStore({ count: 0, name: 'drinkshot' });
    expect(store.get()).toEqual({ count: 0, name: 'drinkshot' });
  });

  it('merged flach und benachrichtigt Subscriber', () => {
    const store = createStore({ count: 0, name: 'a' });
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ count: 1 });
    expect(store.get()).toEqual({ count: 1, name: 'a' });
    expect(listener).toHaveBeenCalledWith({ count: 1, name: 'a' }, { count: 0, name: 'a' });
  });

  it('akzeptiert eine Updater-Funktion', () => {
    const store = createStore({ count: 5 });
    store.set((state) => ({ count: state.count + 2 }));
    expect(store.get().count).toBe(7);
  });

  it('feuert nicht, wenn sich nichts aendert', () => {
    const store = createStore({ count: 1 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ count: 1 });
    store.set({});
    expect(listener).not.toHaveBeenCalled();
  });

  it('replace ersetzt den kompletten State', () => {
    const store = createStore({ count: 1, name: 'a' });
    const listener = vi.fn();
    store.subscribe(listener);
    store.replace({ count: 9, name: 'b' });
    expect(store.get()).toEqual({ count: 9, name: 'b' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('replace mit identischer Referenz feuert nicht', () => {
    const initial = { count: 1 };
    const store = createStore(initial);
    const listener = vi.fn();
    store.subscribe(listener);
    store.replace(initial);
    expect(listener).not.toHaveBeenCalled();
  });

  it('meldet Subscriber wieder ab', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    const off = store.subscribe(listener);
    off();
    store.set({ count: 1 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('select feuert nur bei Aenderung des abgeleiteten Werts', () => {
    const store = createStore({ count: 0, name: 'a' });
    const listener = vi.fn();
    store.select((state) => state.name, listener);

    store.set({ count: 1 });
    expect(listener).not.toHaveBeenCalled();

    store.set({ name: 'b' });
    expect(listener).toHaveBeenCalledWith('b', 'a');
  });

  it('select laesst sich abmelden', () => {
    const store = createStore({ name: 'a' });
    const listener = vi.fn();
    const off = store.select((state) => state.name, listener);
    off();
    store.set({ name: 'b' });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('createEventBus', () => {
  interface Events {
    showFinished: { victimId: string };
    tick: number;
  }

  it('ruft registrierte Handler', () => {
    const bus = createEventBus<Events>();
    const handler = vi.fn();
    bus.on('showFinished', handler);
    bus.emit('showFinished', { victimId: 'p1' });
    expect(handler).toHaveBeenCalledWith({ victimId: 'p1' });
  });

  it('ignoriert Events ohne Handler', () => {
    const bus = createEventBus<Events>();
    expect(() => bus.emit('tick', 1)).not.toThrow();
  });

  it('meldet Handler ab', () => {
    const bus = createEventBus<Events>();
    const handler = vi.fn();
    const off = bus.on('tick', handler);
    off();
    bus.emit('tick', 1);
    expect(handler).not.toHaveBeenCalled();
  });

  it('once feuert genau einmal', () => {
    const bus = createEventBus<Events>();
    const handler = vi.fn();
    bus.once('tick', handler);
    bus.emit('tick', 1);
    bus.emit('tick', 2);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(1);
  });

  it('erlaubt Abmelden waehrend des Emits', () => {
    const bus = createEventBus<Events>();
    const second = vi.fn();
    const offFirst = bus.on('tick', () => offSecond());
    const offSecond = bus.on('tick', second);
    expect(() => bus.emit('tick', 1)).not.toThrow();
    offFirst();
  });

  it('clear entfernt alles', () => {
    const bus = createEventBus<Events>();
    const handler = vi.fn();
    bus.on('tick', handler);
    bus.clear();
    bus.emit('tick', 1);
    expect(handler).not.toHaveBeenCalled();
  });
});
