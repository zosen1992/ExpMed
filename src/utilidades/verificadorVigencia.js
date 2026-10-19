import { db } from '../firebase';
import { ref, get, set } from 'firebase/database';

// Convierte "YYYY-MM-DD" o "DD/MM/YYYY" a un objeto Date a las 00:00:00 hrs local
export const obtenerFechaMedianoche = (fechaStr) => {
  if (!fechaStr || typeof fechaStr !== 'string') return null;
  const limpio = fechaStr.trim();
  if (!limpio || limpio.toUpperCase() === 'N/A') return null;

  let anio, mes, dia;
  if (limpio.includes('/')) {
    const p = limpio.split('/');
    if (p.length === 3) {
      if (p[0].length === 4) [anio, mes, dia] = p.map(Number);
      else [dia, mes, anio] = p.map(Number);
    }
  } else if (limpio.includes('-')) {
    const p = limpio.split('-');
    if (p.length === 3) {
      if (p[0].length === 4) [anio, mes, dia] = p.map(Number);
      else [dia, mes, anio] = p.map(Number);
    }
  }

  if (!anio || !mes || !dia) return null;
  const fecha = new Date(anio, mes - 1, dia, 0, 0, 0, 0);
  return isNaN(fecha.getTime()) ? null : fecha;
};

// Evalúa si la fecha de vigencia ya fue superada por la fecha actual (después de las 23:59:59 de ese día)
export const estaVigenciaVencida = (fechaStr) => {
  const fechaBase = obtenerFechaMedianoche(fechaStr);
  if (!fechaBase) return true; // Si no tiene fecha válida, se considera vencida para Médico/Enfermería
  const finDelDia = new Date(
    fechaBase.getFullYear(),
    fechaBase.getMonth(),
    fechaBase.getDate(),
    23, 59, 59, 999
  );
  return new Date() > finDelDia;
};

