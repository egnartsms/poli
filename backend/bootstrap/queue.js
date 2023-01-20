export class Queue {
   constructor() {
      this.front = [];
      this.rear = [];
   }

   enqueue(item) {
      this.rear.push(item);
   }

   enqueueFirst(item) {
      this.front.push(item);
   }

   dequeue() {
      if (this.front.length === 0) {
         rearToFront(this);
      }

      return this.front.pop();
   }

   get isEmpty() {
      return this.front.length === 0 && this.rear.length === 0;
   }
}


function rearToFront(queue) {
   while (queue.rear.length > 0) {
      queue.front.push(queue.rear.pop());
   }
}
