const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Client = require('../models/Client');
const Debt = require('../models/Debt');
const InventoryMovement = require('../models/InventoryMovement');

class DashboardService {
  static async getSummary(userId) {
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
      Product.countDocuments({ user: userId }),
      Client.countDocuments({ user: userId }),
      Sale.countDocuments({ user: userId }),
      Sale.find({ user: userId, status: 'pagada' }).select('total items'),
      Sale.find({ user: userId, date: { $gte: todayStart } }),
      Sale.find({ user: userId, date: { $gte: monthStart } }),
      Debt.find({ user: userId, status: { $ne: 'pagada' } }),
      Product.find({ user: userId, $expr: { $lte: ['$stock', '$minStock'] } }).limit(10),
      InventoryMovement.find({ user: userId }).sort({ createdAt: -1 }).limit(10),
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

