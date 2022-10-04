import {Queue} from './queue';
import {
   publicGetterDescriptor,
   publicReadonlyPropertyDescriptor,
   wrapWith,
   isWrappedWith
} from './common';


let invq = new Queue;
let blockedCells = new Map;   // cell -> blockedBy

// a ComputedCell that's currently being computed
let beingComputed = null;


function plainCell() {
   return function cell() {
      connectCells(beingComputed, cell);

      return cell.value;
   }
}


export function rigidCell(initialValue) {
   let cell = plainCell();

   Object.assign(cell, rigidCellProps);
   cell.value = initialValue;
   cell.revdeps = new Set;

   return cell;
}


let rigidCellProps = {
   invalidate() {
      for (let rdep of this.revdeps) {
         rdep.invalidate();
      }
   },

   set(value) {
      this.value = value;
      this.invalidate();
   },

   mutate(fnmut) {
      fnmut(this.value);
      this.invalidate();
   }
};


export function rigidGetter(getter) {
   let cell = plainCell();

   setCellGetter(cell, getter);
   cell.revdeps = new Set;

   return cell;
}


export function computableCell(computer) {
   let cell = plainCell();

   setCellInvalid(cell);
   cell.invalidate = invalidateThisCell;
   cell.computer = computer;
   cell.deps = new Set;
   cell.revdeps = new Set;

   invq.enqueue(cell);

   return cell;
}


function invalidateThisCell() {
   setCellInvalid(this);
   invq.enqueue(this);

   if (blockedCells.has(this)) {
      // When a blocked cell becomes a plain invalid cell, we don't transitively follow
      // its 'revdeps' because the cell's observable state is not changed.
      blockedCells.delete(this);
   }
   else {
      for (let rdep of this.revdeps) {
         rdep.invalidate();
      }
   }

   disconnectFromDeps(this);   
}


function setCellValue(cell, value) {
   Object.defineProperty(cell, 'value', publicReadonlyPropertyDescriptor(value));
}


function setCellGetter(cell, func) {
   Object.defineProperty(cell, 'value', publicGetterDescriptor(func));
}


function setCellInvalid(cell) {
   setCellGetter(cell, invalidValueGetter);
}


function invalidValueGetter() {
   throw new InvalidCell(this)
}


class InvalidCell extends Error {
   constructor(cell) {
      super();
      this.cell = cell;
   }
}


function connectCells(cell, dependency) {
   cell.deps.add(dependency);
   dependency.revdeps.add(cell);
}


function disconnectFromDeps(comp) {
   for (let dep of comp.deps) {
      dep.revdeps.delete(comp);
   }

   comp.deps.clear();
}


export function digest() {
   let ncycles = 0;

   while (!invq.isEmpty) {
      ncycles += 1;

      let cell = invq.dequeue();
      
      let value = null;
      let exc = null;
      let blockedBy = null;

      beingComputed = cell;

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

      if (blockedBy !== null) {
         blockedCells.set(cell, blockedBy);
         continue;
      }
      
      // So 'cell' is going to be made valid now. But some blocked cells may be depending on 'cell'
      // at this point. As 'cell' becomes now valid all these blocked cells should be invalidated.
      for (let rdep of cell.revdeps) {
         rdep.invalidate();
      }

      if (exc !== null) {
         setCellGetter(cell, () => { throw exc });
      }
      else if (isWrappedWith(getterTag, value)) {
         setCellGetter(cell, value[getterTag]);
      }
      else {
         setCellValue(cell, value);
      }
   }

   console.log("Digest cycles:", ncycles);

   // At this point, the invalid queue is exhausted. All the cells we have in
   // blockedCells are blocked because of circular dependencies.
   while (blockedCells.size > 0) {
      let cell, ncell;

      for ([cell, ncell] of blockedCells) {
         break;
      }

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
         setCellGetter(chain[i], circularGetter(dependencyCircle(chain, k, i)));
      }

      for (let cell of chain) {
         blockedCells.delete(cell);
      }
   }
}


const getterTag = Symbol('getter');


export function getter(func) {
   return wrapWith(getterTag, func);
}


function dependencyCircle(chain, k, i) {
   return [
      ...chain.slice(i, k),
      ...chain.slice(Math.max(i, k)),
      ...chain.slice(k, i)
   ];
}


class CircularDependency extends Error {
   constructor(circle) {
      super();
      this.circle = circle;
   }
}


function circularGetter(circle) {
   return () => {
      throw new CircularDependency(circle);
   }
}