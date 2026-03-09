import { CRUDService } from "../../../base/crudService";
import { AiGenerationRunModel } from "./ai-generation-run.model";
import type { IAiGenerationRun } from "./ai-generation-run.interface";

/**
 * Service CRUD cho AiGenerationRun.
 * Dùng để tạo run, cập nhật trạng thái/resultRefs, và query lịch sử.
 */
class AiGenerationRunService extends CRUDService(AiGenerationRunModel) {}

export const aiGenerationRunService = new AiGenerationRunService();
