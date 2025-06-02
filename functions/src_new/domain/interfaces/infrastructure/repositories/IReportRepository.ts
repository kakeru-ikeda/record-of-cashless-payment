import { ReportType } from '../../../enums/ReportType';

export interface IReportRepository {
  findReportsByDateRange(
    type: ReportType,
    startDate: Date,
    endDate: Date
  ): Promise<any[]>;
  saveReport(type: ReportType, reportData: any): Promise<string>;
  updateReport(type: ReportType, id: string, updates: any): Promise<void>;
  deleteReport(type: ReportType, id: string): Promise<void>;
}
