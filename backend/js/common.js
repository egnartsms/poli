export function defineProperty(obj, prop, descriptor) {
   Object.defineProperty(obj, prop, publicDescriptor(descriptor))
}


export function publicDescriptor(descriptor) {
   return {
      enumerable: true,
      configurable: true,
      ...descriptor
   }
}


export function publicGetterDescriptor(fn) {
   return {
      enumerable: true,
      configurable: true,
      get: fn
   }
}


export function publicReadonlyPropertyDescriptor(value) {
   return {
      enumerable: true,
      configurable: true,
      writable: false,
      value: value
   }
}


export function defineGetter(obj, prop, func) {
   defineProperty(obj, prop, {get: func});
}


export function defineReadonly(obj, prop, value) {
   defineProperty(obj, prop, {value: value});
}


export function wrapWith(tag, value) {
   return {
      [tag]: value
   }
}


export function isWrappedWith(tag, value) {
   return value != null && Object.hasOwn(value, tag)
}
