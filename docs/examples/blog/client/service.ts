import { createService } from "./createService";
import { postReadSchema } from "../../schemas/post";

export const postsService = createService("/posts", postReadSchema);
