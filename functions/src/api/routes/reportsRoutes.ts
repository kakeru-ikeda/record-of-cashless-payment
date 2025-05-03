import express from 'express';
import { ReportController } from '../controllers/ReportController';

// eslint-disable-next-line new-cap
const router = express.Router();
const reportController = new ReportController();

/**
 * 日次レポート取得 API (特定の日)
 * GET /api/v1/reports/daily/:year/:month/:day
 */
router.get('/daily/:year/:month/:day', (req, res) => {
  reportController.getDailyReport(req, res);
});

/**
 * 日次レポート取得 API (月内の全日)
 * GET /api/v1/reports/daily/:year/:month
 */
router.get('/daily/:year/:month', (req, res) => {
  reportController.getMonthlyDailyReports(req, res);
});

/**
 * 週次レポート取得 API (特定の週)
 * GET /api/v1/reports/weekly/:year/:month/:term
 */
router.get('/weekly/:year/:month/:term', (req, res) => {
  reportController.getWeeklyReport(req, res);
});

/**
 * 週次レポート取得 API (月内の全週)
 * GET /api/v1/reports/weekly/:year/:month
 */
router.get('/weekly/:year/:month', (req, res) => {
  reportController.getMonthlyWeeklyReports(req, res);
});

/**
 * 月次レポート取得 API
 * GET /api/v1/reports/monthly/:year/:month
 */
router.get('/monthly/:year/:month', (req, res) => {
  reportController.getMonthlyReport(req, res);
});

export default router;
