import { router } from "./trpc";
import { createDocumentProcedure } from "./procedures/document/createDocument";
import { deleteDocumentProcedure } from "./procedures/document/deleteDocument";
import { listDocumentsByChatProcedure } from "./procedures/document/listDocumentsByChat";

export const documentsRouter = router({
    createDocument: createDocumentProcedure,
    delete: deleteDocumentProcedure,
    listByChat: listDocumentsByChatProcedure,
});