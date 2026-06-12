import { createService } from "./createService";
import { contactReadSchema } from "../../schemas/contact";

export const contactsService = createService("/contacts", contactReadSchema);
