export {
   dependOn, addEffect, clearDeps, undoEffects, dismantle, unmountNodeSet, mountingContextFor
};


function dependOn(dep) {
   this.deps.add(dep);
   dep.useBy(this);
}


function addEffect(effect) {
   this.effects.push(effect);
}


function clearDeps(node) {
   for (let dep of node.deps) {
      dep.unuseBy(node);
   }
   node.deps.clear();
}


function undoEffects(node, reversibly) {
   for (let effect of node.effects) {
      effect.undo(reversibly);
   }

   node.effects.length = 0;
}


function dismantle(node, reversibly) {
   clearDeps(node);
   undoEffects(node, reversibly);
}


function mountingContextFor(node) {
   return {
      executor: node,
      originator: node,
   }
}


function isClean(node) {
   return node.deps.size === 0 && node.effects.length === 0;
}


function unmountNodeSet(nodeSet) {
   if (nodeSet.size === 0) {
      return;
   }

   for (let node of nodeSet) {
      node.unmount();
   }

   nodeSet.clear();
}
