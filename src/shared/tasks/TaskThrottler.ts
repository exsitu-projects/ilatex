import { Task, TaskError, TaskErrorHandler } from "./Task";

const defaultTaskErrorHandler = (error: TaskError) => {
    console.error("An error occured while running a task in a throttler:", error);
};

export class TaskThrottler {
    private nextTask: Task | null;
    private isRunningTask: boolean;
    private timeBetweenTasks: number; // milliseconds

    private taskErrorHandler: TaskErrorHandler;
    
    constructor(timeBetweenTasks: number, errorHandler?: TaskErrorHandler) {
        this.nextTask = null;
        this.isRunningTask = false;
        this.timeBetweenTasks = timeBetweenTasks;

        this.taskErrorHandler = errorHandler ?? defaultTaskErrorHandler;
    }

    add(task: Task): void {
        if (this.isRunningTask) {
            this.nextTask = task;
            return;
        }

        (async () => {
            this.run(task);
        })();
    }

    clearNextTask(): void {
        this.nextTask = null;
    }

    private async run(task: Task): Promise<void> {
        this.isRunningTask = true;

        try {
            await task();
        }
        catch (error) {
            this.taskErrorHandler(error);
        }

        setTimeout(async () => {
            // Save a reference to nextTask now to avoid the situation
            // where it exists during the test but not within the block
            // because an async operation called clearNextTask()
            const nextTask = this.nextTask;
            if (nextTask) {
                const task = nextTask;
                this.nextTask = null;

                await this.run(task);
            }
            else {
                this.isRunningTask = false;
            }
        }, this.timeBetweenTasks);
    }
}