export interface ICloudFunctionTrigger {
  onFirestoreWrite(): Promise<void>;
  onScheduledDailyReport(): Promise<void>;
  onScheduledWeeklyReport(): Promise<void>;
  onScheduledMonthlyReport(): Promise<void>;
}
