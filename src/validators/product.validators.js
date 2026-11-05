const createProductSchema = {
  name: { required: true, type: 'string', minLength: 1, maxLength: 250, label: 'Nombre del producto' },
  category: { required: true, type: 'string', label: 'Categoría' },
  sellPrice: { required: true, type: 'number', min: 0, label: 'Precio de venta' },
};

const updateProductSchema = {
  name: { type: 'string', minLength: 1, maxLength: 250, label: 'Nombre del producto' },
  category: { type: 'string', label: 'Categoría' },
  sellPrice: { type: 'number', min: 0, label: 'Precio de venta' },
};

module.exports = { createProductSchema, updateProductSchema };

