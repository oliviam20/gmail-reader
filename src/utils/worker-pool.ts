/* eslint-disable @typescript-eslint/no-explicit-any */
interface Options {
  /** Timeout in milliseconds, default is 0 milliseconds (no timeout) */
  timeout: number;
  /** Number of times to retry, default is 0 (no retries) */
  retries: number;
}

interface Task<T> {
  func: () => Promise<T>;
  options?: Options;
}

export class Deferred<T> {
  private task: Task<T>;
  promise: Promise<T>;
  resolve!: (result: T) => void;
  reject!: (error: any) => void;

  constructor(func: () => Promise<T>, options: Partial<Options> = {}) {
    this.task = {
      func,
      options: {
        timeout: 0,
        retries: 0,
        ...options,
      },
    };
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  async run(attempts: number = 0): Promise<void> {
    try {
      // handle timeouts
      if (this.task.options?.timeout) {
        let timeout: NodeJS.Timeout | undefined;
        let rejected = false;
        const cancelTimeout = () => {
          if (timeout) {
            clearTimeout(timeout);
            timeout = undefined;
          }
        };
        // eslint-disable-next-line no-async-promise-executor
        const result = await new Promise<T>(async (resolve, reject) => {
          timeout = setTimeout(() => {
            rejected = true;
            cancelTimeout();
            reject(new Error("Task timed out"));
          }, this.task.options?.timeout);

          try {
            const result = await this.task.func();
            if (!rejected) {
              resolve(result);
            }
          } catch (error) {
            reject(error);
          } finally {
            cancelTimeout();
          }
        });

        this.resolve(result);

        return;
      }

      const result = await this.task.func();
      this.resolve(result);
    } catch (error) {
      if (attempts < (this.task.options?.retries ?? 0)) {
        return this.run(attempts + 1);
      }
      this.reject(error);
    }
  }
}

export class WorkerPool {
  private readonly size: number;
  private tasks: Array<Deferred<any>> = [];
  private count = 0;
  private defaultOptions: Options;

  constructor(size: number, options: Partial<Options> = {}) {
    this.size = size;
    this.defaultOptions = {
      timeout: 0,
      retries: 0,
      ...options,
    };
  }

  execute<T>(func: () => Promise<T>, options: Partial<Options> = {}): Promise<T> {
    const deferred = new Deferred<T>(func, {
      ...this.defaultOptions,
      ...options,
    });

    this.tasks.push(deferred);

    this.next();

    return deferred.promise;
  }

  private next() {
    if (this.count < this.size) {
      const task = this.tasks.shift();

      if (task) {
        this.count++;
        task.run().finally(() => {
          this.count--;
          this.next();
        });
      }
    }
  }
}
