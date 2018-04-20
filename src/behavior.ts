import { Cons, cons, Node } from "./linkedlist";
import { Monad, monad } from "@funkia/jabz";
import {
  Observer, State, Reactive, Time
} from "./common";
import { Future, BehaviorFuture } from "./future";
import * as F from "./future";
import { Stream } from "./stream";

/**
 * A behavior is a value that changes over time. Conceptually it can
 * be thought of as a function from time to a value. I.e. `type
 * Behavior<A> = (t: Time) => A`.
 */
export type SemanticBehavior<A> = (time: Time) => A;

@monad
export abstract class Behavior<A> extends Reactive<A> implements Observer<A>, Monad<A> {
  last: A;
  static is(a: any): a is Behavior<any> {
    return isBehavior(a);
  }
  map<B>(fn: (a: A) => B): Behavior<B> {
    return new MapBehavior<A, B>(this, fn);
  }
  mapTo<A>(v: A): Behavior<A> {
    return new ConstantBehavior(v);
  }
  static of<A>(v: A): Behavior<A> {
    return new ConstantBehavior(v);
  }
  of<A>(v: A): Behavior<A> {
    return new ConstantBehavior(v);
  }
  ap<B>(f: Behavior<(a: A) => B>): Behavior<B> {
    return new ApBehavior<A, B>(f, this);
  }
  lift<T1, R>(f: (t: T1) => R, m: Behavior<T1>): Behavior<R>;
  lift<T1, T2, R>(f: (t: T1, u: T2) => R, m1: Behavior<T1>, m2: Behavior<T2>): Behavior<R>;
  lift<T1, T2, T3, R>(f: (t1: T1, t2: T2, t3: T3) => R, m1: Behavior<T1>, m2: Behavior<T2>, m3: Behavior<T3>): Behavior<R>;
  lift(/* arguments */): any {
    // TODO: Experiment with faster specialized `lift` implementation
    const f = arguments[0];
    switch (arguments.length - 1) {
      case 1:
        return arguments[1].map(f);
      case 2:
        return arguments[2].ap(arguments[1].map((a: any) => (b: any) => f(a, b)));
      case 3:
        return arguments[3].ap(arguments[2].ap(arguments[1].map(
          (a: any) => (b: any) => (c: any) => f(a, b, c)
        )));
    }
  }
  static multi: boolean = true;
  multi: boolean = true;
  chain<B>(fn: (a: A) => Behavior<B>): Behavior<B> {
    return new ChainBehavior<A, B>(this, fn);
  }
  flatten: <B>() => Behavior<B>;
  at(n = Date.now()): A {
    if (this.state !== State.Push) {
      this.pull(n);
    }
    return this.last;
  }
  abstract refresh(...b: any[]): A;
  activate(): void {
    super.activate();
    if (this.state === State.Push) {
      this.update(0);
    }
  }
  update(n: number): boolean {
    const args = this.parents.map((p) => p.last)
    const newValue = this.refresh(...args);
    if (newValue !== this.last) {
      this.last = newValue;
      this.changedAt = n;
      return true;
    }
    return false;
  }
  push(n: number): void {
    if (this.state === State.Push) {
      const changed = this.update(n);
      this.pulledAt = n;
      if (changed) {
        for (const child of this.children) {
          child.push(n);
        }
      }
    }
  }
  pull(n: number): void {
    let shouldRefresh = false;
    for (const parent of this.parents) {
      if ((parent.state === State.Pull || parent.state === State.OnlyPull) && parent.pulledAt !== n) {
        parent.pull(n);
      }
      shouldRefresh = shouldRefresh || parent.changedAt > this.changedAt;      
    }
    if (shouldRefresh) {
      this.update(n);
    }
    this.pulledAt = n;
  }
  semantic(): SemanticBehavior<A> {
    throw new Error("The behavior does not have a semantic representation");
  }
  log(prefix?: string): Behavior<A> {
    this.subscribe(a => console.log(`${prefix || ""} `, a));
    return this;
  }
}

export function isBehavior(b: any): b is Behavior<any> {
  return typeof b === "object" && ("at" in b);
}

