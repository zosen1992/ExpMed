import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { ref, onValue, get, update } from 'firebase/database';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  FaBell, FaExclamationTriangle, FaTimes, 
  FaBirthdayCake, FaVenusMars, FaPhoneAlt, FaCalendarTimes 
} from 'react-icons/fa';
import { PiSealWarningDuotone } from "react-icons/pi";
import { 
  evaluarYNotificarVigenciaUsuario, 
  verificarVigenciasGlobalmente 
} from '../utilidades/verificadorVigencia';

const parsearFechaVigencia = (fechaStr) => {
  if (!fechaStr || typeof fechaStr !== 'string') return null;
  const limpio = fechaStr.trim();
  if (!limpio || limpio.toUpperCase() === 'N/A') return null;

  let anio, mes, dia;
  if (limpio.includes('/')) {
    const partes = limpio.split('/');
    if (partes.length === 3) {
      if (partes[0].length === 4) [anio, mes, dia] = partes.map(Number);
      else [dia, mes, anio] = partes.map(Number);
    }
  } else if (limpio.includes('-')) {
    const partes = limpio.split('-');
    if (partes.length === 3) {
      if (partes[0].length === 4) [anio, mes, dia] = partes.map(Number);
      else [dia, mes, anio] = partes.map(Number);
    }
  }

  if (!anio || !mes || !dia) return null;
  const fecha = new Date(anio, mes - 1, dia, 23, 59, 59, 999);
  return isNaN(fecha.getTime()) ? null : fecha;
};

const crearUrlAudioAlarma = () => {
  try {
    const sampleRate = 22050;
    const duration = 1.2;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let freq = 0;
      if (t < 0.20) freq = 880;
      else if (t >= 0.25 && t < 0.45) freq = 880;
      else if (t >= 0.50 && t < 0.70) freq = 880;
      else if (t >= 0.75 && t < 1.15) freq = 1046.5;

      const sample = freq > 0 ? Math.sin(2 * Math.PI * freq * t) * 0.75 : 0;
      view.setInt16(44 + i * 2, sample * 32767, true);
    }

    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  } catch (e) {
    return null;
  }
};

const crearUrlAudioSilenciosoKeepAlive = () => {
  try {
    const sampleRate = 8000;
    const numSamples = sampleRate;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    for (let i = 0; i < numSamples; i++) {
      view.setInt16(44 + i * 2, 1, true);
    }

    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  } catch (e) {
    return null;
  }
};

const audioAlarmaUrl = crearUrlAudioAlarma();
const audioAlarmaGlobal = audioAlarmaUrl ? new Audio(audioAlarmaUrl) : null;

const audioKeepAliveUrl = crearUrlAudioSilenciosoKeepAlive();
const audioKeepAliveGlobal = audioKeepAliveUrl ? new Audio(audioKeepAliveUrl) : null;
if (audioKeepAliveGlobal) {
  audioKeepAliveGlobal.loop = true;
  audioKeepAliveGlobal.volume = 0.01;
}

const activarKeepAliveSegundoPlano = () => {
  if (audioKeepAliveGlobal && audioKeepAliveGlobal.paused) {
    audioKeepAliveGlobal.play().catch(() => {});
  }
};

const reproducirSonidoAlerta = () => {
  if (audioAlarmaGlobal) {
    audioAlarmaGlobal.currentTime = 0;
    audioAlarmaGlobal.play().catch(() => {});
  }

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const crearBeep = (frecuencia, inicio, duracion) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frecuencia, inicio);
      gain.gain.setValueAtTime(0.35, inicio);
      gain.gain.exponentialRampToValueAtTime(0.001, inicio + duracion);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + duracion);
    };

    const ahora = ctx.currentTime;
    crearBeep(880, ahora, 0.18);
    crearBeep(880, ahora + 0.22, 0.18);
    crearBeep(1046.5, ahora + 0.45, 0.35);
  } catch (error) {
    console.warn("Audio bloqueado:", error);
  }
};

