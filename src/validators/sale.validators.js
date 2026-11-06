// ============================================================
// Validador de ventas – TRUENO 219
// NOTA: 'subtotal' no es requerido desde el frontend porque el
// backend lo puede calcular a partir de los items. Se valida
// solo si viene, para garantizar consistencia.
// ============================================================

const createSaleSchema = {
  items: { required: true, label: 'Lista de productos' },
  total: { required: true, type: 'number', min: 0, label: 'Total' },
  paymentMethod: {
    required: true,
    type: 'string',
    // Debe coincidir EXACTAMENTE con el enum del modelo Sale.js
    enum: ['Efectivo', 'Nequi', 'Crédito', 'Transferencia', 'Otro'],
    label: 'Método de pago',
  },
};

module.exports = { createSaleSchema };

