import { SDKState } from "../types";

/**
 * Tracks the SDK's current state (idle/listening/processing/speaking/error)
 * and notifies any registered listeners whenever it changes.
 *
 * This is what powers the onStateChange() event from our public API -
 * a developer's UI (like a "listening..." spinner) reacts to these changes.
 */
export class StateMachine {
  private currentState: SDKState = "idle";
  private listeners: Array<(state: SDKState) => void> = [];

  getState(): SDKState {
    return this.currentState;
  }

  setState(newState: SDKState): void {
    this.currentState = newState;
    for (const listener of this.listeners) {
      listener(newState);
    }
  }

  onChange(listener: (state: SDKState) => void): void {
    this.listeners.push(listener);
  }
}