export abstract class ProducerBehavior<A> extends Behavior<A> {
  refresh(a: A): A {
    return a;
  }
  changePullers(n: number): void {
    this.nrOfPullers += n;
    if (this.nrOfPullers > 0 && this.state === State.Inactive) {
      this.state = State.Pull;
      this.activateProducer();
    } else if (this.nrOfPullers === 0 && this.state === State.Pull) {
      this.deactivateProducer();
    }
  }
  activate(): void {
    if (this.state === State.Inactive) {
      this.activateProducer();
    }
    this.state = State.Push;
  }
  deactivate(): void {
    if (this.nrOfPullers === 0) {
      this.state = State.Inactive;
      this.deactivateProducer();
    } else {
      this.state = State.Pull;
    }
  }
  abstract activateProducer(): void;
  abstract deactivateProducer(): void;
}

export type ProducerBehaviorFunction<A> = (push: (a: A) => void) => () => void;

class ProducerBehaviorFromFunction<A> extends ProducerBehavior<A> {
  constructor(private activateFn: ProducerBehaviorFunction<A>, private initial: A) {
    super();
    this.last = initial;
  }
  deactivateFn: () => void;
  activateProducer(): void {
    this.state = State.Push;
    this.deactivateFn = this.activateFn(this.push.bind(this));
  }
  deactivateProducer(): void {
    this.state = State.Inactive;
    this.deactivateFn();
  }
}

export function producerBehavior<A>(activate: ProducerBehaviorFunction<A>, initial: A): Behavior<A> {
  return new ProducerBehaviorFromFunction(activate, initial);
}

/**
 * Impure function that gets the current value of a behavior. For a
 * pure variant see `sample`.
 */
export function at<B>(b: Behavior<B>, n? :number): B {
  return b.at(n);
}

export class MapBehavior<A, B> extends Behavior<B> {
  constructor(private source: Behavior<any>, private f: (a: A) => B) {
    super();
    this.parents = [source];
  }
  refresh(a: A): B {
    return this.f(a);
  }
  semantic(): SemanticBehavior<B> {
    const g = this.source.semantic();
    return (t) => this.f(g(t));
  }
}

class ApBehavior<A, B> extends Behavior<B> {
  constructor(
    private fn: Behavior<(a: A) => B>,
    private val: Behavior<A>
  ) {
    super();
    this.parents = [fn, val];
  }
  refresh(fn, val): B {
    return fn(val);
  }
}

/**
 * Apply a function valued behavior to a value behavior.
 *
 * @param fnB behavior of functions from `A` to `B`
 * @param valB A behavior of `A`
 * @returns Behavior of the function in `fnB` applied to the value in `valB`
 */
export function ap<A, B>(fnB: Behavior<(a: A) => B>, valB: Behavior<A>): Behavior<B> {
  return valB.ap(fnB);
}

// class ChainOuter<A> extends Behavior<A> {
//   constructor(
//     public child: ChainBehavior<A, any>,
//     public parent: Behavior<A>
//   ) {
//     super();
//     this.parents = [parent];
//   }
//   push(n: number): void {
//     const a = this.parent.last;
//     if (a === this.last) {
//       return;
//     }
//     this.last = a;
//     this.child.pushOuter(a);
//   }
//   refresh(a: A): A {
//     return a;
//   }
//   pull(): boolean {
//     return this.parent.pull();
//   }
// }

class ChainBehavior<A, B> extends Behavior<B> {
  // The last behavior returned by the chain function
  private innerB: Behavior<B>;
  private innerNode = Node.of(this);
  private lastA;

  constructor(
    private outer: Behavior<A>,
    private fn: (a: A) => Behavior<B>
  ) {
    super();
    // Create the outer consumer
    // this.outerConsumer = new ChainOuter(this, outer);
    this.parents = [outer];
  }
  refresh(a) { 
    if (a !== this.lastA) {
      if (this.innerB !== undefined) {
        this.innerB.removeListener(this.innerNode);
      }
      this.lastA = a;
      this.innerB = this.fn(a);
      this.innerB.addListener(this.innerNode);
      if (this.state !== this.innerB.state) {
        console.log(this.innerB.constructor.name, this.state, this.innerB.state);        
        this.state = this.innerB.state;
        this.changeStateDown(this.state);
      }
      this.parents.splice(1, 1, this.innerB);
    }
    return this.innerB.last;
  }
}

