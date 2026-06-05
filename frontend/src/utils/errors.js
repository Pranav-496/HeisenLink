export function apiErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  const data = error.response?.data;
  if (!data) return fallback;
  if (typeof data.detail === "string") return data.detail;
  const firstKey = Object.keys(data)[0];
  const value = data[firstKey];
  if (Array.isArray(value)) return value[0];
  if (typeof value === "string") return value;
  return fallback;
}
