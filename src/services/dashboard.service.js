const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Client = require('../models/Client');
const Debt = require('../models/Debt');
const InventoryMovement = require('../models/InventoryMovement');

class DashboardService {
  static async getSummary(userId) {
    const scope = userId
      ? { $or: [{ user: userId }, { user: null }, { user: { $exists: false } }] }
      : {};

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      totalProducts,
      totalClients,
      totalSalesCount,
      allSales,
      todaySales,
      monthSales,
      debts,
      lowStockProducts,
      recentMovements,
    ] = await Promise.all([
      Product.countDocuments(scope),
      Client.countDocuments(scope),
      Sale.countDocuments(scope),
      Sale.find({ ...scope, status: 'pagada' }).select('total items'),
      Sale.find({ ...scope, date: { $gte: todayStart } }),
      Sale.find({ ...scope, date: { $gte: monthStart } }),
      Debt.find({ ...scope, status: { $ne: 'pagada' } }),
      Product.find({ ...scope, $expr: { $lte: ['$stock', '$minStock'] } }).limit(10),
      InventoryMovement.find(scope).sort({ createdAt: -1 }).limit(10),
    ]);

    // Financial totals
    const totalRevenue = allSales.reduce((acc, s) => acc + (s.total || 0), 0);
    const todayRevenue = todaySales.reduce((acc, s) => acc + (s.total || 0), 0);
    const monthRevenue = monthSales.reduce((acc, s) => acc + (s.total || 0), 0);

    // Outstanding debt
    const totalPendingDebt = debts.reduce((acc, d) => acc + (d.balance || 0), 0);

    // Top selling products
    const productSalesMap = {};
    for (const sale of allSales) {
      for (const item of sale.items || []) {
        const id = item.productId || item.name;
        if (!productSalesMap[id]) {
          productSalesMap[id] = { name: item.name, qty: 0, revenue: 0 };
        }
        productSalesMap[id].qty += item.qty || 0;
        productSalesMap[id].revenue += item.subtotal || 0;
      }
    }

    const topSelling = Object.values(productSalesMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      products: {
        total: totalProducts,
        lowStockCount: lowStockProducts.length,
        lowStockItems: lowStockProducts,
      },
      clients: {
        total: totalClients,
      },
      sales: {
        totalCount: totalSalesCount,
        totalRevenue,
        todayCount: todaySales.length,
        todayRevenue,
        monthCount: monthSales.length,
        monthRevenue,
      },
      debts: {
        pendingCount: debts.length,
        totalBalance: totalPendingDebt,
      },
      topSelling,
      recentMovements,
    };
  }
}

module.exports = DashboardService;

