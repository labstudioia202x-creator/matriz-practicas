import { useEffect } from "react";

/**
 * Mientras `activo` sea true, el navegador pide confirmación antes de cerrar o
 * recargar la página. El envío masivo lo dirige el navegador lote por lote: si
 * la pestaña se cierra, el envío se detiene sin que nadie vea un error.
 */
export function useAvisoAlSalir(activo: boolean) {
  useEffect(() => {
    if (!activo) return;

    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      // Algunos navegadores todavía lo exigen para mostrar la confirmación.
      evento.returnValue = "";
    };

    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [activo]);
}
