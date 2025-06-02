export interface IReportScheduler {
  sendDailyReport(reportData: any): Promise<void>;
  sendWeeklyReport(reportData: any): Promise<void>;
  sendMonthlyReport(reportData: any): Promise<void>;
}
