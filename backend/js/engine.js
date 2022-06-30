import {Queue} from './queue';


let invq = new Queue;
let blockedCells = new Map;   // cell -> blockedBy
// either a Cell or Stage object that's currently being computed
let beingComputed = null;


export function rigidCell(value) {
   let cell = () => {
      connectCells(beingComputed, cell);

      return cell.val;
   };

   cell.val = value;
   cell.revdeps = new Set;

   Object.assign(cell, rigidCellProps);

   return cell;
}


const rigidCellProps = {
   setValue(value) {
      this.val = value;
      this.invalidate();
   },

   invalidate() {
      for (let rdep of this.revdeps) {
         rdep.invalidate();
      }
   },

   mutate(callback) {
      callback(this.val);
      this.invalidate();
   }
};


rigidCell.exc = function (exc) {
   let cell = () => {
      connectCells(beingComputed, cell);

      throw cell.exc;
   };

   cell.exc = exc;
   cell.revdeps = new Set;

   return cell;
}


export function computableCell(computer) {
   let cell = () => {
      connectCells(beingComputed, cell);

      return cell.val.get(cell);
   };

   cell.invalidate = invalidateCell;
   cell.val = invalidValue;
   cell.stage = null;
   cell.computer = computer;
   cell.revdeps = new Set;
   cell.deps = new Set;

   invq.enqueue(cell);

   return cell;
}


function invalidateCell() {
   invalidateCellValue(this);

   if (this.stage !== null) {
      killStage(this.stage);
      this.stage = null;
   }

   disconnectFromDeps(this);   
}


class Stage {
   constructor(cell, prev, computer) {
      this.cell = cell;
      this.prev = prev;
      this.next = null;
      this.computer = computer;
      this.deps = new Set;
   }

   invalidate() {
      invalidateCellValue(this.cell);

      if (this.next !== null) {
         killStage(this.next);

         this.next = null;
         this.cell.stage = this;
      }

      disconnectFromDeps(this);
   }
}


function killStage(stage) {
   if (stage.next !== null) {
      killStage(stage.next);
   }

   stage.prev = null;
   stage.next = null;

   disconnectFromDeps(stage);
}


function invalidateCellValue(cell) {
   if (!cell.val.isValid) {
      return;
   }

   cell.val = invalidValue;
   invq.enqueue(cell);

   if (blockedCells.has(cell)) {
      // When a blocked invalid cell becomes a plain invalid cell, we don't transitively
      // follow its 'revdeps' because the cell's actual state is not changed.
      blockedCells.delete(cell);
   }
   else {
      for (let rdep of cell.revdeps) {
         rdep.invalidate();
      }
   }
}


function disconnectFromDeps(comp) {
   for (let dep of comp.deps) {
      dep.revdeps.delete(comp);
   }

   comp.deps.clear();
}


function connectCells(cell, dependency) {
   cell.deps.add(dependency);
   dependency.revdeps.add(cell);
}


export function digest() {
   let ncycles = 0;

   while (!invq.isEmpty) {
      ncycles += 1;

      let cell = invq.dequeue();
      
      let value = null;
      let exc = null;
      let blockedBy = null;

      beingComputed = cell.stage ?? cell;

      try {
         value = beingComputed.computer.call(null);
      }
      catch (e) {
         if (e instanceof InvalidCell) {
            blockedBy = e.cell;
         }
         else {
            exc = e;
         }
      }
      finally {
         beingComputed = null;
      }

      // The following 2 cases do not make 'cell' valid.
      if (blockedBy !== null) {
         blockedCells.set(cell, blockedBy);
         cell.val = blockedValue;
         continue;
      }
      
      if (value instanceof Restart) {
         appendNewStage(cell, value.computer);
         invq.enqueueFirst(cell);
         continue;
      }

      // So 'cell' is going to be made valid now. But a blocked cell may depend on(at most
      // 1) invalidated cell. When the latter becomes valid, those blocked cells should
      // be made invalidated again.
      for (let rdep of cell.revdeps) {
         rdep.invalidate();
      }

      if (exc !== null) {
         cell.val = exceptionValue(exc);
      }
      else if (value instanceof Getter) {
         cell.val = getterValue(value.getter);
      }
      else {
         cell.val = plainValue(value);
      }
   }

   console.log("Digest cycles:", ncycles);

   // At this point, the invalid queue is exhausted. All the cells we have in
   // blockedCells are blocked because of circular dependencies.
   while (blockedCells.size > 0) {
      let {value: [cell, ncell]} = blockedCells[Symbol.iterator]().next();
      let chain = [cell];
      let k = -1;

      for (;;) {
         k = chain.indexOf(ncell);

         if (k !== -1) {
            break;
         }

         chain.push(ncell);
         [cell, ncell] = [ncell, blockedCells.get(ncell)];
      }

      for (let i = 0; i < chain.length; i += 1) {
         chain[i].val = circularValue(dependencyCircle(chain, k, i));
      }

      for (let cell of chain) {
         blockedCells.delete(cell);
      }
   }
}


function appendNewStage(cell, computer) {
   let newStage = new Stage(cell, cell.stage, computer);

   if (cell.stage !== null) {
      cell.stage.next = newStage;
      newStage.prev = cell.stage;
   }

   cell.stage = newStage;
}


function dependencyCircle(chain, k, i) {
   return [
      ...chain.slice(i, k),
      ...chain.slice(Math.max(i, k)),
      ...chain.slice(k, i)
   ];
}


const invalidValue = {
   isValid: false,
   get(cell) {
      throw new InvalidCell(cell);
   }
};


const blockedValue = {
   // blocked cell is considered valid for the purpose of invalidation algorithm, but it
   // throws InvalidCell in exactly the same way as an ordinary invalidated cell.
   isValid: true,
   get(cell) {
      throw new InvalidCell(cell);
   }
};


const protoExceptionValue = {
   isValid: true,
   get(cell) {
      throw this.exc;
   },
   descriptor() {
      return {
         get: () => {
            throw this.exc;
         }
      }
   }
};


function exceptionValue(exc) {
   return {
      __proto__: protoExceptionValue,
      exc
   }
}


const protoPlainValue = {
   isValid: true,
   get(cell) {
      return this.value;
   },
   descriptor() {
      return {
         value: this.value,
         writable: true
      }
   }
};


function plainValue(value) {
   return {
      __proto__: protoPlainValue,
      value
   }
}


function getterValue(getter) {
   return {
      isValid: true,
      get(cell) {
         return getter();
      },
      descriptor() {
         return {
            get: getter
         }
      }
   }
}


const protoCircularValue = {
   isValid: true,
   get(cell) {
      throw new CircularDependency(this.circle);
   },
   descriptor() {
      let circle = this.circle;

      return {
         get() {
            throw new CircularDependency(circle);
         }
      }
   }
};


function circularValue(circle) {
   return {
      __proto__: protoCircularValue,
      circle
   }
}


class InvalidCell extends Error {
   constructor(cell) {
      super();
      this.cell = cell;
   }
}


class CircularDependency extends Error {
   constructor(circle) {
      super();
      this.circle = circle;
   }
}


class Getter {
   constructor(func) {
      this.getter = func;
   }
}


export function getter(func) {
   return new Getter(func);
}


class Restart {
   constructor(func) {
      this.computer = func;
   }
}


export function restart(func) {
   return new Restart(func);
}
