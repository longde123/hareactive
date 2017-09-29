import { LinkedList, Node, Cons, cons } from "./linkedlist";
import { Behavior } from "./behavior";

export type Time = number;

function isBehavior(b: any): b is Behavior<any> {
  return typeof b === "object" && ("at" in b);
}

export const enum State {
  // Values are pushed to listeners
  Push,
  // Values should be pulled by listeners
  Pull,
  // Values should be pulled and the reactive will _never_ switch
  // state to `Push`
  OnlyPull,
  // Most, but not all, reactives start in this state
  Inactive,
  // The reactive value will never update again
  Done
}

export interface Observer<A> {
  push(a: A): void;
  changeStateDown(state: State): void;
}

export interface Subscriber<A> extends Observer<A> {
  deactivate(): void;
}

// export function changePullersParents(n: number, parents: Cons<Reactive<any>>): void {
//   if (parents === undefined) {
//     return;
//   }
//   if (isBehavior(parents.value)) {
//     parents.value.changePullers(n);
//   }
//   changePullersParents(n, parents.tail);
// }

type NodeParentPair = {
  parent: Reactive<any>,
  node: Node<any>
};

export abstract class Reactive<A> implements Observer<any> {
  state: State = State.Inactive;
  last: A;
  children: LinkedList<Observer<A>> = new LinkedList();
  parents: Cons<Reactive<any>>;
  listenerNodes: Cons<NodeParentPair>;
  nrOfPullers: number = 0;
  addListener(node: Node<any>): void {
    this.children.append(node);
    if (this.state === State.Inactive) {
      this.activate();
    }
  }
  removeListener(node: Node<any>): void {
    this.children.remove(node);
    if (this.children.head === undefined && this.state !== State.Done) {
      this.deactivate();
    }
  }
  changeStateDown(state: State): void {
    for (const child of this.children) {
      child.changeStateDown(state);
    }
  }
  activate(): void {
    for (const parent of this.parents) {
      const node = new Node(this);
      this.listenerNodes = cons({node, parent}, this.listenerNodes);
      parent.addListener(node);
      const parentState = parent.state;
      if (parentState !== State.Push) {
        this.state = parentState;
      }
    }
  }
  deactivate(done: boolean = false): void {
    for (const {node, parent} of this.listenerNodes) {
      parent.removeListener(node);
    }
    this.state = done === true ? State.Done : State.Inactive;
  }
  changePullers(n: number): void {
    this.nrOfPullers += n;
    for (const parent of this.parents) {
      parent.changePullers(n);
    }
  }
  abstract refresh(b: any): A;
  abstract pull(): boolean;
  abstract push(a: any): void;
  subscribe(callback: (a: A) => void): Subscriber<A> {
    return new PushOnlyObserver(callback, this);
  }
  observe(
    push: (a: A) => void,
    beginPulling: (pull: () => void) => () => void
  ): CbObserver<A> {
    return new CbObserver(push, beginPulling, this);
  }
}

export class CbObserver<A> implements Observer<A> {
  private _endPulling: () => void;
  node: Node<Observer<A>> = new Node(this);
  constructor(
    public push: (a: A) => void,
    private _beginPulling: (pull: () => void) => () => void,
    public source: Reactive<A>
  ) {
    source.addListener(this.node);
    if (source.state === State.Pull || source.state === State.OnlyPull) {
      this._endPulling = _beginPulling(this.pull.bind(this));
    }
    if (isBehavior(source)) {
      push(source.at());
    }
  }
  pull(): void {
    if (this.source.pull()) {
      this.push(this.source.last);
    }
  }
  changeStateDown(state: State): void {
    if (state === State.Pull || state === State.OnlyPull) {
      this._endPulling = this._beginPulling(this.source.pull.bind(this.pull.bind(this)));
    } else {
      this._endPulling();
    }
  }
}

export class PushOnlyObserver<A> implements Observer<A> {
  node: Node<Observer<A>> = new Node(this);
  constructor(public push: (a: A) => void, private source: Reactive<A>) {
    source.addListener(this.node);
    if (isBehavior(source)) {
      push(source.at());
    }
  }
  deactivate(): void {
    this.source.removeListener(this.node);
  }
  changeStateDown(state: State): void { }
}

/**
 * Observe a behavior for the purpose of running side-effects based on
 * the value of the behavior.
 * @param push Called with all values that the behavior pushes
 * through.
 * @param beginPulling Called when the consumer should begin pulling
 * values from the behavior.
 * @param endPulling Called when the consumer should stop pulling.
 * @param behavior The behavior to consume.
 */
export function observe<A>(
  push: (a: A) => void,
  beginPulling: (pull: () => void) => () => void,
  behavior: Behavior<A>
): CbObserver<A> {
  return behavior.observe(push, beginPulling);
}
