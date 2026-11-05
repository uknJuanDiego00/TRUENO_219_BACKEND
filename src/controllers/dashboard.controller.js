const DashboardService = require('../services/dashboard.service');
const Sale = require('../models/Sale');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler } = require('../utils/helpers');

/**
 * @route GET /api/dashboard/summary
 */
const getSummary = asyncHandler(async (req, res) => {
  const summary = await DashboardService.getSummary(req.user._id);
  return ApiResponse.success(res, summary);
});

/**
 * @route GET /api/dashboard/top-products
 */
const getTopProducts = asyncHandler(async (req, res) => {
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 5);
  const summary = await DashboardService.getSummary(req.user._id);
  return ApiResponse.success(res, (summary.topSelling || []).slice(0, limit));
});

/**
 * @route GET /api/dashboard/sales-by-period
 */
const getSalesByPeriod = asyncHandler(async (req, res) => {
  const days = Math.max(1, parseInt(req.query.days, 10) || 7);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const sales = await Sale.find({
    user: req.user._id,
    date: { $gte: startDate },
    status: { $ne: 'anulada' },
  }).sort({ date: 1 });

  return ApiResponse.success(res, sales);
});

module.exports = {
  getSummary,
  getTopProducts,
  getSalesByPeriod,
};
