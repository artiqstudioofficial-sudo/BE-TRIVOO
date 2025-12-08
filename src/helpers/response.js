module.exports = {
  response(res, status = 200, error = false, message = 'OK', data = null) {
    return res.status(status).json({
      status,
      error,
      message,
      data,
    });
  },

  responsePagination: (res, status, error, message, pageDetail, data) => {
    var resultPrint = {};
    resultPrint.status = status || 200;
    resultPrint.error = error || false;
    resultPrint.message = message || 'Ok';
    resultPrint.pageDetail = pageDetail || {};
    resultPrint.data = data || {};
    return res.status(resultPrint.status).json(resultPrint);
  },
};
