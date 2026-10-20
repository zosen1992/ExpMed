import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { ref, onValue, update, remove } from 'firebase/database';
import { 
  FaArrowLeft, FaBell, FaCheckDouble, FaTrashAlt, 
  FaExclamationTriangle, FaUserInjured, FaClock, 
  FaCalendarTimes, FaCalendarCheck, FaComments, 
  FaFilePrescription, FaHeartbeat 
} from 'react-icons/fa';
import '../Estilos/Notificaciones.css';

// Clasificador automático de notificaciones (detecta tipoNotif y también registros previos por contenido)
const obtenerCategoriaNotificacion = (item) => {
  const titulo = String(item.nombrePx || '');
  const detalle = String(item.detalleTexto || '');
  const ruta = String(item.rutaDestino || '');
  const tipo = String(item.tipoNotif || '').toUpperCase();

  if (
    tipo === 'RECETA' ||
    titulo.includes('📋') ||
    detalle.includes('📋') ||
    titulo.toLowerCase().includes('receta') ||
    detalle.toLowerCase().includes('indicaciones médicas')
  ) {
    return 'RECETA';
  }

  if (
    tipo === 'CHAT' ||
    ruta.startsWith('/chat') ||
    titulo.includes('💬') ||
    titulo.toLowerCase().includes('mensaje de') ||
    titulo.toLowerCase().includes('solicitud de')
  ) {
    return 'CHAT';
  }

  if (tipo === 'CITA' || ruta.startsWith('/mis-citas') || ruta.startsWith('/Agenda')) {
    return 'CITA';
  }

  if (tipo === 'VIGENCIA') {
    return 'VIGENCIA';
  }

  return 'SIGNOS_VITALES';
};

