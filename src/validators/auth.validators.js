const registerSchema = {
  name: { required: true, type: 'string', minLength: 2, maxLength: 100, label: 'Nombre' },
  email: { required: true, type: 'string', match: /^\S+@\S+\.\S+$/, label: 'Correo electrónico' },
  password: { required: true, type: 'string', minLength: 6, maxLength: 128, label: 'Contraseña' },
};

const loginSchema = {
  email: { required: true, type: 'string', label: 'Correo electrónico' },
  password: { required: true, type: 'string', label: 'Contraseña' },
};

module.exports = { registerSchema, loginSchema };

