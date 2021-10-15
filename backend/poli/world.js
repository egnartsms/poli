common
   objId
   equal
   concat
   lessThan
   objLessThan
trie
   * as: trie
   KeyedSet
   Map
vector
   Vector
-----
spec ::= () => ({
   relations: {
      'module': {
         boxes: true
      },
      'entry': {
         boxes: true
      },
      'import': {
         boxes: false
      },
      'entry-ref-entry': {
         boxes: false
      },
      'entry-ref-imported': {
         boxes: false
      }
   },

   groups: {
      'module.name': {
         relation: 'module',
         reduce: $.indexBoxesBy({
            entityKey: module => module.name,
            less: $.lessThan
         })
      },

      'module.entries': {
         relation: 'entry',
         group: {
            entityKey: entry => entry.module,
            less: $.objLessThan,
         },
         reduce: $.indexBoxesBy({
            entityKey: entry => entry.name,
            less: $.lessThan,
            filter: name => name !== null  // don't include the starEntry here
         })
      },

      'entry.imports': {
         relation: 'import',
         group: {
            entityKey: imp => imp.entry,
            less: $.objLessThan,
         },
         reduce: $.indexEntitiesBy({
            entityKey: imp => imp.recp,
            less: $.objLessThan
         })
      },

      'module.imports': {
         relation: 'import',
         group: {
            entityKey: imp => imp.recp,
            less: $.objLessThan,
         },
         reduce: $.indexEntitiesBy({
            entityKey: imp => imp.as,
            less: $.lessThan
         })
      },

      'entry.uses-imports': {
         relation: 'entry-ref-imported',
         group: {
            entityKey: ref => ref.entry,
            less: $.objLessThan
         },
         reduce: $.entitySet({
            map: ref => ref.import,
            less: $.objLessThan
         })
      },

      'entry.uses': {
         relation: 'entry-ref-entry',
         group: {
            entityKey: ref => ref.entry,
            less: $.objLessThan
         },
         reduce: $.entitySet({
            map: ref => ref.references,
            less: $.objLessThan
         })
      },

      'entry.used-by': {
         relation: 'entry-ref-entry',
         group: {
            entityKey: ref => ref.references,
            less: $.objLessThan
         },
         reduce: $.entitySet({
            map: ref => ref.entry,
            less: $.objLessThan
         })
      }
   }
})
rel2groups ::= ({})
groups ::= ({})
delta ::= ({
   'module': {
      changed: new Set
   },
   'entry': {
      changed: new Set
   },
   'import': {
      added: new Set,
      removed: new Set,
      get affected() {
         return $.concat(this.added, this.removed);
      }
   },
   'entry-ref-entry': {

   }
})
initialize ::= function () {
   $.spec = $.spec();

   for (let [groupName, {relation, group, reduce}] of Object.entries($.spec.groups)) {
      /*
         rel2groups: {
            'entry': ['module.entries', ...]
         }
      */
      if ($.rel2groups[relation] === undefined) {
         $.rel2groups[relation] = [];
      }
      $.rel2groups[relation].push(groupName);

      if ($.groups[groupName] !== undefined) {
         throw new Error(`Group name duplicated: '${groupName}'`);
      }

      if (group !== undefined) {
         $.groups[groupName] = $.makeBox($.Map(group.less));
      }
      else {
         $.groups[groupName] = $.makeBox(reduce.initial);
      }
   }
}
indexBoxesBy ::= function ({entityKey, less, filter=null}) {
   return {
      initial: $.Map(less),
      entityKey: entityKey,
      entityKeysEqual: (k1, k2) => !less(k1, k2) && !less(k2, k1),
      add: function (Box, key, box) {
         if (filter === null || filter(key)) {
            $.ensureBoxOwnMap(Box);
            $.trie.setNewAt(Box.v, key, box);
         }
      },
      remove: function (Box, key) {
         if (filter === null || filter(key)) {
            $.ensureBoxOwnMap(Box);
            $.trie.removeExistingAt(Box.v, key);
         }
      }
   }
}
indexEntitiesBy ::= function ({entityKey, less}) {
   return {
      initial: $.KeyedSet(entityKey, less),
      add: function (Box, entity) {
         $.ensureBoxOwnMap(Box);
         $.trie.addNew(Box.v, entity);
      },
      remove: function (Box, entity) {
         $.ensureBoxOwnMap(Box);
         $.trie.removeExisting(Box.v, entity);
      }
   }
}
RboxForGroupKey ::= function (Gbox, gkey, reduce) {
   let Rbox = $.trie.atOr(Gbox.v, gkey);

   if (Rbox === undefined) {
      Rbox = $.makeBox(reduce.initial)
      $.ensureBoxOwnMap(Gbox);
      $.trie.setAt(Gbox.v, gkey, Rbox);
   }

   return Rbox;
}
addEntity ::= function (relation, entity) {
   for (let groupName of $.rel2groups[relation]) {
      let {group, reduce} = $.spec.groups[groupName];

      if (group === undefined) {
         let Rbox = $.groups[groupName];
         reduce.add(Rbox, entity);
      }
      else {
         let Gbox = $.groups[groupName];
         let gkey = group.entityKey(entity);
         
         if (reduce === undefined) {
            $.ensureBoxOwnMap(Gbox);
            $.trie.setNewAt(Gbox.v, gkey, entity);
         }
         else {
            let Rbox = $.RboxForGroupKey(Gbox, gkey, reduce);
            reduce.add(Rbox, entity);
         }
      }
   }

   $.delta[relation].added.add(entity);
}
removeEntity ::= function (relation, entity) {
   for (let groupName of $.rel2groups[relation]) {
      let {group, reduce} = $.spec.groups[groupName];

      if (group === undefined) {
         let Rbox = $.groups[groupName];
         reduce.remove(Rbox, entity);
      }
      else {
         let Gbox = $.groups[groupName];
         let gkey = group.entityKey(entity);
         
         if (reduce === undefined) {
            $.ensureBoxOwnMap(Gbox);
            $.trie.removeExistingAt(Gbox.v, gkey);
         }
         else {
            let Rbox = $.trie.at(Gbox.v, gkey);
            reduce.remove(Rbox, entity);
         }
      }
   }

   $.delta[relation].removed.add(entity);
}
addEntityBox ::= function (box) {
   for (let groupName of $.rel2groups[box.relation]) {
      let {group, reduce} = $.spec.groups[groupName];

      if (group === undefined) {
         let Rbox = $.groups[groupName];
         reduce.add(Rbox, reduce.entityKey(box.v), box);
      }
      else {
         let Gbox = $.groups[groupName];
         let gkey = group.entityKey(box.v);
         
         if (reduce === undefined) {
            $.ensureBoxOwnMap(Gbox);
            $.trie.setNewAt(Gbox.v, gkey, box);
         }
         else {
            let Rbox = $.RboxForGroupKey(Gbox, gkey, reduce);
            reduce.add(Rbox, reduce.entityKey(box.v), box);
         }
      }
   }
}
removeEntityBox ::= function (box) {
   for (let groupName of $.rel2groups[box.relation]) {
      let {group, reduce} = $.spec.groups[groupName];

      if (group === undefined) {
         let Rbox = $.groups[groupName];
         reduce.remove(Rbox, reduce.entityKey(box.v));
      }
      else {
         let Gbox = $.groups[groupName];
         let gkey = group.entityKey(box.v);
         
         if (reduce === undefined) {
            $.ensureBoxOwnMap(Gbox);
            $.trie.removeExistingAt(Gbox.v, gkey);
         }
         else {
            let Rbox = $.trie.at(Gbox.v, gkey);
            reduce.remove(Rbox, reduce.entityKey(box.v));
         }
      }
   }
}
entityGroupFor ::= function (groupName, gkey) {
   let {reduce} = $.spec.groups[groupName];

   return $.RboxForGroupKey($.groups[groupName], gkey, reduce);
}
removeEntityGroupFor ::= function (groupName, key) {
   let Gbox = $.groups[groupName];

   if ($.trie.hasAt(Gbox.v, key)) {
      $.ensureBoxOwnMap(Gbox);
      $.trie.removeAt(Gbox.v, key);
   }
}
changedBoxes ::= new Set
isBoxChanged ::= function (box) {
   return $.changedBoxes.has(box);
}
markBoxChanged ::= function (box) {
   $.changedBoxes.add(box);
}
makeBox ::= function (value=null) {
   return {
      ov: value,
      v: value,
   }
}
makeEntityBox ::= function (relation, entity) {
   return {
      relation: relation,
      ov: entity,
      v: entity,
   }
}
setBox ::= function (box, v) {
   if (box.relation === undefined) {
      box.v = v;
      $.markBoxChanged(box);
      return;
   }

   function maybeReaddToRbox(Rbox, reduce) {
      let oldKey = reduce.entityKey(box.v);
      let newKey = reduce.entityKey(v);

      if (!reduce.entityKeysEqual(oldKey, newKey)) {
         reduce.remove(Rbox, oldKey);
         reduce.add(Rbox, newKey, box);
      }
   }

   for (let groupName of $.rel2groups[box.relation]) {
      let {group, reduce} = $.spec.groups[groupName];

      if (group === undefined) {
         let Rbox = $.groups[groupName]
         maybeReaddToRbox(Rbox, reduce);
      }
      else {
         let Gbox = $.groups[groupName];
         let oldGkey = group.entityKey(box.v);
         let newGkey = group.entityKey(v);

         if ($.trie.keysEqual(oldGkey, newGkey, Gbox.v)) {
            if (reduce === undefined)
               // Do nothing: box stays at the same index in Gbox.v map
               ;
            else {
               // Box stays within the same Rbox
               let Rbox = $.trie.at(Gbox.v, oldGkey);
               maybeReaddToRbox(Rbox, reduce);
            }
         }
         else  {
            // Box moves to a different bucket in the group
            if (reduce === undefined) {
               $.ensureBoxOwnMap(Gbox);
               $.trie.removeExistingAt(Gbox.v, oldGkey);
               $.trie.setNewAt(Gbox.v, newGkey, box);
            }
            else {
               let oldRbox = $.trie.at(Gbox.v, oldGkey);
               let newRbox = $.RboxForGroupKey(Gbox, newGkey, reduce);

               reduce.remove(oldRbox, reduce.entityKey(box.v));
               reduce.add(newRbox, reduce.entityKey(v), box);
            }
         }
      }
   }

   $.delta[box.relation].changed.add(box);

   box.v = v;
   $.markBoxChanged(box);
}
patchBox ::= function (box, patch) {
   $.setBox(box, {...box.v, ...patch});
}
updateBox ::= function (box, fn, ...args) {
   $.setBox(box, fn(box.v, ...args));
}
ensureBoxOwnMap ::= function (box) {
   if (!$.isBoxChanged(box)) {
      box.v = $.trie.copy(box.v);
      $.markBoxChanged(box);
   }
}
commit ::= function () {
   for (let box of $.changedBoxes) {
      box.ov = box.v;
   }

   $.changedBoxes.clear();
   $.clearDelta();
}
rollback ::= function () {
   for (let box of $.changedBoxes) {
      box.v = box.ov;
   }

   $.changedBoxes.clear();
   $.clearDelta();
}
clearDelta ::= function () {
   for (let {added, removed, changed} of Object.values($.delta)) {
      if (added !== undefined) {
         added.clear();
      }
      if (removed !== undefined) {
         removed.clear();
      }
      if (changed !== undefined) {
         changed.clear();
      }
   }
}
nextModuleId ::= 1
load ::= function (minfos) {
   $.initialize();

   for (let minfo of minfos) {
      // minfo :: [{name, lang, imports, body, ns}]
      let module = $.makeEntityBox('module', {
         name: minfo.name,
         lang: minfo.lang,
         ns: minfo.ns,
         nsDelta: null,
         members: null
      });
      $.addEntityBox(module);

      module.starEntry = $.makeEntityBox('entry', {
         name: null,
         module: module
      });
      module.starEntry.imports = $.entityGroupFor('entry.imports', module.starEntry);
      $.addEntityBox(module.starEntry);

      if (minfo.lang !== 'js') {
         Object.assign(module, {
            entries: null,
            imports: $.entityGroupFor('module.imports', module),
         });
         continue;
      }

      let entries = Array.from(minfo.body, ([name, code]) => {
         code = code.trim();
         let entry = $.makeEntityBox('entry', {
            name: name,
            strDef: code,
            def: code,
            module: module
         });
         entry.imports = $.entityGroupFor('entry.imports', entry);
         return entry;
      });

      module.v.members = $.Vector(entries);
      Object.assign(module, {
         entries: $.entityGroupFor('module.entries', module),
         imports: $.entityGroupFor('module.imports', module)
      });

      for (let entry of entries) {
         $.addEntityBox(entry);
      }
   }

   for (let {name: recpName, imports} of minfos) {
      let recp = $.trie.at($.groups['module.name'].v, recpName);
      
      for (let {donor: donorName, asterisk, imports: entryImports} of imports) {
         let donor = $.trie.at($.groups['module.name'].v, donorName);
         
         if (asterisk !== null) {
            $.addEntity('import', {
               entry: donor.starEntry,
               recp: recp,
               alias: asterisk,
               as: asterisk
            });
         }

         for (let {entry, alias} of entryImports) {
            let entryBox = $.trie.at(donor.entries.v, entry);
            $.addEntity('import', {
               entry: entryBox,
               recp: recp,
               alias: alias,
               as: alias || entryBox.v.name
            });
         }
      }
   }

   $.commit();
}
