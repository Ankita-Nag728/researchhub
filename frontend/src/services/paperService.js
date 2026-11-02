import api from "./apiClient";

export const paperService = {
  list: (params) => api.get("/papers", { params }).then((r) => r.data),
  filters: () => api.get("/papers/filters").then((r) => r.data),
  get: (id) => api.get(`/papers/${id}`).then((r) => r.data),
  create: (payload) => api.post("/papers", payload).then((r) => r.data),
  update: (id, payload) => api.put(`/papers/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/papers/${id}`).then((r) => r.data),
};