const Notificaciones = () => {
  const navigate = useNavigate();
  const myuid = auth.currentUser?.uid;
  const rolActivo = (localStorage.getItem('rolActivo') || '').toLowerCase();
  const esPx = rolActivo === 'px';

  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('TODAS'); // 'TODAS' | 'NO_LEIDAS' | 'CHAT' | 'CLINICAS'

  useEffect(() => {
    if (!myuid) return;

    const notifRef = ref(db, `notificaciones/${myuid}`);
    const unsubscribe = onValue(notifRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const lista = Object.keys(data).map(key => ({
          idNotif: key,
          ...data[key]
        })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setNotificaciones(lista);
      } else {
        setNotificaciones([]);
      }
      setCargando(false);
    });

    return () => unsubscribe();
  }, [myuid]);

  const handleAbrirNotificacion = async (item) => {
    const categoria = obtenerCategoriaNotificacion(item);
    let destino = '/';

    if (categoria === 'CHAT' || categoria === 'RECETA') {
      destino = item.rutaDestino || '/chat';
    } else if (categoria === 'CITA') {
      destino = esPx ? `/mis-citas/${myuid}` : (item.rutaDestino || '/Agenda');
    } else if (categoria === 'VIGENCIA') {
      destino = item.rutaDestino || '/';
    } else {
      destino = `/sv/${item.uidPx || myuid}`;
    }

    try {
      if (!item.leido) {
        await update(ref(db, `notificaciones/${myuid}/${item.idNotif}`), { leido: true });
      }
      navigate(destino);
    } catch (error) {
      console.error("Error al abrir notificación:", error);
      navigate(destino);
    }
  };

  const marcarTodasComoLeidas = async () => {
    const noLeidas = notificaciones.filter(n => !n.leido);
    if (noLeidas.length === 0) return;

    try {
      const promesas = noLeidas.map(n => 
        update(ref(db, `notificaciones/${myuid}/${n.idNotif}`), { leido: true })
      );
      await Promise.all(promesas);
    } catch (error) {
      console.error("Error al marcar como leídas:", error);
    }
  };

  const eliminarNotificacion = async (e, idNotif) => {
    e.stopPropagation();
    try {
      await remove(ref(db, `notificaciones/${myuid}/${idNotif}`));
    } catch (error) {
      console.error("Error al eliminar notificación:", error);
    }
  };

  const listaFiltrada = notificaciones.filter((n) => {
    const cat = obtenerCategoriaNotificacion(n);
    if (filtro === 'NO_LEIDAS') return !n.leido;
    if (filtro === 'CHAT') return cat === 'CHAT' || cat === 'RECETA';
    if (filtro === 'CLINICAS') return cat === 'SIGNOS_VITALES' || cat === 'CITA' || cat === 'VIGENCIA';
    return true;
  });

  const totalNoLeidas = notificaciones.filter(n => !n.leido).length;

  // Limpiar emojis repetidos del título para que se vea limpio junto al ícono de la plantilla
  const limpiarTitulo = (texto) => {
    return String(texto || 'Notificación').replace(/^[💬📋📅⚠️✅✕]+\s*/, '').trim();
  };

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Cargando historial de notificaciones...</div>;

  return (
    <div className='notif-container'>
      
      <div className='notif-header'>
        <Link to={esPx ? `/px/${myuid}` : '/'} className='btn-regresar-notif'>
          <FaArrowLeft /> {esPx ? 'Volver a mi menú' : 'Volver al Panel Principal'}
        </Link>

        <div className='notif-title-bar'>
          <h2 className='notif-titulo'>
            <FaBell className='bell-icon' /> {esPx ? 'Mis Notificaciones y Recordatorios' : 'Historial de Notificaciones y Alertas'}
            {totalNoLeidas > 0 && <span className='notif-count-badge'>{totalNoLeidas} nuevas</span>}
          </h2>

          {totalNoLeidas > 0 && (
            <button onClick={marcarTodasComoLeidas} className='btn-marcar-leidas'>
              <FaCheckDouble /> Marcar todas como leídas
            </button>
          )}
        </div>

        {notificaciones.length > 0 && (
          <div className='notif-tabs'>
            <button 
              className={filtro === 'TODAS' ? 'notif-tab-active' : ''} 
              onClick={() => setFiltro('TODAS')}
            >
              Todas ({notificaciones.length})
            </button>
            <button 
              className={filtro === 'NO_LEIDAS' ? 'notif-tab-active' : ''} 
              onClick={() => setFiltro('NO_LEIDAS')}
            >
              No leídas ({totalNoLeidas})
            </button>
            <button 
              className={filtro === 'CHAT' ? 'notif-tab-active' : ''} 
              onClick={() => setFiltro('CHAT')}
            >
              <FaComments style={{ marginRight: '5px' }} /> Mensajes y Recetas
            </button>
            <button 
              className={filtro === 'CLINICAS' ? 'notif-tab-active' : ''} 
              onClick={() => setFiltro('CLINICAS')}
            >
              <FaHeartbeat style={{ marginRight: '5px' }} /> Alertas y Citas
            </button>
          </div>
        )}
      </div>

      {listaFiltrada.length === 0 ? (
        <div className='notif-empty'>
          <FaBell className='notif-empty-icon' />
          <h3>No hay notificaciones en esta sección</h3>
          <p>
            {esPx 
              ? 'Aquí aparecerán tus mensajes de chat médico, recetas compartidas, recordatorios de citas y avisos de tu expediente.'
              : 'Aquí aparecerán los mensajes de chat con pacientes o colegas, alertas de signos vitales, recordatorios de citas y avisos de vigencia.'}
          </p>
        </div>
      ) : (
        <div className='notif-list'>
          {listaFiltrada.map((item) => {
            const categoria = obtenerCategoriaNotificacion(item);
            const tituloLimpio = limpiarTitulo(item.nombrePx);
            const cuerpoTexto = String(item.detalleTexto || (item.alertas && item.alertas.join(', ')) || '').replace(/^[📋💬]+\s*/, '');

            // ===================================================================
            // PLANTILLA 1: NOTIFICACIÓN DE CHAT / MENSAJERÍA INTERNA
            // ===================================================================
            if (categoria === 'CHAT') {
              return (
                <div 
                  key={item.idNotif} 
                  onClick={() => handleAbrirNotificacion(item)}
                  className={`notif-card notif-template-chat ${!item.leido ? 'notif-chat-unread' : 'notif-read'}`}
                  title="Haz clic para abrir la conversación en el Chat"
                >
                  <div className='notif-icon-left icon-box-chat'>
                    <FaComments />
                  </div>

                  <div className='notif-body'>
                    <div className='notif-top-row'>
                      <h4 className='notif-px-name'>
                        <span className='tag-categoria-chat'>CHAT CLÍNICO</span>
                        {tituloLimpio}
                        {!item.leido && <span className='dot-nuevo dot-azul'>NUEVO MENSAJE</span>}
                      </h4>
                      <span className='notif-date'><FaClock /> {item.fecha}</span>
                    </div>

                    <div className='notif-chat-bubble-preview'>
                      <strong>Mensaje recibido:</strong> {cuerpoTexto}
                    </div>

                    <div className='notif-footer-row'>
                      <span>Remitente: <strong>{item.capturadoPor || 'Usuario'}</strong></span>
                      <span className='notif-cta cta-chat'>
                        Clic para abrir conversación en el Chat →
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={(e) => eliminarNotificacion(e, item.idNotif)} 
                    className='btn-delete-notif'
                    title="Eliminar del historial"
                  >
                    <FaTrashAlt />
                  </button>
                </div>
              );
            }

            // ===================================================================
            // PLANTILLA 2: NOTIFICACIÓN DE RECETA / INDICACIONES MÉDICAS EN CHAT
            // ===================================================================
            if (categoria === 'RECETA') {
              return (
                <div 
                  key={item.idNotif} 
                  onClick={() => handleAbrirNotificacion(item)}
                  className={`notif-card notif-template-receta ${!item.leido ? 'notif-receta-unread' : 'notif-read'}`}
                  title="Haz clic para ver tu receta o indicaciones en el Chat"
                >
                  <div className='notif-icon-left icon-box-receta'>
                    <FaFilePrescription />
                  </div>

                  <div className='notif-body'>
                    <div className='notif-top-row'>
                      <h4 className='notif-px-name'>
                        <span className='tag-categoria-receta'>RECETA / TRATAMIENTO</span>
                        {tituloLimpio}
                        {!item.leido && <span className='dot-nuevo dot-verde'>NUEVA</span>}
                      </h4>
                      <span className='notif-date'><FaClock /> {item.fecha}</span>
                    </div>

                    <div className='notif-receta-box-preview'>
                      <strong>Indicaciones médicas compartidas:</strong>
                      <p>{cuerpoTexto}</p>
                    </div>

                    <div className='notif-footer-row'>
                      <span>Médico tratante: <strong>{item.capturadoPor || 'Médico'}</strong></span>
                      <span className='notif-cta cta-receta'>
                        Clic para ver e imprimir receta en el Chat →
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={(e) => eliminarNotificacion(e, item.idNotif)} 
                    className='btn-delete-notif'
                    title="Eliminar del historial"
                  >
                    <FaTrashAlt />
                  </button>
                </div>
              );
            }

            // ===================================================================
            // PLANTILLA 3: RECORDATORIO DE CITA MÉDICA
            // ===================================================================
            if (categoria === 'CITA') {
              return (
                <div 
                  key={item.idNotif} 
                  onClick={() => handleAbrirNotificacion(item)}
                  className={`notif-card notif-template-cita ${!item.leido ? 'notif-cita-unread' : 'notif-read'}`}
                  title="Haz clic para ver los detalles de la cita"
                >
                  <div className='notif-icon-left icon-box-cita'>
                    <FaCalendarCheck />
                  </div>

                  <div className='notif-body'>
                    <div className='notif-top-row'>
                      <h4 className='notif-px-name'>
                        <span className='tag-categoria-cita'>AGENDA DE CITAS</span>
                        {tituloLimpio}
                        {!item.leido && <span className='dot-nuevo dot-morado'>RECORDATORIO</span>}
                      </h4>
                      <span className='notif-date'><FaClock /> {item.fecha}</span>
                    </div>

                    <p className='notif-msg-clean'>
                      <strong>Detalle de la cita:</strong> {cuerpoTexto}
                    </p>

                    <div className='notif-footer-row'>
                      <span>Programado por: <strong>{item.capturadoPor || 'Agenda Médica'}</strong></span>
                      <span className='notif-cta cta-cita'>
                        {esPx ? 'Clic para ver Mis Citas →' : 'Clic para abrir Agenda Médica →'}
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={(e) => eliminarNotificacion(e, item.idNotif)} 
                    className='btn-delete-notif'
                    title="Eliminar del historial"
                  >
                    <FaTrashAlt />
                  </button>
                </div>
              );
            }

            // ===================================================================
            // PLANTILLA 4: AVISO DE VIGENCIA DE CUENTA
            // ===================================================================
            if (categoria === 'VIGENCIA') {
              return (
                <div 
                  key={item.idNotif} 
                  onClick={() => handleAbrirNotificacion(item)}
                  className={`notif-card notif-template-vigencia ${!item.leido ? 'notif-vigencia-unread' : 'notif-read'}`}
                >
                  <div className='notif-icon-left icon-box-vigencia'>
                    <FaCalendarTimes />
                  </div>

                  <div className='notif-body'>
                    <div className='notif-top-row'>
                      <h4 className='notif-px-name'>
                        <span className='tag-categoria-vigencia'>VIGENCIA</span>
                        {tituloLimpio}
                        {!item.leido && <span className='dot-nuevo dot-ambar'>IMPORTANTE</span>}
                      </h4>
                      <span className='notif-date'><FaClock /> {item.fecha}</span>
                    </div>

                    <p className='notif-msg-clean' style={{ color: '#92400e' }}>
                      <strong>Aviso de cuenta:</strong> {cuerpoTexto}
                    </p>

                    <div className='notif-footer-row'>
                      <span>Origen: <strong>{item.capturadoPor || 'Control de Vigencias'}</strong></span>
                      <span className='notif-cta' style={{ color: '#d97706' }}>
                        Clic para revisar vigencia →
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={(e) => eliminarNotificacion(e, item.idNotif)} 
                    className='btn-delete-notif'
                  >
                    <FaTrashAlt />
                  </button>
                </div>
              );
            }

            // ===================================================================
            // PLANTILLA 5: ALERTA CLÍNICA DE SIGNOS VITALES ALTERADOS
            // ===================================================================
            return (
              <div 
                key={item.idNotif} 
                onClick={() => handleAbrirNotificacion(item)}
                className={`notif-card ${!item.leido ? 'notif-unread' : 'notif-read'}`}
                title="Clic para ir a los Signos Vitales del paciente"
              >
                <div className='notif-icon-left'>
                  <FaExclamationTriangle />
                </div>

                <div className='notif-body'>
                  <div className='notif-top-row'>
                    <h4 className='notif-px-name'>
                      <FaUserInjured style={{ marginRight: '6px', color: '#e74c3c' }} />
                      Paciente: {tituloLimpio}
                      {!item.leido && <span className='dot-nuevo'>ALERTA</span>}
                    </h4>
                    <span className='notif-date'><FaClock /> {item.fecha}</span>
                  </div>

                  <p className='notif-alert-msg'>
                    <strong>Parámetros alterados:</strong> {cuerpoTexto}
                  </p>

                  <div className='notif-footer-row'>
                    <span>Registrado por: <strong>{item.capturadoPor || 'Personal Clínico'}</strong></span>
                    <span className='notif-cta'>
                      Clic para ir a Signos Vitales →
                    </span>
                  </div>
                </div>

                <button 
                  onClick={(e) => eliminarNotificacion(e, item.idNotif)} 
                  className='btn-delete-notif'
                  title="Eliminar del historial"
                >
                  <FaTrashAlt />
                </button>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default Notificaciones;