const calcularEdad = (fechaString) => {
  if (!fechaString) return null;
  let fechaNacimiento = new Date(fechaString);
  if (isNaN(fechaNacimiento.getTime()) && fechaString.includes('/')) {
    const partes = fechaString.split('/');
    if (partes.length === 3) fechaNacimiento = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
  }
  if (isNaN(fechaNacimiento.getTime())) return null;
  const hoy = new Date();
  let edadCalc = hoy.getFullYear() - fechaNacimiento.getFullYear();
  const m = hoy.getMonth() - fechaNacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < fechaNacimiento.getDate())) edadCalc--;
  return edadCalc;
};

const TopBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [userInfo, setUserInfo] = useState(null);
  const [currentUid, setCurrentUid] = useState(null);
  const [noLeidas, setNoLeidas] = useState(0);
  const [toastAlerta, setToastAlerta] = useState(null);
  const [permisoNotif, setPermisoNotif] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [monitoreoActivo, setMonitoreoActivo] = useState(false);

  const [pxActivo, setPxActivo] = useState(null);
  const [pxTieneAlergias, setPxTieneAlergias] = useState(false);
  const [pxIdActual, setPxIdActual] = useState(null);

  const notificacionesConocidas = useRef(new Set());
  const cargaInicialCompletada = useRef(false);
  const swRegRef = useRef(null);
  const alertaVigenciaMostrada = useRef(false);
  const barridoVigenciaRealizado = useRef(false);

  useEffect(() => {
    const desbloquearEnPrimerToque = () => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        activarKeepAliveSegundoPlano();
        setMonitoreoActivo(true);
      }
    };
    window.addEventListener('click', desbloquearEnPrimerToque, { once: true });
    window.addEventListener('touchstart', desbloquearEnPrimerToque, { once: true });
    return () => {
      window.removeEventListener('click', desbloquearEnPrimerToque);
      window.removeEventListener('touchstart', desbloquearEnPrimerToque);
    };
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator && window.isSecureContext) {
      const swUrl = `${import.meta.env.BASE_URL}sw.js`;
      fetch(swUrl, { method: 'HEAD' })
        .then((res) => {
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('javascript')) {
            return navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL });
          }
          return null;
        })
        .then((reg) => {
          if (reg) swRegRef.current = reg;
        })
        .catch(() => {});

      const handleMensajeSW = (event) => {
        if (event.data && event.data.type === 'NAVEGAR_DESDE_NOTIFICACION') {
          navigate(event.data.url);
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMensajeSW);
      return () => navigator.serviceWorker.removeEventListener('message', handleMensajeSW);
    }
  }, [navigate]);

