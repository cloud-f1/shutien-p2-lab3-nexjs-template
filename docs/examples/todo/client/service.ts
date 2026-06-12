import { createService } from "./createService";
import { taskReadSchema } from "../../schemas/task";

export const tasksService = createService("/tasks", taskReadSchema);