// class ChainBehavior<A, B> extends Behavior<B> {
//   // The last behavior returned by the chain function
//   private innerB: Behavior<B>;
//   private innerNode: Node<any> = new Node(this);
//   private outerConsumer: Behavior<A>;
//   constructor(
//     private outer: Behavior<A>,
//     private fn: (a: A) => Behavior<B>
//   ) {
//     super();
//     // Create the outer consumer
//     this.outerConsumer = new ChainOuter(this, outer);
//     this.parents = cons(this.outerConsumer);
//   }
//   // pushOuter(a: A): void {
//   //   // The outer behavior has changed. This means that we will have to
//   //   // call our function, which will result in a new inner behavior.
//   //   // We therefore stop listening to the old inner behavior and begin
//   //   // listening to the new one.
//   //   if (this.innerB !== undefined) {
//   //     this.innerB.removeListener(this);
//   //   }
//   //   const newInner = this.innerB = this.fn(a);
//   //   newInner.addListener(this);
//   //   this.state = newInner.state;
//   //   this.changeStateDown(this.state);
//   //   if (this.state === State.Push) {
//   //     this.push(newInner.at());
//   //   }
//   // }
//   pushOuter(a: any): void {
//     const newInnerB = this.fn(a);
//     if (newInnerB === this.innerB) {
//       return;
//     }
//     if (this.innerB !== undefined) {
//       this.innerB.removeListener(this.innerNode);
//     }
//     this.innerB = newInnerB;
//     newInnerB.addListener(this.innerNode);
//     this.parents = cons(this.outerConsumer, <any> cons(this.innerB));
//     this.push(this.innerB.at());
//   }
//   refresh(a: B): B {
//     return a;
//   }
// }

// /** @private */
// class WhenBehavior extends Behavior<Future<{}>> {
//   constructor(private parent: Behavior<boolean>) {
//     super();
//     // this.push(at(parent));
//   }
//   refresh(val: boolean) {
    
//   }
//   // push(val: boolean): void {
//   //   if (val === true) {
//   //     this.last = Future.of({});
//   //   } else {
//       // this.last = new BehaviorFuture(this.parent);
//   //   }
//   // }
//   // pull(): Future<{}> {
//   //   return this.last;
//   // }
// }

// export function when(b: Behavior<boolean>): Behavior<Future<{}>> {
//   return new WhenBehavior(b);
// }

// // FIXME: This can probably be made less ugly.
// /** @private */
// class SnapshotBehavior<A> extends Behavior<Future<A>> {
//   private afterFuture: boolean;
//   constructor(private parent: Behavior<A>, future: Future<any>) {
//     super();
//     if (future.state === State.Done) {
//       // Future has occurred at some point in the past
//       this.afterFuture = true;
//       this.state = parent.state;
//       parent.addListener(this);
//       this.last = Future.of(at(parent));
//     } else {
//       this.afterFuture = false;
//       this.state = State.Push;
//       this.last = F.sinkFuture<A>();
//       future.addListener(this);
//     }
//   }
//   push(val: any): void {
//     if (this.afterFuture === false) {
//       // The push is coming from the Future, it has just occurred.
//       this.afterFuture = true;
//       this.last.resolve(at(this.parent));
//       this.parent.addListener(this);
//     } else {
//       // We are receiving an update from `parent` after `future` has
//       // occurred.
//       this.last = Future.of(val);
//     }
//   }
//   pull(): Future<A> {
//     return this.last;
//   }
// }

// export function snapshotAt<A>(
//   b: Behavior<A>, f: Future<any>
// ): Behavior<Future<A>> {
//   return new SnapshotBehavior(b, f);
// }

/** Behaviors that are always active */
export abstract class ActiveBehavior<A> extends Behavior<A> {
  // noop methods, behavior is always active
  activate(): void { }
  deactivate(): void { }
  changePullers(): void { }
}

export abstract class StatefulBehavior<A> extends ActiveBehavior<A> {
  constructor(protected a: any, protected b?: any, protected c?: any) {
    super();
    this.state = State.OnlyPull;
  }
}

