class ApiResponse {
  static success(res, data = null, message = 'Operación exitosa', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static paginated(res, data, pagination, message = 'Datos obtenidos exitosamente') {
    return res.status(200).json({
      success: true,
      message,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        pages: Math.ceil(pagination.total / pagination.limit),
      },
      data,
    });
  }

  static error(res, message = 'Ocurrió un error', statusCode = 500, errors = null) {
    const payload = {
      success: false,
      message,
    };
    if (errors) payload.errors = errors;
    return res.status(statusCode).json(payload);
  }
}

module.exports = ApiResponse;

