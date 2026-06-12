import { createService } from "./createService";
import { placeReadSchema } from "../../schemas/place";

export const placesService = createService("/places", placeReadSchema);
