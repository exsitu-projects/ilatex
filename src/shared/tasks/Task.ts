export type Task = () => Promise<void>;

export type TaskError = any;
export type TaskErrorHandler = (error: TaskError) => void;

export const SILENT_TASK_ERROR_HANDLER = () => {};