/**
 * Alias de compatibilidad: redirige o expone POST /api/license/activate -> POST /api/licenses/activate
 * Previene errores 404 si el cliente consume la ruta en singular (/license/activate en lugar de /licenses/activate).
 */
export { POST, dynamic } from "@/app/api/licenses/activate/route";