export class ConstantBehavior<A> extends ActiveBehavior<A> {
  constructor(public last: A) {
    super();
    this.state = State.Push;
  }
  refresh(a: any): A {
    throw "Makes no sense to call refresh on this behavior";
  }
  semantic(): SemanticBehavior<A> {
    return (_) => this.last;
  }
  push(): void {
    throw "Makes no sense to call push on this behavior";
  }
  pull(): void {
    throw "Makes no sense to call pull on a constant behavior";    
  }
}

export class SinkBehavior<A> extends ActiveBehavior<A> {
  constructor(public last: A) {
    super();
    this.state = State.Push;
  }
  publish(value: A, n = Date.now()) {
    this.last = value;
    this.changedAt = n;
    this.pulledAt = n;
    for (const child of this.children) {
      child.push(n);
    }
  }
  refresh(a: A): A {
    return a;
  }
  pull() {
    throw "Makes no sense to call pull on a sink behavior";
  }
  push() {
    throw "Makes no sense to call push on a sink behavior";    
  }
}

/**
 * Creates a behavior for imperative pushing.
 */
export function sinkBehavior<A>(initial: A): SinkBehavior<A> {
  return new SinkBehavior<A>(initial);
}

/** @private */
export class FunctionBehavior<A> extends ActiveBehavior<A> {
  state = State.OnlyPull;
  parents = [];
  constructor(private fn: () => A) {
    super();
  }
  refresh(a: any): A {
    return this.fn();
  }
  pull(n: number) {
    this.update(n);
    this.pulledAt = n;
  }
  push(a: any): void {
    throw "Makes no sense to call push on this behavior";
  }
}

export function fromFunction<B>(fn: () => B): Behavior<B> {
  return new FunctionBehavior(fn);
}

// /** @private */
// class SwitcherBehavior<A> extends ActiveBehavior<A> {
//   constructor(
//     private b: Behavior<A>,
//     next: Future<Behavior<A>> | Stream<Behavior<A>>
//   ) {
//     super();
//     b.addListener(this);
//     this.state = b.state;
//     if (this.state === State.Push) {
//       this.last = at(b);
//     }
//     // FIXME: Using `bind` is hardly optimal for performance.
//     next.subscribe(this.doSwitch.bind(this));
//   }
//   push(val: A): void {
//     this.last = val;
//     if (this.child !== undefined) {
//       this.child.push(val);
//     }
//   }
//   pull(): A {
//     return at(this.b);
//   }
//   private doSwitch(newB: Behavior<A>): void {
//     this.b.removeListener(this);
//     this.b = newB;
//     newB.addListener(this);
//     const newState = newB.state;
//     if (newState === State.Push) {
//       this.push(newB.at());
//     }
//     this.state = newState;
//     if (this.child !== undefined) {
//       this.child.changeStateDown(this.state);
//     }
//   }
// }

// /**
//  * From an initial behavior and a future of a behavior, `switcher`
//  * creates a new behavior that acts exactly like `initial` until
//  * `next` occurs, after which it acts like the behavior it contains.
//  */
// export function switchTo<A>(
//   init: Behavior<A>,
//   next: Future<Behavior<A>>
// ): Behavior<A> {
//   return new SwitcherBehavior(init, next);
// }

// export function switcher<A>(
//   init: Behavior<A>, stream: Stream<Behavior<A>>
// ): Behavior<Behavior<A>> {
//   return fromFunction(() => new SwitcherBehavior(init, stream));
// }

// class TestBehavior<A> extends Behavior<A> {
//   constructor(private semanticBehavior: SemanticBehavior<A>) {
//     super();
//   }
//   semantic(): SemanticBehavior<A> {
//     return this.semanticBehavior;
//   }
// }

// export function testBehavior<A>(b: SemanticBehavior<A>): Behavior<A> {
//   return new TestBehavior(b);
// }

// /** @private */
// class ActiveScanBehavior<A, B> extends ActiveBehavior<B> {
//   constructor(
//     private f: (a: A, b: B) => B, public last: B, private parent: Stream<A>
//   ) {
//     super();
//     this.state = State.Push;
//     parent.addListener(this);
//   }
//   push(val: A): void {
//     this.last = this.f(val, this.last);
//     if (this.child) {
//       this.child.push(this.last);
//     }
//   }
// }

