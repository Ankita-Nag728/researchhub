import api from "./apiClient";

export const applicationService = {
  submit: (payload) => api.post("/applications", payload).then((r) => r.data),
  mine: () => api.get("/applications/my").then((r) => r.data),
  get: (id) => api.get(`/applications/${id}`).then((r) => r.data),
  // Admin only (the backend enforces this; the UI merely hides the links)
  adminList: (params) => api.get("/admin/applications", { params }).then((r) => r.data),
  stats: () => api.get("/admin/stats").then((r) => r.data),
  updateStatus: (id, status) =>
    api.patch(`/admin/applications/${id}/status`, { status }).then((r) => r.data),
};

export const bookmarkService = {
  list: () => api.get("/bookmarks").then((r) => r.data),
  add: (payload) => api.post("/bookmarks", payload).then((r) => r.data),
  // Projects and papers have separate bookmark ids, so say which kind to remove.
  remove: (id, kind = "project") => api.delete(`/bookmarks/${id}`, { params: { kind } }).then((r) => r.data),
};

export const userService = {
  me: () => api.get("/users/me").then((r) => r.data),
  update: (payload) => api.put("/users/me", payload).then((r) => r.data),
  changePassword: (payload) => api.patch("/users/me/password", payload).then((r) => r.data),
};

export const adminService = {
  stats: () => api.get("/admin/stats").then((r) => r.data),
  users: (params) => api.get("/admin/users", { params }).then((r) => r.data),
  setUserActive: (id, is_active) => api.patch(`/admin/users/${id}`, { is_active }).then((r) => r.data),
};
