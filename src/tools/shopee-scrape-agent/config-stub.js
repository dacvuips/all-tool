/** Stub `config` khi bundle agent — tránh lỗi logger.debug / thiếu thư mục config. */
module.exports = {
  get() {
    return false;
  },
  has() {
    return false;
  },
};