// class ScanBehavior<A, B> extends StatefulBehavior<Behavior<B>> {
//   pull(): Behavior<B> {
//     return new ActiveScanBehavior(this.a, this.b, this.c);
//   }
//   semantic(): SemanticBehavior<Behavior<B>> {
//     const stream = this.c.semantic();
//     return (t1) => testBehavior<B>((t2) =>
//       stream
//         .filter(({ time }) => t1 <= time && time <= t2)
//         .map((o) => o.value)
//         .reduce((acc, cur) => this.a(cur, acc), this.b)
//     );
//   }
// }

// export function scan<A, B>(
//   f: (a: A, b: B) => B, initial: B, source: Stream<A>
// ): Behavior<Behavior<B>> {
//   return new ScanBehavior<A, B>(f, initial, source);
// }

// class IndexReactive<A> extends Reactive<A> {
//   constructor(
//     private index: number,
//     parent: Reactive<A>
//   ) {
//     super();
//     this.parents = cons(parent);
//   }
//   push(a: A): void {
//     (<any>this.child).pushIdx(a, this.index);
//   }
// }

// class ActiveScanCombineBehavior<A> extends ActiveBehavior<A> {
//   private accumulators: ((a: any, b: A) => A)[];
//   constructor(streams: ScanPair<A>[], public last: A) {
//     super();
//     this.state = State.Push;
//     this.accumulators = [];
//     for (let i = 0; i < streams.length; ++i) {
//       const [s, f] = streams[i];
//       this.accumulators.push(f);
//       const indexReactive = new IndexReactive(i, s);
//       indexReactive.addListener(this);
//       this.parents = cons(indexReactive, this.parents);
//     }
//   }
//   pushIdx(a: A, index: number): void {
//     this.last = this.accumulators[index](a, this.last);
//     if (this.child) {
//       this.child.push(this.last);
//     }
//   }
// }

// class ScanCombineBehavior<B> extends StatefulBehavior<Behavior<B>> {
//   pull(): Behavior<B> {
//     return new ActiveScanCombineBehavior(this.a, this.b);
//   }
// }

// export type ScanPair<A> = [Stream<any>, (a: any, b: A) => A];

// export function scanCombine<B>(
//   pairs: ScanPair<B>[], initial: B
// ): Behavior<Behavior<B>> {
//   return new ScanCombineBehavior<B>(pairs, initial);
// }

// const firstArg = (a, b) => a;

// /**
//  * Creates a Behavior whose value is the last occurrence in the stream.
//  * @param initial - the initial value that the behavior has
//  * @param steps - the stream that will change the value of the behavior
//  */
// export function stepper<B>(initial: B, steps: Stream<B>): Behavior<Behavior<B>> {
//   return scan(firstArg, initial, steps);
// }

// /**
//  *
//  * @param initial the initial value
//  * @param turnOn the streams that turn the behavior on
//  * @param turnOff the streams that turn the behavior off
//  */
// export function toggle(
//   initial: boolean, turnOn: Stream<any>, turnOff: Stream<any>
// ): Behavior<Behavior<boolean>> {
//   return stepper(initial, turnOn.mapTo(true).combine(turnOff.mapTo(false)));
// }

// export type SampleAt = <B>(b: Behavior<B>) => B;

// class MomentBehavior<A> extends Behavior<A> {
//   private sampleBound: SampleAt;
//   constructor(private f: (at: SampleAt) => A) {
//     super();
//     this.sampleBound = (b) => this.sample(b);
//   }
//   activate(): void {
//     try {
//       this.last = this.f(this.sampleBound);
//       this.state = State.Push;
//     } catch (error) {
//       if ("placeholder" in error) {
//         const placeholder = error.placeholder;
//         removeListenerParents(this, this.parents);
//         placeholder.addListener(this);
//         this.parents = cons(placeholder);
//       } else {
//         throw error;
//       }
//     }
//   }
//   push(): void {
//     removeListenerParents(this, this.parents);
//     this.parents = undefined;
//     this.child.push(this.last = this.f(this.sampleBound));
//   }
//   sample<B>(b: Behavior<B>): B {
//     b.addListener(this);
//     this.parents = cons(b, this.parents);
//     return b.at();
//   }
// }

// export function moment<A>(f: (sample: SampleAt) => A): Behavior<A> {
//   return new MomentBehavior(f);
// }
