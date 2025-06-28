import { DailyReport, WeeklyReport, MonthlyReport } from '@shared/domain/entities/Reports';
import {
    DailyReportNotificationDTO,
    WeeklyReportNotificationDTO,
    MonthlyReportNotificationDTO
} from '@shared/domain/dto/ReportNotificationDTOs';
import { DateUtil } from '@shared/utils/DateUtil';

/**
 * アラートレベルの型定義（通知用DTOで使用）
 * 0: 通常、1-3: アラートレベル
 */
type NotificationAlertLevel = 0 | 1 | 2 | 3;

/**
 * レポートエンティティと通知用DTOの変換を行うマッパークラス
 */
export class ReportNotificationMapper {
    /**
     * DailyReportエンティティを通知用DTOに変換する
     * @param entity ドメインエンティティ
     * @param title 通知タイトル
     * @param additionalInfo 追加情報（任意）
     * @returns 通知用DTO
     */
    static toDailyNotification(
        entity: DailyReport,
        title: string,
        additionalInfo?: string
    ): DailyReportNotificationDTO {
        return {
            title,
            date: DateUtil.formatDate(entity.date.toDate(), 'yyyy/MM/dd'),
            totalAmount: entity.totalAmount,
            totalCount: entity.totalCount,
            additionalInfo
        };
    }

    /**
     * WeeklyReportエンティティを通知用DTOに変換する
     * @param entity ドメインエンティティ
     * @param title 通知タイトル
     * @param alertLevel アラートレベル
     * @param additionalInfo 追加情報（任意）
     * @returns 通知用DTO
     */
    static toWeeklyNotification(
        entity: WeeklyReport,
        title: string,
        alertLevel: NotificationAlertLevel = 0,
        additionalInfo?: string
    ): WeeklyReportNotificationDTO {
        const period = DateUtil.formatDateRange(
            entity.termStartDate.toDate(),
            entity.termEndDate.toDate(),
            'yyyy/MM/dd'
        );

        return {
            title,
            period,
            totalAmount: entity.totalAmount,
            totalCount: entity.totalCount,
            alertLevel,
            additionalInfo
        };
    }

    /**
     * MonthlyReportエンティティを通知用DTOに変換する
     * @param entity ドメインエンティティ
     * @param title 通知タイトル
     * @param alertLevel アラートレベル
     * @param additionalInfo 追加情報（任意）
     * @returns 通知用DTO
     */
    static toMonthlyNotification(
        entity: MonthlyReport,
        title: string,
        alertLevel: NotificationAlertLevel = 0,
        additionalInfo?: string
    ): MonthlyReportNotificationDTO {
        const period = DateUtil.formatDateRange(
            entity.monthStartDate.toDate(),
            entity.monthEndDate.toDate(),
            'yyyy/MM/dd'
        );

        return {
            title,
            period,
            totalAmount: entity.totalAmount,
            totalCount: entity.totalCount,
            alertLevel,
            additionalInfo
        };
    }

    /**
     * 週次レポートのアラート通知用DTOを作成する
     * @param entity WeeklyReportエンティティ
     * @param alertLevel アラートレベル
     * @param year 年
     * @param month 月
     * @param weekNumber 週番号
     * @param thresholdValue しきい値
     * @returns 通知用DTO
     */
    static toWeeklyAlertNotification(
        entity: WeeklyReport,
        alertLevel: NotificationAlertLevel,
        year: string,
        month: string,
        weekNumber: number,
        thresholdValue: number
    ): WeeklyReportNotificationDTO {
        const title = `週次支出アラート (レベル${alertLevel}) - ${year}年${month}月 第${weekNumber}週`;
        const additionalInfo = `しきい値 ${thresholdValue.toLocaleString()}円 を超過しました`;

        return this.toWeeklyNotification(entity, title, alertLevel, additionalInfo);
    }

    /**
     * 月次レポートのアラート通知用DTOを作成する
     * @param entity MonthlyReportエンティティ
     * @param alertLevel アラートレベル
     * @param year 年
     * @param month 月
     * @param thresholdValue しきい値
     * @returns 通知用DTO
     */
    static toMonthlyAlertNotification(
        entity: MonthlyReport,
        alertLevel: NotificationAlertLevel,
        year: string,
        month: string,
        thresholdValue: number
    ): MonthlyReportNotificationDTO {
        const title = `月次支出アラート (レベル${alertLevel}) - ${year}年${month}月`;
        const additionalInfo = `しきい値 ${thresholdValue.toLocaleString()}円 を超過しました`;

        return this.toMonthlyNotification(entity, title, alertLevel, additionalInfo);
    }

    /**
     * 日次レポートの定期通知用DTOを作成する
     * @param entity DailyReportエンティティ
     * @param year 年
     * @param month 月
     * @param day 日
     * @returns 通知用DTO
     */
    static toDailyScheduledNotification(
        entity: DailyReport,
        year: string,
        month: string,
        day: string
    ): DailyReportNotificationDTO {
        const title = `📊 ${year}年${month}月${day}日 デイリーレポート`;

        return this.toDailyNotification(entity, title);
    }

    /**
     * 週次レポートの定期通知用DTOを作成する
     * @param entity WeeklyReportエンティティ
     * @param year 年
     * @param month 月
     * @param weekNumber 週番号
     * @returns 通知用DTO
     */
    static toWeeklyScheduledNotification(
        entity: WeeklyReport,
        year: string,
        month: string,
        weekNumber: number
    ): WeeklyReportNotificationDTO {
        const title = `📊 ${year}年${month}月 第${weekNumber}週 ウィークリーレポート`;

        return this.toWeeklyNotification(entity, title);
    }

    /**
     * 月次レポートの定期通知用DTOを作成する
     * @param entity MonthlyReportエンティティ
     * @param year 年
     * @param month 月
     * @returns 通知用DTO
     */
    static toMonthlyScheduledNotification(
        entity: MonthlyReport,
        year: string,
        month: string
    ): MonthlyReportNotificationDTO {
        const title = `📊 ${year}年${month}月 マンスリーレポート`;

        return this.toMonthlyNotification(entity, title);
    }
}
