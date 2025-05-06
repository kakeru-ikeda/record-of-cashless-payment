import { DateUtil } from '../../../shared/utils/DateUtil';

// DateUtilのモックを作成
const mockDateUtil = {
  getFirestorePath: jest.fn(),
  formatDate: jest.fn(),
  getJapaneseDayOfWeek: jest.fn(),
  formatDateRange: jest.fn(),
  getTermDateRange: jest.fn(),
  formatMonth: jest.fn(),
  getMonthDateRange: jest.fn(),
  getJSTDate: jest.fn(),
  getDateInfo: jest.fn(),
  getLastTermInfo: jest.fn(),
  getLastMonthInfo: jest.fn(),
};

// DateUtilクラスの静的メソッドをモックで上書き
jest.mock('../../../shared/utils/DateUtil', () => ({
  DateUtil: {
    getFirestorePath: mockDateUtil.getFirestorePath,
    formatDate: mockDateUtil.formatDate,
    getJapaneseDayOfWeek: mockDateUtil.getJapaneseDayOfWeek,
    formatDateRange: mockDateUtil.formatDateRange,
    getTermDateRange: mockDateUtil.getTermDateRange,
    formatMonth: mockDateUtil.formatMonth,
    getMonthDateRange: mockDateUtil.getMonthDateRange,
    getJSTDate: mockDateUtil.getJSTDate,
    getDateInfo: mockDateUtil.getDateInfo,
    getLastTermInfo: mockDateUtil.getLastTermInfo,
    getLastMonthInfo: mockDateUtil.getLastMonthInfo,
  }
}));

export { mockDateUtil };