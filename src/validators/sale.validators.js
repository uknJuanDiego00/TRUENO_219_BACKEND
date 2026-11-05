const createSaleSchema = {
  items: { required: true, label: 'Lista de productos' },
  subtotal: { required: true, type: 'number', min: 0, label: 'Subtotal' },
  total: { required: true, type: 'number', min: 0, label: 'Total' },
  paymentMethod: {
    required: true,
    type: 'string',
    enum: ['Efectivo', 'Nequi', 'Crédito', 'Transferencia', 'Otro'],
    label: 'Método de pago',
  },
};

module.exports = { createSaleSchema };

