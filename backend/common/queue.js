export class Queue {
   constructor() {
      this.front = [];
      this.rear = [];
   }

   enqueue(item) {
      this.rear.push(item);
   }

   enqueueAll(items) {
      for (let item of items) {
         this.enqueue(item);
      }
   }

   dequeue() {
      if (this.front.length === 0) {
         stackRepump(this.rear, this.front);
      }

      return this.front.pop();
   }

   get isEmpty() {
      return this.front.length === 0 && this.rear.length === 0;
   }
}


function stackRepump(from, to) {
   while (from.length > 0) {
      to.push(from.pop());
   }
}
