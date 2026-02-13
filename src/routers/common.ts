import Excel from "exceljs";
import fs from "fs";
import _ from "lodash";
import moment from "moment-timezone";
import multer from "multer";
import logger from "../helpers/logger";
import minio from "../helpers/minio";
import { id12 } from "../helpers/nanoid";
import { WorkSheetHelper } from "../helpers/workSheet";
import { AttachmentModel, attachmentService } from "../libs/dal/attachment";

export namespace ImportCommon {
  export function uploadExcelFileMiddleware() {
    return multer({ storage: multer.memoryStorage() }).single("data");
  }
  export async function readWorkbookFromBuffer(ctx: any) {
    const {
      input: { req },
    } = ctx;
    const workbook = new Excel.Workbook();
    await workbook.xlsx.load(req.file.buffer as any);
    const values = new WorkSheetHelper(workbook.getWorksheet(1)).displayValues({
      dateFormat: "DD/MM/YYYY",
    });
    // Populate context
    ctx.meta.workbook = workbook;
    ctx.meta.values = values;
  }
  export async function readWorkbookFromApproval(ctx: any) {
    const {
      input: {
        approval: {
          data: { filePath },
        },
      },
    } = ctx;
    const workbook = new Excel.Workbook();
    await workbook.xlsx.readFile(`tmp/${filePath}`);
    const values = new WorkSheetHelper(workbook.getWorksheet(1)).displayValues({
      dateFormat: "DD/MM/YYYY",
    });
    // Populate context
    ctx.meta.workbook = workbook;
    ctx.meta.values = values;
    fs.unlinkSync(`tmp/${filePath}`);
  }
  export function initResultWorkbook(ctx: any) {
    const {
      input: { headers, resultSheetName = "data" },
    } = ctx;
    const workbook = new Excel.Workbook();
    const sheet = workbook.addWorksheet(resultSheetName);
    sheet.addRow([...headers, "Data entry status", "Data entry error"]);
    ctx.meta.resultWorkbook = workbook;
    ctx.meta.resultSheet = sheet;
  }

  export function responseExcel(ctx: any) {
    const {
      input: { res, exportName = "ket-qua" },
      meta: { resultSheet, resultWorkbook },
    } = ctx;
    const helper = new WorkSheetHelper(resultSheet);
    helper.autoSize();
    return WorkSheetHelper.responseExcel(res, resultWorkbook, exportName);
  }

  export function responseOK(ctx: any) {
    const {
      input: { res },
    } = ctx;
    return res.status(200).json({ msg: "OK" });
  }

  export function initTemplateWorksheet(ctx: any) {
    const {
      input: { headers, sheetName = "data" },
    } = ctx;
    const workbook = new Excel.Workbook();
    const sheet = workbook.addWorksheet(sheetName);
    sheet.addRow([...headers]);
    ctx.meta.resultWorkbook = workbook;
    ctx.meta.resultSheet = sheet;
  }

  export async function uploadToMinio(ctx: any) {
    try {
      const {
        input: { fileType, approval },
        meta: { resultSheet, isNewFileAdminApproval },
      } = ctx;
      logger.info("Uploading...");

      const adminPath = isNewFileAdminApproval ? "admin" : "shop";
      const tmpPath = `tmp/import_approval_${adminPath}_${id12()}.xlsx`;
      const fileName = `import-approval_${adminPath}/${moment().format(
        "YYYY/MM/DD"
      )}/${fileType}_${moment().format("DD-MM-YYYY_hh:mm:ss")}.xlsx`;

      // Ensure tmp directory exists
      if (!fs.existsSync("tmp")) {
        fs.mkdirSync("tmp", { recursive: true });
      }

      const workSheetHelper = new WorkSheetHelper(resultSheet);
      const workbook = workSheetHelper.workbook;
      await workbook.xlsx.writeFile(tmpPath);
      const attachment = new AttachmentModel({
        name: fileName,
        size: fs.statSync(tmpPath).size,
        mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        process: false,
        path: fileName,
      });
      await minio.uploadFS(fileName, tmpPath);
      attachment.bucket = minio.bucket;
      await attachment.save();
      fs.unlinkSync(tmpPath);

      if (!!isNewFileAdminApproval) {
        if (approval.attachmentAdminId) {
          await attachmentService.deleteAttachtment(approval.attachmentAdminId);
        }
        approval.attachmentAdminId = attachment._id;
        approval.data.adminFilePath = attachment.path;
        approval.data.adminFileName = attachment.name;
      }
      if (!isNewFileAdminApproval) {
        if (approval.attachmentId) {
          await attachmentService.deleteAttachtment(approval.attachmentId);
        }
        approval.attachmentId = attachment._id;
        approval.data.filePath = attachment.path;
        approval.data.fileName = attachment.name;
      }
      approval.markModified("data");
      await approval.save();
    } catch (error) {
      logger.error("Lỗi khi upload Minio", error);
      throw error;
    }
  }

  export async function getImportFileFromMinio(ctx: any) {
    try {
      const {
        input: {
          approval: {
            data: { filePath },
          },
        },
      } = ctx;
      if (
        !fs.existsSync(`tmp/${(filePath as string).slice(0, (filePath as string).indexOf("/"))}`)
      ) {
        fs.mkdirSync(`tmp/${(filePath as string).slice(0, (filePath as string).indexOf("/"))}`, {
          recursive: true,
        });
      }
      await minio.getOneObject(filePath, `tmp/${filePath}`);
    } catch (error) {
      logger.error(`Không thể tải file từ minio`, error);
      throw new Error(`Không thể tải tập tin`);
    }
  }
  export function requiredValue(value: any, message: string) {
    if (value == null || value == "" || value == undefined) {
      throw new Error(message);
    }
  }
  export function requiredRecordFields(record: any, fields: string[][]) {
    for (const [field, fieldName] of fields) {
      requiredValue(record[field], `${fieldName} không được để trống`);
    }
  }
  export function validateDateFormatFields(record: any, format: string, fields: string[][]) {
    for (const [field, fieldName] of fields) {
      if (record[field]) {
        if (!moment(record[field], format, true).isValid()) {
          throw new Error(`${fieldName} không đúng định dạng`);
        }
      }
    }
  }

  export function validateEnumFields(record: any, fields: [string, string, string[]][]) {
    for (const [field, fieldName, fieldValues] of fields) {
      if (record[field]) {
        if (!_.includes(fieldValues, record[field])) {
          throw new Error(`${fieldName} không hợp lệ`);
        }
      }
    }
  }
}
