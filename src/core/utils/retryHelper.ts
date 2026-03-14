export async function retryOperation(fn: Function, retries = 3) {

 for (let i = 0; i < retries; i++) {

   try {
     return await fn();
   } catch (error) {

     if (i === retries - 1) {
       throw error;
     }

   }

 }

}