import api from "./apiClient";

export const projectService = {
  list: (params) => api.get("/projects", { params }).then((r) => r.data),
  // Distinct values for the filter dropdowns: { domains: [], institutions: [], statuses: [] }
  filters: () => api.get("/projects/filters").then((r) => r.data),
  get: (id) => api.get(`/projects/${id}`).then((r) => r.data),
  create: (payload) => api.post("/projects", payload).then((r) => r.data),
  update: (id, payload) => api.put(`/projects/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/projects/${id}`).then((r) => r.data),
};
