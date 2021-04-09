import { Task, TaskError, TaskErrorHandler } from "./Task";

const defaultTaskErrorHandler = (error: TaskError) => {
    console.error("An error occured while running a task in a debouncer:", error);
};

export class TaskDebouncer {
    private nextTask: Task | null;
    private timeout: ReturnType<typeof setTimeout> | null;
    private isRunningTask: boolean;
    private waitingTime: number; // milliseconds

    private taskErrorHandler: TaskErrorHandler;
    
    constructor(waitingTime: number, errorHandler?: TaskErrorHandler) {
        this.nextTask = null;
        this.timeout = null;
        this.isRunningTask = false;
        this.waitingTime = waitingTime;

        this.taskErrorHandler = errorHandler ?? defaultTaskErrorHandler;
    }

    add(task: Task): void {
        if (this.timeout !== null) {
            clearTimeout(this.timeout);
        }

        if (this.isRunningTask) {
            this.nextTask = task;
        }
        else {
            this.runTask(task);
        }
    }

    clearNextTask(): void {
        this.nextTask = null;
    }

    private runTask(task: Task): void {
        this.timeout = setTimeout(async () => {
            this.isRunningTask = true;
            try {
                await task();
            }
            catch (error) {
                this.taskErrorHandler(error);
            }
            this.isRunningTask = false;
            this.timeout = null;

            // Save a reference to nextTask now to avoid the situation
            // where it exists during the test but not within the block
            // because an async operation called clearNextTask()
            const nextTask = this.nextTask;
            if (nextTask) {
                this.runTask(nextTask);
                this.nextTask = null;
            }
        }, this.waitingTime);
    }
}