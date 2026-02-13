import { CRUDService } from "../../../base/crudService";
import { ReportModel } from "./report.model";

class ReportService extends CRUDService(ReportModel) {}

const reportService = new ReportService();
export { reportService };
