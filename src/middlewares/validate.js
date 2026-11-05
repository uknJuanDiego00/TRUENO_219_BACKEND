const validate = (schema) => {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`El campo '${rules.label || field}' es obligatorio.`);
        continue;
      }

      if (value !== undefined && value !== null && value !== '') {
        if (rules.type === 'number' && typeof value !== 'number') {
          if (isNaN(Number(value))) {
            errors.push(`El campo '${rules.label || field}' debe ser un valor numérico.`);
          }
        }

        if (rules.type === 'string' && typeof value !== 'string') {
          errors.push(`El campo '${rules.label || field}' debe ser texto.`);
        }

        if (rules.min !== undefined && Number(value) < rules.min) {
          errors.push(`El campo '${rules.label || field}' debe ser mayor o igual a ${rules.min}.`);
        }

        if (rules.max !== undefined && Number(value) > rules.max) {
          errors.push(`El campo '${rules.label || field}' no puede ser mayor a ${rules.max}.`);
        }

        if (rules.minLength && String(value).length < rules.minLength) {
          errors.push(`El campo '${rules.label || field}' debe tener al menos ${rules.minLength} caracteres.`);
        }

        if (rules.maxLength && String(value).length > rules.maxLength) {
          errors.push(`El campo '${rules.label || field}' no puede exceder ${rules.maxLength} caracteres.`);
        }

        if (rules.enum && !rules.enum.includes(value)) {
          errors.push(`El campo '${rules.label || field}' debe ser una de las siguientes opciones: ${rules.enum.join(', ')}.`);
        }

        if (rules.match && !rules.match.test(String(value))) {
          errors.push(`El formato del campo '${rules.label || field}' no es válido.`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validación fallida en los datos enviados.',
        errors,
      });
    }

    next();
  };
};

module.exports = validate;

