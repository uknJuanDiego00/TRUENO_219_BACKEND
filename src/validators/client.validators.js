const createClientSchema = {
  name: { required: true, type: 'string', minLength: 2, maxLength: 200, label: 'Nombre del cliente' },
};

const updateClientSchema = {
  name: { type: 'string', minLength: 2, maxLength: 200, label: 'Nombre del cliente' },
};

module.exports = { createClientSchema, updateClientSchema };

