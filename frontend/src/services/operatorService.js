import api from './api';

/**
 * Lấy danh sách tất cả nhà xe từ DB.
 * @returns {Promise<Array<{operatorCode, operatorName, overallRating, totalReviews}>>}
 */
export async function fetchOperators() {
  const { data } = await api.get('/api/operators');
  return data;
}
