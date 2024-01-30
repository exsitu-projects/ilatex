import { Task, TaskError, TaskErrorHandler } from "./Task";

const defaultTaskErrorHandler = (error: TaskError) => {
    console.error("An error occured while running a task in a queuer:", error);
};

export class TaskQueuer {
    private queue: Task[];
    private isRunningTask: boolean;

    private taskErrorHandler: TaskErrorHandler;
    
    constructor(errorHandler?: TaskErrorHandler) {
        this.queue = [];
        this.isRunningTask = false;

        this.taskErrorHandler = errorHandler ?? defaultTaskErrorHandler;
    }

    add(...tasks: Task[]): void {
        this.queue.push(...tasks);

        if (!this.isRunningTask) {
            (async () => {
                await this.runAllTasks();
            })();
        }
    }

    clearNextTasks(): void {
        this.queue = [];
    }

    private async runAllTasks(): Promise<void> {
        // Immediately save a reference to nextTask to avoid the situation
        // where it exists during the test but not within the block
        // because an async operation called clearNextTasks()
        const nextTask = this.queue.shift();
        if (nextTask) {
            this.isRunningTask = true;

            try {
                await nextTask();
            }
            catch (error) {
                this.taskErrorHandler(error);
            }
            finally {
                await this.runAllTasks();
                this.isRunningTask = false;
            }
        }
    }
}