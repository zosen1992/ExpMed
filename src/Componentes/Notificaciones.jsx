import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { ref, onValue, update, remove } from 'firebase/database';
import { 
  FaArrowLeft, FaBell, FaCheckDouble, FaTrashAlt, 
  FaExclamationTriangle, FaUserInjured, FaClock, FaCalendarTimes 
} from 'react-icons/fa';
import '../Estilos/Notificaciones.css';
import { verificarCitasDeUsuario } from '../utilidades/verificadorCitas';

const Notificaciones = () => {
  const navigate = useNavigate();
  const myuid = auth.currentUser?.uid;

  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('TODAS');

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
    const destino = (item.tipoNotif === 'VIGENCIA' || item.tipoNotif === 'CITA')
      ? (item.rutaDestino || '/') 
      : `/sv/${item.uidPx}`;

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

  const listaFiltrada = filtro === 'NO_LEIDAS' 
    ? notificaciones.filter(n => !n.leido) 
    : notificaciones;

  const totalNoLeidas = notificaciones.filter(n => !n.leido).length;

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Cargando notificaciones...</div>;

  return (
    <div className='notif-container'>
      
      <div className='notif-header'>
        <Link to="/" className='btn-regresar-notif'>
          <FaArrowLeft /> Volver al Panel Principal
        </Link>

        <div className='notif-title-bar'>
          <h2 className='notif-titulo'>
            <FaBell className='bell-icon' /> Historial de Notificaciones y Alertas
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
          </div>
        )}
      </div>

      {listaFiltrada.length === 0 ? (
        <div className='notif-empty'>
          <FaBell className='notif-empty-icon' />
          <h3>No hay notificaciones {filtro === 'NO_LEIDAS' ? 'pendientes de leer' : 'registradas'}</h3>
          <p>Aquí aparecerán las alertas de signos vitales alterados y los avisos de vencimiento de vigencia (7, 3, 1 y -2 días).</p>
        </div>
      ) : (
        <div className='notif-list'>
          {listaFiltrada.map((item) => {
            const esVigencia = item.tipoNotif === 'VIGENCIA';

            return (
              <div 
                key={item.idNotif} 
                onClick={() => handleAbrirNotificacion(item)}
                className={`notif-card ${!item.leido ? 'notif-unread' : 'notif-read'}`}
                title={esVigencia ? "Clic para revisar vigencia" : "Clic para ir a los Signos Vitales del paciente"}
              >
                <div 
                  className='notif-icon-left' 
                  style={esVigencia ? { backgroundColor: '#fef3c7', color: '#d97706' } : {}}
                >
                  {esVigencia ? <FaCalendarTimes /> : <FaExclamationTriangle />}
                </div>

                <div className='notif-body'>
                  <div className='notif-top-row'>
                    <h4 className='notif-px-name'>
                      {esVigencia ? (
                        <FaCalendarTimes style={{ marginRight: '6px', color: '#e67e22' }} />
                      ) : (
                        <FaUserInjured style={{ marginRight: '6px', color: '#3498db' }} />
                      )}
                      {item.nombrePx || 'Notificación'}
                      {!item.leido && <span className='dot-nuevo'>NUEVA</span>}
                    </h4>
                    <span className='notif-date'><FaClock /> {item.fecha}</span>
                  </div>

                  <p className='notif-alert-msg'>
                    <strong>{esVigencia ? 'Aviso de vigencia:' : 'Parámetros alterados:'}</strong>{' '}
                    {item.detalleTexto || (item.alertas && item.alertas.join(', '))}
                  </p>

                  <div className='notif-footer-row'>
                    <span>Origen: <strong>{item.capturadoPor || 'Sistema'}</strong></span>
                    <span className='notif-cta'>
                      {esVigencia ? 'Clic para administrar vigencia →' : 'Clic para ir a Signos Vitales →'}
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