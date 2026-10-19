import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { 
  FaArrowLeft, FaCalendarAlt, FaClock, FaUserMd, 
  FaMapMarkerAlt, FaPhoneAlt, FaBell, FaNotesMedical 
} from 'react-icons/fa';
import { calcularDiasParaCita, evaluarYNotificarCita } from '../utilidades/verificadorCitas';
import '../Estilos/Agenda.css';

const CitasPaciente = () => {
  const { id } = useParams(); // UID del paciente
  const navigate = useNavigate();
  const myuid = auth.currentUser?.uid;

  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('PROXIMAS'); // 'PROXIMAS' | 'HISTORIAL'

  useEffect(() => {
    if (!myuid || !id) return;

    // Seguridad: Si es paciente, asegurar que solo consulte su propio UID
    const rolActivo = (localStorage.getItem('rolActivo') || '').toLowerCase();
    if (rolActivo === 'px' && id !== myuid) {
      navigate(`/mis-citas/${myuid}`, { replace: true });
      return;
    }

    const citasPxRef = ref(db, `citas_px/${id}`);
    const unsubscribe = onValue(citasPxRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const lista = Object.keys(data)
          .map((key) => ({ idCita: key, ...data[key] }))
          .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));
        setCitas(lista);

        // Evaluar recordatorios de 5, 2, 1 y 0 días
        lista.forEach((c) => evaluarYNotificarCita(c));
      } else {
        setCitas([]);
      }
      setCargando(false);
    });

    return () => unsubscribe();
  }, [id, myuid, navigate]);

  const hoy = new Date();
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

  const citasFiltradas = citas.filter((c) => {
    if (filtro === 'PROXIMAS') {
      return c.fecha >= hoyISO && c.estado !== 'Cancelada' && c.estado !== 'Completada';
    }
    return c.fecha < hoyISO || c.estado === 'Completada' || c.estado === 'Cancelada';
  });

  const obtenerEtiquetaRecordatorio = (fechaStr) => {
    const dias = calcularDiasParaCita(fechaStr);
    if (dias === 0) return { texto: '¡Tu cita es HOY!', clase: 'alerta-cita-hoy' };
    if (dias === 1) return { texto: '¡Mañana (Falta 1 día)!', clase: 'alerta-cita-1d' };
    if (dias === 2) return { texto: 'Faltan 2 días', clase: 'alerta-cita-2d' };
    if (dias === 5) return { texto: 'Faltan 5 días', clase: 'alerta-cita-5d' };
    if (dias > 0) return { texto: `En ${dias} días`, clase: 'alerta-cita-normal' };
    return null;
  };

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '60px' }}>Cargando tus citas médicas...</div>;

  return (
    <div className="agenda-container">
      <div className="agenda-header">
        <Link to={`/px/${id}`} className="btn-regresar-agenda">
          <FaArrowLeft /> Regresar a mi menú
        </Link>

        <div className="agenda-title-row">
          <div>
            <h2 className="agenda-titulo"><FaCalendarAlt /> Mis Citas Médicas</h2>
            <p className="agenda-subtitulo">
              Consulta tus próximas visitas programadas y las indicaciones de tu médico
            </p>
          </div>
        </div>
      </div>

      {/* PESTAÑAS PRÓXIMAS vs HISTORIAL */}
      <div className="citas-px-tabs">
        <button 
          className={filtro === 'PROXIMAS' ? 'tab-px-active' : ''} 
          onClick={() => setFiltro('PROXIMAS')}
        >
          Próximas Citas ({citas.filter(c => c.fecha >= hoyISO && c.estado !== 'Cancelada' && c.estado !== 'Completada').length})
        </button>
        <button 
          className={filtro === 'HISTORIAL' ? 'tab-px-active' : ''} 
          onClick={() => setFiltro('HISTORIAL')}
        >
          Historial / Anteriores ({citas.filter(c => c.fecha < hoyISO || c.estado === 'Completada' || c.estado === 'Cancelada').length})
        </button>
      </div>

      {citasFiltradas.length === 0 ? (
        <div className="agenda-dia-card" style={{ textAlign: 'center', padding: '45px 20px' }}>
          <FaCalendarAlt style={{ fontSize: '3rem', color: '#cbd5e1', marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 6px 0', color: '#334155' }}>
            {filtro === 'PROXIMAS' ? 'No tienes citas próximas programadas' : 'Sin historial de citas anteriores'}
          </h3>
          <p style={{ color: '#64748b', margin: 0 }}>
            Cuando tu médico agende una consulta en el sistema, aparecerá automáticamente aquí con tus recordatorios.
          </p>
        </div>
      ) : (
        <div className="citas-px-grid">
          {citasFiltradas.map((cita) => {
            const recordatorio = cita.estado !== 'Cancelada' && cita.estado !== 'Completada'
              ? obtenerEtiquetaRecordatorio(cita.fecha)
              : null;

            return (
              <div key={cita.idCita} className="cita-px-card">
                <div className="cita-px-card-header">
                  <div className="cita-px-fecha-hora">
                    <span><FaCalendarAlt /> {cita.fecha}</span>
                    <span><FaClock /> {cita.hora} hrs</span>
                  </div>

                  {recordatorio ? (
                    <span className={`badge-recordatorio-px ${recordatorio.clase}`}>
                      <FaBell /> {recordatorio.texto}
                    </span>
                  ) : (
                    <span className={`badge-estado-cita badge-${(cita.estado || 'Programada').toLowerCase()}`}>
                      {cita.estado}
                    </span>
                  )}
                </div>

                <div className="cita-px-body">
                  <h3 className="cita-px-medico">
                    <FaUserMd style={{ color: '#3498db' }} /> Dr(a). {cita.nombreMedico}
                  </h3>
                  {cita.especialidadMedico && (
                    <span className="cita-px-esp">{cita.especialidadMedico}</span>
                  )}

                  <div className="cita-px-motivo-box">
                    <strong><FaNotesMedical /> Motivo de la cita:</strong>
                    <p>{cita.motivo}</p>
                  </div>

                  {cita.notas && (
                    <div className="cita-px-indicaciones">
                      <strong>Indicaciones previas del médico:</strong>
                      <p>{cita.notas}</p>
                    </div>
                  )}

                  <div className="cita-px-contacto">
                    {cita.direccionMedico && (
                      <span><FaMapMarkerAlt /> {cita.direccionMedico}</span>
                    )}
                    {cita.telefonoMedico && (
                      <span><FaPhoneAlt /> Tel: {cita.telefonoMedico}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CitasPaciente;