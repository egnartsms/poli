/**
 * Reactive engine.
 * 
 * Key concepts we operate with:
 *   - entity (can have reactive attributes, rvattrs)
 *   - reactive attribute on an entity
 *   - action (what should be computed and re-computed when deps change)
 *   - node
 *   - reactive set (RvSet)
 *   - referral (rvset.forEach(...))
 * 
 * The Reactive engine itself cannot be managed by the self-hosted Poli system
 * because the reactive engine underlies Poli at a lower level. This means that
 * while Poli is self-hosted and can be interactively operated from under
 * itself, the reactive system cannot be interactively operated in the same
 * way. If you change smth in the Reactive subsystem, you have to fully reload
 * Poli.
 * 
 * This relationship is the same as the relationship between a Smalltalk VM and
 * Smalltalk runtime. Yes this is true that Smalltalk own source code can be
 * tweaked inside the Smalltalk image itself, but if you want to change smth in
 * the virtual machine, you got to re-build it and re-run the Smalltalk.
 */

export { entity } from './entity.js';
export { procedure, runToFixpoint } from './node.js';
export { externalEventHandler } from './event-listener.js';