const obtenerRutaDeNotificacion = (item) => {
  if (item.tipoNotif === 'VIGENCIA' || item.tipoNotif === 'CITA') {
    return item.rutaDestino || '/notificaciones';
  }
  return `/sv/${item.uidPx}`;
};

  const lanzarNotificacionSistema = async (item) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (userInfo && userInfo.recibirNotificaciones === false) return;

    const esVigencia = item.tipoNotif === 'VIGENCIA';
    const titulo = esVigencia 
      ? `📅 ${item.nombrePx}` 
      : `⚠️ Alerta Clínica: ${item.nombrePx}`;
    const cuerpo = esVigencia
      ? item.detalleTexto
      : `Signos alterados: ${item.detalleTexto}\nRegistró: ${item.capturadoPor}`;
    const urlDestino = obtenerRutaDeNotificacion(item);

    const opciones = {
      body: cuerpo,
      icon: 'https://cdn-icons-png.flaticon.com/512/2966/2966327.png',
      badge: 'https://cdn-icons-png.flaticon.com/512/2966/2966327.png',
      tag: `alerta-${item.idNotif}`,
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [500, 200, 500, 200, 800],
      data: {
        url: urlDestino,
        idNotif: item.idNotif
      }
    };

    try {
      if ('serviceWorker' in navigator) {
        const reg = swRegRef.current || (await navigator.serviceWorker.getRegistration());
        if (reg && reg.active) {
          reg.active.postMessage({
            type: 'MOSTRAR_ALERTA_CLINICA',
            payload: { titulo, opciones }
          });
          return;
        }
      }

      const notifNativa = new Notification(titulo, opciones);
      notifNativa.onclick = () => {
        window.focus();
        navigate(urlDestino);
        notifNativa.close();
      };
    } catch (err) {
      console.warn("Error al desplegar notificación:", err);
    }
  };

  const solicitarPermisoNotificaciones = async () => {
    if (!window.isSecureContext) {
      return alert("Las notificaciones requieren conexión segura (HTTPS o localhost).");
    }

    if (typeof Notification === 'undefined') {
      return alert("Tu navegador no soporta notificaciones.");
    }

    try {
      const permiso = await Notification.requestPermission();
      setPermisoNotif(permiso);

      if (permiso !== 'granted') {
        return alert("Debes permitir las notificaciones para recibir alertas.");
      }

      reproducirSonidoAlerta();
      activarKeepAliveSegundoPlano();
      setMonitoreoActivo(true);

      if ('serviceWorker' in navigator) {
        const swUrl = `${import.meta.env.BASE_URL}sw.js`;
        const reg = swRegRef.current || (await navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL }));
        swRegRef.current = reg;
        await navigator.serviceWorker.ready;

        await reg.showNotification('✅ Alertas Clínicas Activas', {
          body: 'Sonido y monitoreo en 2do plano activados.',
          icon: 'https://cdn-icons-png.flaticon.com/512/2966/2966327.png',
          vibrate: [300, 150, 300],
          tag: 'prueba-activacion',
          renotify: true
        });
      }
    } catch (e) {
      console.error("Error al activar alertas:", e);
    }
  };

  const cargarPerfilConfirmado = async (user) => {
    if (!user || sessionStorage.getItem('validandoRolLogin') === 'true') {
      setUserInfo(null);
      setCurrentUid(null);
      verificarCitasDeUsuario(user.uid, rolActivo);
      return;
    }

    const rolActivo = (localStorage.getItem('rolActivo') || '').toLowerCase();
    if (!rolActivo) {
      setUserInfo(null);
      setCurrentUid(null);
      return;
    }

    let ramasValidas = [rolActivo];
    if (rolActivo === 'enfermeria' || rolActivo === 'enfermero' || rolActivo === 'enfemero') {
      ramasValidas = ['enfermeria', 'enfermero', 'enfemero'];
    } else if (rolActivo === 'admin' || rolActivo === 'otro') {
      ramasValidas = ['admin', 'otro'];
    }

    for (const rama of ramasValidas) {
      const snap = await get(ref(db, `usuarios/${rama}/${user.uid}`));
      if (snap.exists()) {
        setCurrentUid(user.uid);
        const userRef = ref(db, `usuarios/${rama}/${user.uid}`);

        // Ejecutar barrido global de vigencias (7, 3, 1 y -2 días) una vez por sesión
        if (!barridoVigenciaRealizado.current && rolActivo !== 'px') {
          barridoVigenciaRealizado.current = true;
          verificarVigenciasGlobalmente();
        }

        onValue(userRef, async (s) => {
          if (s.exists()) {
            const datos = s.val();
            const rolEval = (datos.rol || rama).toLowerCase();
            const esMedicoOEnfermeria = 
              rama === 'medico' || 
              rama === 'enfermeria' || 
              rama === 'enfermero' || 
              rama === 'enfemero' || 
              rolEval === 'medico' || 
              rolEval.includes('enfermer');

            if (esMedicoOEnfermeria) {
              // 1. Evaluar si faltan 7, 3, 1 días o tiene 2 días vencido para generar notificación
              await evaluarYNotificarVigenciaUsuario(user.uid, datos, rama);

              // 2. Actualizar estado de Vigencia Vencida (sin expulsar al usuario, activando modo restringido)
              const fechaLimite = parsearFechaVigencia(datos.vigencia);
              const ahora = new Date();
              const vencida = !fechaLimite || ahora > fechaLimite;

              localStorage.setItem('vigenciaVencida', vencida ? 'true' : 'false');
              window.dispatchEvent(new Event('vigenciaActualizada'));
            } else {
              localStorage.setItem('vigenciaVencida', 'false');
            }

            setUserInfo(datos);
          }
        });
        return;
      }
    }

    setUserInfo(null);
    setCurrentUid(null);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        cargarPerfilConfirmado(user);
      } else {
        setUserInfo(null);
        setCurrentUid(null);
        notificacionesConocidas.current.clear();
        cargaInicialCompletada.current = false;
        barridoVigenciaRealizado.current = false;
      }
    });

    const handleRolVerificado = () => {
      if (auth.currentUser) {
        cargarPerfilConfirmado(auth.currentUser);
      }
    };

    window.addEventListener('rolVerificado', handleRolVerificado);
    return () => {
      unsubscribeAuth();
      window.removeEventListener('rolVerificado', handleRolVerificado);
    };
  }, [location.pathname]);

  useEffect(() => {
    const segmentos = location.pathname.split('/').filter(Boolean);
    const modulosClinicos = ['phc', 'consulta', 'alergias', 'sv', 'estudios', 'datospx'];

    if (segmentos.length >= 2 && modulosClinicos.includes(segmentos[0].toLowerCase())) {
      const idDetectado = segmentos[1];
      setPxIdActual(idDetectado);

      const pxRef = ref(db, `usuarios/px/${idDetectado}`);
      const unsubPx = onValue(pxRef, (snap) => {
        if (snap.exists()) {
          setPxActivo(snap.val());
        } else {
          setPxActivo(null);
        }
      });

      const alRef = ref(db, `alergias/${idDetectado}`);
      const unsubAl = onValue(alRef, (snap) => {
        setPxTieneAlergias(snap.exists());
      });

      return () => {
        unsubPx();
        unsubAl();
      };
    } else {
      setPxActivo(null);
      setPxIdActual(null);
      setPxTieneAlergias(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!currentUid) return;

    const notifRef = ref(db, `notificaciones/${currentUid}`);
    const unsubscribeNotif = onValue(notifRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const lista = Object.keys(data).map((key) => ({
          idNotif: key,
          ...data[key]
        }));

        const sinLeer = lista.filter((n) => !n.leido);
        setNoLeidas(sinLeer.length);

        lista.forEach((item) => {
          if (!notificacionesConocidas.current.has(item.idNotif)) {
            notificacionesConocidas.current.add(item.idNotif);

            if (cargaInicialCompletada.current && !item.leido) {
              const aceptaNotificaciones = userInfo && userInfo.recibirNotificaciones !== false;

              if (aceptaNotificaciones) {
                reproducirSonidoAlerta();

                if (navigator.vibrate) {
                  navigator.vibrate([500, 200, 500, 200, 800]);
                }

                setToastAlerta(item);
                lanzarNotificacionSistema(item);
              }
            }
          }
        });

        cargaInicialCompletada.current = true;
      } else {
        setNoLeidas(0);
        cargaInicialCompletada.current = true;
      }
    });

    return () => unsubscribeNotif();
  }, [currentUid, userInfo, navigate]);

  const abrirDestinoDesdeToast = async () => {
    if (!toastAlerta) return;
    const destino = obtenerRutaDeNotificacion(toastAlerta);
    const idNotif = toastAlerta.idNotif;
    setToastAlerta(null);
    try {
      await update(ref(db, `notificaciones/${currentUid}/${idNotif}`), { leido: true });
    } catch (e) {
      console.error(e);
    }
    navigate(destino);
  };

  if (!userInfo || location.pathname.toLowerCase() === '/login' || !localStorage.getItem('rolActivo')) {
    return null;
  }

  const esPx = (localStorage.getItem('rolActivo') || '').toLowerCase() === 'px';
  const aceptaNotifPerfil = userInfo.recibirNotificaciones !== false;
  const edadPxActivo = pxActivo ? calcularEdad(pxActivo.fecha_nac || pxActivo.fechanacimiento) : null;

  return (
    <>
      <div style={topBarStyle}>
        {!esPx && aceptaNotifPerfil && (!monitoreoActivo || permisoNotif !== 'granted') && (
          <button onClick={solicitarPermisoNotificaciones} style={btnActivarAlertasStyle}>
            🔔 Activar sonido y alertas en 2do plano
          </button>
        )}

        {!esPx && aceptaNotifPerfil && (
          <Link to="/notificaciones" style={bellContainerStyle} title="Ver notificaciones y alertas">
            <FaBell style={{ fontSize: '18px', color: noLeidas > 0 ? '#ffeb3b' : '#ffffff' }} />
            {noLeidas > 0 && <span style={badgeStyle}>{noLeidas}</span>}
          </Link>
        )}

        {!esPx && !aceptaNotifPerfil && (
          <span style={{ fontSize: '12px', backgroundColor: '#e74c3c', padding: '3px 8px', borderRadius: '10px', color: '#fff' }}>
            🔕 Notificaciones desactivadas en tu perfil
          </span>
        )}

        <div style={itemStyle}>
          <strong>Nombre:</strong> <span>{userInfo.nombre || userInfo.nombrecom}</span>
        </div>
        <div style={itemStyle}>
          <strong>Rol:</strong> <span style={{ textTransform: 'capitalize' }}>{userInfo.rol || localStorage.getItem('rolActivo')}</span>
        </div>
        {userInfo.vigencia && (
          <div style={itemStyle}>
            <strong>Vigencia:</strong>{' '}
            <span style={localStorage.getItem('vigenciaVencida') === 'true' ? { backgroundColor: '#c0392b', padding: '2px 8px', borderRadius: '8px', fontWeight: 'bold' } : {}}>
              {userInfo.vigencia} {localStorage.getItem('vigenciaVencida') === 'true' ? '(VENCIDA - SOLO LECTURA)' : ''}
            </span>
          </div>
        )}
      </div>

      {pxActivo && !esPx && (
        <div style={pxBannerStyle}>
          <div style={pxBannerInnerStyle}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img 
                src={pxActivo.fotoperfil || 'https://cdn-icons-png.flaticon.com/512/387/387561.png'} 
                alt="Paciente" 
                style={pxAvatarMiniStyle} 
              />
              <div>
                <span style={pxLabelAtendiendo}>PACIENTE EN ATENCIÓN:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '16px', color: '#1e293b' }}>
                    {pxActivo.nombre || pxActivo.nombrecom}
                  </strong>
                  {edadPxActivo !== null && (
                    <span style={pxEdadPillStyle}>{edadPxActivo} años</span>
                  )}
                  {pxTieneAlergias && (
                    <Link to={`/alergias/${pxIdActual}`} style={pxAlergiaBadgeStyle} title="Clic para revisar alergias">
                      <PiSealWarningDuotone /> Con Alergias
                    </Link>
                  )}
                </div>
              </div>
            </div>

            <div style={pxMetaGroupStyle}>
              <span>
                <FaBirthdayCake style={{ color: '#3498db', marginRight: '5px' }} />
                <strong>F. Nac:</strong> {pxActivo.fecha_nac || pxActivo.fechanacimiento || 'N/D'}
              </span>
              <span>
                <FaVenusMars style={{ color: '#3498db', marginRight: '5px' }} />
                <strong>Sexo:</strong> {pxActivo.sexo || 'N/A'}
              </span>
              {(pxActivo.num_cel || pxActivo.celular) && (
                <span>
                  <FaPhoneAlt style={{ color: '#3498db', marginRight: '5px' }} />
                  <strong>Tel:</strong> {pxActivo.num_cel || pxActivo.celular}
                </span>
              )}
            </div>

          </div>
        </div>
      )}

      {toastAlerta && aceptaNotifPerfil && (
        <div style={{
          ...toastStyle,
          backgroundColor: toastAlerta.tipoNotif === 'VIGENCIA' ? '#d35400' : '#c0392b'
        }}>
          <div style={toastHeaderStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
              {toastAlerta.tipoNotif === 'VIGENCIA' ? (
                <><FaCalendarTimes /> ¡AVISO DE VIGENCIA DE CUENTA!</>
              ) : (
                <><FaExclamationTriangle /> ¡ALERTA DE SIGNOS VITALES!</>
              )}
            </span>
            <button onClick={() => setToastAlerta(null)} style={toastCloseBtnStyle}>
              <FaTimes />
            </button>
          </div>
          <div onClick={abrirDestinoDesdeToast} style={{ cursor: 'pointer', marginTop: '8px' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 'bold' }}>
              {toastAlerta.tipoNotif === 'VIGENCIA' ? toastAlerta.nombrePx : `Paciente: ${toastAlerta.nombrePx}`}
            </p>
            <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#ffecec' }}>
              {toastAlerta.detalleTexto}
            </p>
            <span style={{ fontSize: '12px', textDecoration: 'underline', fontWeight: 'bold' }}>
              {toastAlerta.tipoNotif === 'VIGENCIA' ? 'Toque aquí para revisar vigencia →' : 'Toque aquí para ver los Signos Vitales →'}
            </span>
          </div>
        </div>
      )}
    </>
  );
};

