import { Task } from "./Task";

export class TaskThrottler {
    private nextTask: Task | null;
    private isRunningTask: boolean;
    private timeBetweenTasks: number; // milliseconds
    
    constructor(timeBetweenTasks: number) {
        this.nextTask = null;
        this.isRunningTask = false;
        this.timeBetweenTasks = timeBetweenTasks;
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

    private async run(task: Task): Promise<void> {
        this.isRunningTask = true;

        try {
            await task();
        }
        catch (error) {
            console.error("An error occured while running a task in a throttler:", error);
        }

        setTimeout(async () => {
            if (this.nextTask) {
                const task = this.nextTask;
                this.nextTask = null;

                await this.run(task);
            }
            else {
                this.isRunningTask = false;
            }
        }, this.timeBetweenTasks);
    }
}