// Calcula cuántos días exactos faltan (positivo) o han pasado tras vencer (negativo)
export const calcularDiasRestantesVigencia = (fechaStr) => {
  const fechaVig = obtenerFechaMedianoche(fechaStr);
  if (!fechaVig) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const diffMs = fechaVig.getTime() - hoy.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

const obtenerUidsAdministradores = async () => {
  const uids = new Set();
  for (const rama of ['admin', 'otro']) {
    const snap = await get(ref(db, `usuarios/${rama}`));
    if (snap.exists()) {
      Object.keys(snap.val()).forEach((uid) => uids.add(uid));
    }
  }
  return Array.from(uids);
};

export const evaluarYNotificarVigenciaUsuario = async (uidUsuario, datosUsuario, ramaRol, listaAdminsPrevia = null) => {
  if (!uidUsuario || !datosUsuario || !datosUsuario.vigencia) return;

  const diasRestantes = calcularDiasRestantesVigencia(datosUsuario.vigencia);
  const hitosPermitidos = [7, 3, 1, -2];

  if (!hitosPermitidos.includes(diasRestantes)) return;

  const claveVigenciaLimpia = String(datosUsuario.vigencia).replace(/[^a-zA-Z0-9]/g, '');
  const etiquetaHito = diasRestantes > 0 ? `faltan_${diasRestantes}d` : `vencido_hace_${Math.abs(diasRestantes)}d`;

  const nombreProf = datosUsuario.nombre || datosUsuario.nombrecom || 'Profesional';
  const rolMostrar = ramaRol === 'medico' ? 'Médico' : 'Enfermería';

  const fechaActualFormato = new Date().toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  let mensajeParaUsuario = '';
  let mensajeParaAdmin = '';

  if (diasRestantes === 7) {
    mensajeParaUsuario = `Tu vigencia vence en 7 días (${datosUsuario.vigencia}). Solicita tu renovación oportunamente.`;
    mensajeParaAdmin = `La vigencia de ${nombreProf} (${rolMostrar}) vencerá en 7 días (${datosUsuario.vigencia}).`;
  } else if (diasRestantes === 3) {
    mensajeParaUsuario = `⚠️ Tu vigencia vence en 3 días (${datosUsuario.vigencia}). Evita restricciones en tu cuenta.`;
    mensajeParaAdmin = `⚠️ La vigencia de ${nombreProf} (${rolMostrar}) vencerá en 3 días (${datosUsuario.vigencia}).`;
  } else if (diasRestantes === 1) {
    mensajeParaUsuario = `🚨 ¡Atención! Mañana (1 día) vence la vigencia de tu cuenta (${datosUsuario.vigencia}).`;
    mensajeParaAdmin = `🚨 Mañana (1 día) vence la vigencia de ${nombreProf} (${rolMostrar} - ${datosUsuario.vigencia}).`;
  } else if (diasRestantes === -2) {
    mensajeParaUsuario = `⛔ Tu vigencia venció hace 2 días (${datosUsuario.vigencia}). Tu cuenta se encuentra en modo solo lectura de tus propios registros.`;
    mensajeParaAdmin = `⛔ La vigencia de ${nombreProf} (${rolMostrar}) cumplió 2 días vencida (${datosUsuario.vigencia}).`;
  }

  const idNotifUser = `vig_usr_${uidUsuario}_${claveVigenciaLimpia}_${etiquetaHito}`;
  const refNotifUser = ref(db, `notificaciones/${uidUsuario}/${idNotifUser}`);
  const snapNotifUser = await get(refNotifUser);

  if (!snapNotifUser.exists()) {
    await set(refNotifUser, {
      idNotif: idNotifUser,
      tipoNotif: 'VIGENCIA',
      uidDestino: uidUsuario,
      uidUsuarioAfectado: uidUsuario,
      nombrePx: `Aviso de Vigencia (${rolMostrar})`,
      detalleTexto: mensajeParaUsuario,
      alertas: [mensajeParaUsuario],
      capturadoPor: 'Control de Vigencias',
      fecha: fechaActualFormato,
      timestamp: Date.now(),
      leido: false,
      rutaDestino: `/Miperfil/${uidUsuario}`
    });
  }

  const uidsAdmins = listaAdminsPrevia || (await obtenerUidsAdministradores());
  const promesasAdmins = uidsAdmins.map(async (uidAdmin) => {
    const idNotifAdmin = `vig_adm_${uidUsuario}_${claveVigenciaLimpia}_${etiquetaHito}`;
    const refNotifAdmin = ref(db, `notificaciones/${uidAdmin}/${idNotifAdmin}`);
    const snapNotifAdmin = await get(refNotifAdmin);

    if (!snapNotifAdmin.exists()) {
      await set(refNotifAdmin, {
        idNotif: idNotifAdmin,
        tipoNotif: 'VIGENCIA',
        uidDestino: uidAdmin,
        uidUsuarioAfectado: uidUsuario,
        nombrePx: `Vigencia: ${nombreProf}`,
        detalleTexto: mensajeParaAdmin,
        alertas: [mensajeParaAdmin],
        capturadoPor: 'Control de Vigencias',
        fecha: fechaActualFormato,
        timestamp: Date.now(),
        leido: false,
        rutaDestino: '/admin/usuarios'
      });
    }
  });

  await Promise.all(promesasAdmins);
};

export const verificarVigenciasGlobalmente = async () => {
  try {
    const uidsAdmins = await obtenerUidsAdministradores();
    const ramasPersonal = ['medico', 'enfermeria', 'enfermero', 'enfemero'];

    for (const rama of ramasPersonal) {
      const snapRama = await get(ref(db, `usuarios/${rama}`));
      if (snapRama.exists()) {
        const usuarios = snapRama.val();
        for (const uid of Object.keys(usuarios)) {
          await evaluarYNotificarVigenciaUsuario(uid, usuarios[uid], rama, uidsAdmins);
        }
      }
    }
  } catch (error) {
    console.error("Error al verificar vigencias globales:", error);
  }
};