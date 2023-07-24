export {Filterer};

import {KeyReducer} from './key-reducer.js';


function Filterer(rset, predicate) {
  KeyReducer.call(this, {
    rset,
    initial: new Set,
    valueOf: predicate,
    reduce(set, key, isSelected) {
      if (isSelected) {
        set.add(key);
      }
    },
    unreduce(set, key, isSelected) {
      if (isSelected) {
        set.delete(key);
      }
    }
  });
}


Filterer.prototype = KeyReducer.prototype;
