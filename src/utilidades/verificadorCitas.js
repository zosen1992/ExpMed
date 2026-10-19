import { db } from '../firebase';
import { ref, get, set } from 'firebase/database';
import { obtenerFechaMedianoche } from './verificadorVigencia';

// Calcula cuántos días faltan para la cita (0 = hoy, 1 = mañana, 2 = en dos días, 5 = en cinco días)
export const calcularDiasParaCita = (fechaCitaStr) => {
  const fechaCita = obtenerFechaMedianoche(fechaCitaStr);
  if (!fechaCita) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const diffMs = fechaCita.getTime() - hoy.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

// Evalúa una cita individual y genera recordatorios en los días 5, 2, 1 y 0 (mismo día)
export const evaluarYNotificarCita = async (cita) => {
  if (!cita || !cita.fecha || cita.estado === 'Cancelada') return;

  const diasRestantes = calcularDiasParaCita(cita.fecha);
  const hitosPermitidos = [5, 2, 1, 0];

  if (!hitosPermitidos.includes(diasRestantes)) return;

  const { idCita, uidMedico, nombreMedico, uidPx, nombrePx, fecha, hora, motivo } = cita;
  const claveFecha = String(fecha).replace(/[^a-zA-Z0-9]/g, '');
  const etiquetaHito = diasRestantes === 0 ? 'hoy' : `faltan_${diasRestantes}d`;

  const fechaActualFormato = new Date().toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  let textoTiempo = '';
  if (diasRestantes === 5) textoTiempo = 'en 5 días';
  else if (diasRestantes === 2) textoTiempo = 'en 2 días';
  else if (diasRestantes === 1) textoTiempo = 'mañana (1 día)';
  else if (diasRestantes === 0) textoTiempo = 'HOY';

  const msgMedico = `📅 Recordatorio: Tienes cita con ${nombrePx || 'Paciente'} ${textoTiempo} (${fecha} a las ${hora || 'hora por definir'}). Motivo: ${motivo || 'Consulta'}.`;
  const msgPaciente = `📅 Recordatorio de Cita: Tu consulta con Dr(a). ${nombreMedico || 'Médico'} es ${textoTiempo} (${fecha} a las ${hora || 'hora por definir'}).`;

  // 1. Notificación para el Médico
  if (uidMedico) {
    const idNotifMed = `cita_med_${idCita}_${claveFecha}_${etiquetaHito}`;
    const refMed = ref(db, `notificaciones/${uidMedico}/${idNotifMed}`);
    const snapMed = await get(refMed);

    if (!snapMed.exists()) {
      await set(refMed, {
        idNotif: idNotifMed,
        tipoNotif: 'CITA',
        uidDestino: uidMedico,
        uidPx: uidPx || '',
        nombrePx: `Cita (${textoTiempo.toUpperCase()}): ${nombrePx}`,
        detalleTexto: msgMedico,
        alertas: [msgMedico],
        capturadoPor: 'Agenda Médica',
        fecha: fechaActualFormato,
        timestamp: Date.now(),
        leido: false,
        rutaDestino: '/Agenda'
      });
    }
  }

  // 2. Notificación para el Paciente
  if (uidPx) {
    const idNotifPx = `cita_px_${idCita}_${claveFecha}_${etiquetaHito}`;
    const refPx = ref(db, `notificaciones/${uidPx}/${idNotifPx}`);
    const snapPx = await get(refPx);

    if (!snapPx.exists()) {
      await set(refPx, {
        idNotif: idNotifPx,
        tipoNotif: 'CITA',
        uidDestino: uidPx,
        uidPx: uidPx,
        nombrePx: `Tu Cita Médica (${textoTiempo.toUpperCase()})`,
        detalleTexto: msgPaciente,
        alertas: [msgPaciente],
        capturadoPor: `Dr(a). ${nombreMedico || 'Médico'}`,
        fecha: fechaActualFormato,
        timestamp: Date.now(),
        leido: false,
        rutaDestino: `/mis-citas/${uidPx}`
      });
    }
  }
};

// Verifica todas las citas del usuario logueado (Médico o Paciente)
export const verificarCitasDeUsuario = async (uid, rol) => {
  if (!uid) return;
  try {
    const rolNorm = String(rol || '').toLowerCase();
    const ruta = rolNorm === 'px' ? `citas_px/${uid}` : `agenda/${uid}`;
    const snap = await get(ref(db, ruta));

    if (snap.exists()) {
      const citasObj = snap.val();
      const promesas = Object.values(citasObj).map((cita) => evaluarYNotificarCita(cita));
      await Promise.all(promesas);
    }
  } catch (error) {
    console.error("Error al verificar recordatorios de citas:", error);
  }
};