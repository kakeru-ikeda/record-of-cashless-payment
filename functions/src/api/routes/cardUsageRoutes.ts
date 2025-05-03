import * as express from 'express';
import { CardUsageController } from '../controllers/CardUsageController';

// eslint-disable-next-line new-cap
const router = express.Router();
const cardUsageController = new CardUsageController();

/**
 * @route   GET /api/v1/card-usages
 * @desc    年月を指定してすべてのカード利用データを取得
 * @access  Private
 * @query   year - 年
 * @query   month - 月
 */
router.get('/', (req, res) => {
    cardUsageController.getAllCardUsages(req, res);
});

/**
 * @route   GET /api/v1/card-usages/:id
 * @desc    IDでカード利用データを取得
 * @access  Private
 * @param   id - カード利用データのID
 */
router.get('/:id', (req, res) => {
    cardUsageController.getCardUsageById(req, res);
});

/**
 * @route   POST /api/v1/card-usages
 * @desc    新しいカード利用データを作成
 * @access  Private
 * @body    CardUsage - カード利用データ
 */
router.post('/', (req, res) => {
    cardUsageController.createCardUsage(req, res);
});

/**
 * @route   PUT /api/v1/card-usages/:id
 * @desc    IDでカード利用データを更新
 * @access  Private
 * @param   id - カード利用データのID
 * @body    Partial<CardUsage> - 更新するフィールド
 */
router.put('/:id', (req, res) => {
    cardUsageController.updateCardUsage(req, res);
});

/**
 * @route   DELETE /api/v1/card-usages/:id
 * @desc    IDでカード利用データを削除（論理削除）
 * @access  Private
 * @param   id - カード利用データのID
 */
router.delete('/:id', (req, res) => {
    cardUsageController.deleteCardUsage(req, res);
});

export { router as cardUsageRouter };