const topBarStyle = {
  backgroundColor: '#3498db', color: 'white', padding: '12px 20px',
  display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
  flexWrap: 'wrap', gap: '20px', fontSize: '14px', fontFamily: 'Arial, sans-serif',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
};
const itemStyle = { display: 'flex', gap: '5px' };
const bellContainerStyle = {
  position: 'relative', display: 'flex', alignItems: 'center',
  textDecoration: 'none', marginRight: '5px', cursor: 'pointer'
};
const badgeStyle = {
  position: 'absolute', top: '-8px', right: '-10px', backgroundColor: '#e74c3c',
  color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '11px',
  fontWeight: 'bold', border: '1.5px solid white'
};
const btnActivarAlertasStyle = {
  backgroundColor: '#f39c12', color: '#fff', border: 'none', borderRadius: '15px',
  padding: '5px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', marginRight: 'auto'
};
const pxBannerStyle = {
  backgroundColor: '#f0f7ff', borderBottom: '2px solid #bcdff1', padding: '10px 20px',
  fontFamily: 'Segoe UI, Roboto, sans-serif', boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
};
const pxBannerInnerStyle = {
  maxWidth: '950px', margin: '0 auto', display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', flexWrap: 'wrap', gap: '15px'
};
const pxAvatarMiniStyle = {
  width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover',
  border: '2px solid #3498db', backgroundColor: '#fff'
};
const pxLabelAtendiendo = {
  display: 'block', fontSize: '10px', fontWeight: '800', color: '#2980b9', letterSpacing: '0.6px'
};
const pxEdadPillStyle = {
  backgroundColor: '#d6eaf8', color: '#1b4f72', padding: '2px 9px',
  borderRadius: '12px', fontSize: '12px', fontWeight: '700'
};
const pxAlergiaBadgeStyle = {
  backgroundColor: '#e74c3c', color: '#fff', padding: '2px 9px', borderRadius: '12px',
  fontSize: '12px', fontWeight: '700', textDecoration: 'none', display: 'inline-flex',
  alignItems: 'center', gap: '4px'
};
const pxMetaGroupStyle = {
  display: 'flex', gap: '18px', flexWrap: 'wrap', fontSize: '13px', color: '#334155'
};
const toastStyle = {
  position: 'fixed', top: '65px', right: '20px', backgroundColor: '#c0392b', color: 'white',
  padding: '16px 20px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
  zIndex: 9999, maxWidth: '360px', width: '90%', borderLeft: '6px solid #ffeb3b', fontFamily: 'Segoe UI, sans-serif'
};
const toastHeaderStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '6px'
};
const toastCloseBtnStyle = {
  background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px'
};

export default TopBar;