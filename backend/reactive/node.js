export function dependOn(dep) {
   this.deps.add(dep);
   dep.useBy(this);
}


export function addEffect(effect) {
   this.effects.push(effect);
}


export function clearDeps(node) {
   for (let dep of node.deps) {
      dep.unuseBy(node);
   }
   node.deps.clear();
}


export function undoEffects(node, reversibly) {
   for (let effect of node.effects) {
      effect.undo(reversibly);
   }

   node.effects.length = 0;
}


export function dismantle(node, reversibly) {
   clearDeps(node);
   undoEffects(node, reversibly);
}


export function mountingContextFor(node) {
   return {
      executor: node,
      originator: node,
   }
}


function isClean(node) {
   return node.deps.size === 0 && node.effects.length === 0;
}


export function unmountNodeSet(nodeSet) {
   if (nodeSet.size === 0) {
      return;
   }

   for (let node of nodeSet) {
      node.unmount();
   }

   nodeSet.clear();
}


let nextNodeId = 1;


export function getNextId() {
   return nextNodeId++;
}
