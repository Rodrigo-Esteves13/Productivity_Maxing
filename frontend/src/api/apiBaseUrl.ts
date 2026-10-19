// URL base da API, sem barra final. Um so sitio para o valor de
// desenvolvimento (antes repetido em 9 ficheiros). Em producao vem sempre de
// VITE_API_URL (definida no build do Netlify).
const DEV_API_URL = 'http://localhost:3000';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || DEV_API_URL).replace(/\/$/, '');
