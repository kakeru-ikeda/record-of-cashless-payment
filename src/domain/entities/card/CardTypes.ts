/**
 * カード会社の種類
 */
export enum CardCompany {
    MUFG = 'MUFG',        // 三菱UFJ銀行
    SMBC = 'SMBC'         // 三井住友カード
}

/**
 * カード利用情報の型定義
 */
export interface CardUsageInfo {
    card_name: string;
    datetime_of_use: string;
    amount: number;
    where_to_use: string;
}