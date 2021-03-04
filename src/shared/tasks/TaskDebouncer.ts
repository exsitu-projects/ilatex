import { Task } from "./Task";

export class TaskDebouncer {
    private nextTask: Task | null;
    private timeout: ReturnType<typeof setTimeout> | null;
    private isRunningTask: boolean;
    private waitingTime: number; // milliseconds
    
    constructor(waitingTime: number) {
        this.nextTask = null;
        this.timeout = null;
        this.isRunningTask = false;
        this.waitingTime = waitingTime;
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

    private runTask(task: Task): void {
        this.timeout = setTimeout(async () => {
            this.isRunningTask = true;
            try {
                await task();
            }
            catch (error) {
                console.error("An error occured while running a task in a debouncer:", error);
            }
            this.isRunningTask = false;

            this.timeout = null;
            if (this.nextTask) {
                this.runTask(this.nextTask);
                this.nextTask = null;
            }
        }, this.waitingTime);
    }
}