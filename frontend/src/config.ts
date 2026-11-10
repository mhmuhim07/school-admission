// R4: the backend URL comes from an environment variable (VITE_API_URL) set at build time.
export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8880";