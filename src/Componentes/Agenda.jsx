import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { ref, onValue, set, push, update, remove, get } from 'firebase/database';
import { 
  FaArrowLeft, FaCalendarPlus, FaChevronLeft, FaChevronRight, 
  FaClock, FaUserInjured, FaEdit, FaTrashAlt, FaTimes, 
  FaSave, FaCheckCircle, FaLock, FaCalendarDay, FaFolderOpen 
} from 'react-icons/fa';
import { estaVigenciaVencida } from '../utilidades/verificadorVigencia';
import { evaluarYNotificarCita } from '../utilidades/verificadorCitas';
import '../Estilos/Agenda.css';

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const formatearFechaISO = (anio, mes, dia) => {
  return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

const obtenerHoyISO = () => {
  const h = new Date();
  return formatearFechaISO(h.getFullYear(), h.getMonth(), h.getDate());
};

const Agenda = () => {
  const myuid = auth.currentUser?.uid;

  const [citas, setCitas] = useState([]);
  const [misPacientes, setMisPacientes] = useState([]);
  const [nombreMedico, setNombreMedico] = useState('Médico');
  const [especialidadMedico, setEspecialidadMedico] = useState('');
  const [telefonoMedico, setTelefonoMedico] = useState('');
  const [direccionMedico, setDireccionMedico] = useState('');
  const [cargando, setCargando] = useState(true);

  const [vigenciaVencida, setVigenciaVencida] = useState(
    localStorage.getItem('vigenciaVencida') === 'true'
  );

  // Control del Calendario
  const hoy = new Date();
  const [mesActual, setMesActual] = useState(hoy.getMonth());
  const [anioActual, setAnioActual] = useState(hoy.getFullYear());
  const [fechaSeleccionada, setFechaSeleccionada] = useState(obtenerHoyISO());

  // Estados del Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [uidPxAnterior, setUidPxAnterior] = useState(null);

  const [formData, setFormData] = useState({
    uidPx: '',
    fecha: obtenerHoyISO(),
    hora: '09:00',
    motivo: '',
    notas: '',
    estado: 'Programada'
  });

  useEffect(() => {
    if (!myuid) return;

    // 1. Cargar datos del médico y verificar vigencia
    const cargarPerfilMedico = async () => {
      const ramas = ['medico', 'admin', 'otro'];
      for (const r of ramas) {
        const snap = await get(ref(db, `usuarios/${r}/${myuid}`));
        if (snap.exists()) {
          const data = snap.val();
          setNombreMedico(data.nombre || data.nombrecom || 'Médico');
          setEspecialidadMedico(data.especialidad1 || 'Médico Cirujano y Partero');
          setTelefonoMedico(data.num_cel || data.celular || '');
          setDireccionMedico(data.direccion || '');

          if (r === 'medico' || String(data.rol || '').toLowerCase() === 'medico') {
            const vencida = estaVigenciaVencida(data.vigencia);
            setVigenciaVencida(vencida);
            localStorage.setItem('vigenciaVencida', vencida ? 'true' : 'false');
          } else {
            setVigenciaVencida(false);
          }
          break;
        }
      }
    };
    cargarPerfilMedico();

    // 2. Cargar pacientes asignados al médico (px/[myuid]) y cruzarlos con usuarios/px
    const relRef = ref(db, `px/${myuid}`);
    const unsubPacientes = onValue(relRef, async (snapRel) => {
      if (snapRel.exists()) {
        const idsAsignados = Object.keys(snapRel.val());
        const snapGlobal = await get(ref(db, 'usuarios/px'));
        if (snapGlobal.exists()) {
          const globalData = snapGlobal.val();
          const lista = idsAsignados
            .filter((idPx) => Boolean(globalData[idPx]))
            .map((idPx) => ({
              uid: idPx,
              nombre: globalData[idPx].nombre || globalData[idPx].nombrecom || 'Paciente sin nombre',
              celular: globalData[idPx].num_cel || globalData[idPx].celular || '',
              correo: globalData[idPx].correo || ''
            }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
          setMisPacientes(lista);
        }
      } else {
        setMisPacientes([]);
      }
    });

    // 3. Escuchar las citas de la agenda del médico
    const agendaRef = ref(db, `agenda/${myuid}`);
    const unsubAgenda = onValue(agendaRef, (snapshot) => {
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

    return () => {
      unsubPacientes();
      unsubAgenda();
    };
  }, [myuid]);

  // Navegación de meses en el calendario
  const cambiarMes = (delta) => {
    let nuevoMes = mesActual + delta;
    let nuevoAnio = anioActual;
    if (nuevoMes > 11) {
      nuevoMes = 0;
      nuevoAnio++;
    } else if (nuevoMes < 0) {
      nuevoMes = 11;
      nuevoAnio--;
    }
    setMesActual(nuevoMes);
    setAnioActual(nuevoAnio);
  };

  // Generar cuadrícula del mes actual
  const generarDiasCalendario = () => {
    const primerDiaSemana = new Date(anioActual, mesActual, 1).getDay();
    const totalDiasMes = new Date(anioActual, mesActual + 1, 0).getDate();
    const celdas = [];

    for (let i = 0; i < primerDiaSemana; i++) {
      celdas.push(null);
    }
    for (let d = 1; d <= totalDiasMes; d++) {
      celdas.push(d);
    }
    return celdas;
  };

  const abrirModalNuevaCita = (fechaPreseleccionada = fechaSeleccionada) => {
    if (vigenciaVencida) {
      return alert("⛔ Modo de solo lectura: Tu vigencia está vencida y no puedes agendar nuevas citas.");
    }
    if (misPacientes.length === 0) {
      return alert("Primero debes tener al menos un paciente registrado en 'Mis Pacientes' para poder agendarle una cita.");
    }
    setIsEditing(false);
    setEditId(null);
    setUidPxAnterior(null);
    setFormData({
      uidPx: misPacientes[0]?.uid || '',
      fecha: fechaPreseleccionada || obtenerHoyISO(),
      hora: '09:00',
      motivo: '',
      notas: '',
      estado: 'Programada'
    });
    setIsModalOpen(true);
  };

  const abrirModalEditarCita = (cita) => {
    if (vigenciaVencida) {
      return alert("⛔ Modo de solo lectura: No puedes modificar citas con vigencia vencida.");
    }
    setIsEditing(true);
    setEditId(cita.idCita);
    setUidPxAnterior(cita.uidPx);
    setFormData({
      uidPx: cita.uidPx || '',
      fecha: cita.fecha || fechaSeleccionada,
      hora: cita.hora || '09:00',
      motivo: cita.motivo || '',
      notas: cita.notas || '',
      estado: cita.estado || 'Programada'
    });
    setIsModalOpen(true);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGuardarCita = async (e) => {
    e.preventDefault();
    if (!myuid) return;
    if (vigenciaVencida) {
      return alert("⛔ Acción bloqueada: Tu vigencia está vencida.");
    }
    if (!formData.uidPx) {
      return alert("Selecciona un paciente de tu lista.");
    }

    try {
      const pxEncontrado = misPacientes.find((p) => p.uid === formData.uidPx);
      const nombrePx = pxEncontrado ? pxEncontrado.nombre : 'Paciente';
      const celularPx = pxEncontrado ? pxEncontrado.celular : '';

      const idCitaFinal = isEditing ? editId : push(ref(db, `agenda/${myuid}`)).key;

      const objetoCita = {
        idCita: idCitaFinal,
        uidMedico: myuid,
        nombreMedico,
        especialidadMedico,
        telefonoMedico,
        direccionMedico,
        uidPx: formData.uidPx,
        nombrePx,
        celularPx,
        fecha: formData.fecha,
        hora: formData.hora,
        motivo: formData.motivo.trim(),
        notas: formData.notas.trim(),
        estado: formData.estado,
        timestamp: Date.now()
      };

      // Si al editar cambió de paciente, borramos la cita del nodo del paciente anterior
      if (isEditing && uidPxAnterior && uidPxAnterior !== formData.uidPx) {
        await remove(ref(db, `citas_px/${uidPxAnterior}/${idCitaFinal}`));
      }

      // Guardar en la agenda del médico y en el nodo de citas del paciente
      await set(ref(db, `agenda/${myuid}/${idCitaFinal}`), objetoCita);
      await set(ref(db, `citas_px/${formData.uidPx}/${idCitaFinal}`), objetoCita);

      // Evaluar si aplica disparar recordatorio inmediato (5, 2, 1 o 0 días)
      await evaluarYNotificarCita(objetoCita);

      setFechaSeleccionada(formData.fecha);
      setIsModalOpen(false);
      alert(isEditing ? "Cita actualizada correctamente." : "Cita agendada exitosamente.");
    } catch (error) {
      console.error("Error al guardar cita:", error);
      alert("Ocurrió un error al guardar la cita.");
    }
  };

  const handleEliminarCita = async (cita) => {
    if (vigenciaVencida) {
      return alert("⛔ Acción bloqueada: No puedes eliminar citas con vigencia vencida.");
    }
    const confirmar = window.confirm(
      `¿Deseas eliminar permanentemente la cita de "${cita.nombrePx}" del día ${cita.fecha} a las ${cita.hora}?`
    );
    if (!confirmar) return;

    try {
      await remove(ref(db, `agenda/${myuid}/${cita.idCita}`));
      if (cita.uidPx) {
        await remove(ref(db, `citas_px/${cita.uidPx}/${cita.idCita}`));
      }
    } catch (error) {
      console.error("Error al eliminar cita:", error);
      alert("No se pudo eliminar la cita.");
    }
  };

  const cambiarEstadoRapido = async (cita, nuevoEstado) => {
    if (vigenciaVencida) return;
    try {
      await update(ref(db, `agenda/${myuid}/${cita.idCita}`), { estado: nuevoEstado });
      if (cita.uidPx) {
        await update(ref(db, `citas_px/${cita.uidPx}/${cita.idCita}`), { estado: nuevoEstado });
      }
    } catch (e) {
      console.error("Error al cambiar estado de cita:", e);
    }
  };

  const citasDelDiaSeleccionado = citas.filter((c) => c.fecha === fechaSeleccionada);
  const hoyISO = obtenerHoyISO();
  const proximasCitas = citas.filter((c) => c.fecha >= hoyISO && c.estado !== 'Cancelada').slice(0, 8);

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '60px' }}>Cargando agenda médica...</div>;

  return (
    <div className="agenda-container">
      
      {/* BANNER MODO SOLO LECTURA SI VIGENCIA VENCIDA */}
      {vigenciaVencida && (
        <div className="agenda-banner-vencido">
          <FaLock />
          <span>
            <strong>Modo Solo Lectura (Vigencia Vencida):</strong> Puedes consultar tu calendario de citas, pero no puedes agendar, modificar ni eliminar registros.
          </span>
        </div>
      )}

      {/* CABECERA */}
      <div className="agenda-header">
        <Link to="/" className="btn-regresar-agenda">
          <FaArrowLeft /> Volver al Panel de Control
        </Link>

        <div className="agenda-title-row">
          <div>
            <h2 className="agenda-titulo"><FaCalendarDay /> Agenda Médica</h2>
            <p className="agenda-subtitulo">
              Selecciona un día en el calendario para consultar o programar citas con tus pacientes
            </p>
          </div>

          {!vigenciaVencida && (
            <button onClick={() => abrirModalNuevaCita(fechaSeleccionada)} className="btn-nueva-cita">
              <FaCalendarPlus /> Agendar Nueva Cita
            </button>
          )}
        </div>
      </div>

      {/* DISEÑO EN 2 COLUMNAS: CALENDARIO MENSUAL + CITAS DEL DÍA */}
      <div className="agenda-layout">
        
        {/* COLUMNA IZQUIERDA: CALENDARIO INTERACTIVO */}
        <div className="calendario-card">
          <div className="calendario-nav">
            <button type="button" onClick={() => cambiarMes(-1)} className="btn-cal-nav">
              <FaChevronLeft />
            </button>
            <h3>{MESES[mesActual]} {anioActual}</h3>
            <button type="button" onClick={() => cambiarMes(1)} className="btn-cal-nav">
              <FaChevronRight />
            </button>
          </div>

          <div className="calendario-grid-header">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="cal-dia-nombre">{d}</div>
            ))}
          </div>

          <div className="calendario-grid-body">
            {generarDiasCalendario().map((dia, index) => {
              if (!dia) {
                return <div key={`empty-${index}`} className="cal-celda cal-celda-vacia" />;
              }

              const fechaCeldaISO = formatearFechaISO(anioActual, mesActual, dia);
              const citasEnEsteDia = citas.filter((c) => c.fecha === fechaCeldaISO && c.estado !== 'Cancelada');
              const esSeleccionado = fechaCeldaISO === fechaSeleccionada;
              const esHoy = fechaCeldaISO === hoyISO;

              return (
                <div
                  key={fechaCeldaISO}
                  onClick={() => setFechaSeleccionada(fechaCeldaISO)}
                  className={`cal-celda ${esSeleccionado ? 'cal-seleccionado' : ''} ${esHoy ? 'cal-hoy' : ''}`}
                >
                  <span className="cal-numero-dia">{dia}</span>
                  {citasEnEsteDia.length > 0 && (
                    <span className="cal-badge-citas">
                      {citasEnEsteDia.length} {citasEnEsteDia.length === 1 ? 'cita' : 'citas'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="calendario-footer-info">
            <span>🟢 Los recordatorios automáticos se envían al médico y al paciente faltando <strong>5, 2, 1</strong> y el <strong>mismo día</strong>.</span>
          </div>
        </div>

        {/* COLUMNA DERECHA: DETALLE DEL DÍA SELECCIONADO Y PRÓXIMAS CITAS */}
        <div className="agenda-detalle-col">
          
          <div className="agenda-dia-card">
            <div className="agenda-dia-header">
              <h3>Citas para el {fechaSeleccionada}</h3>
              {!vigenciaVencida && (
                <button 
                  type="button" 
                  onClick={() => abrirModalNuevaCita(fechaSeleccionada)} 
                  className="btn-agendar-mini"
                >
                  <FaCalendarPlus /> + Agendar en esta fecha
                </button>
              )}
            </div>

            {citasDelDiaSeleccionado.length === 0 ? (
              <div className="agenda-dia-vacio">
                <p>No hay citas programadas para esta fecha.</p>
              </div>
            ) : (
              <div className="lista-citas-dia">
                {citasDelDiaSeleccionado.map((cita) => (
                  <div key={cita.idCita} className={`cita-item estado-${(cita.estado || 'Programada').toLowerCase()}`}>
                    <div className="cita-hora-box">
                      <FaClock />
                      <span>{cita.hora}</span>
                    </div>

                    <div className="cita-info-box">
                      <div className="cita-top-line">
                        <h4>
                          <FaUserInjured style={{ color: '#3498db', marginRight: '6px' }} />
                          {cita.nombrePx}
                        </h4>
                        <span className={`badge-estado-cita badge-${(cita.estado || 'Programada').toLowerCase()}`}>
                          {cita.estado || 'Programada'}
                        </span>
                      </div>

                      <p className="cita-motivo"><strong>Motivo:</strong> {cita.motivo}</p>
                      {cita.notas && <p className="cita-notas"><strong>Indicaciones / Notas:</strong> {cita.notas}</p>}

                      <div className="cita-actions-row">
                        <Link to={`/px/${cita.uidPx}`} className="btn-cita-exp">
                          <FaFolderOpen /> Ir al Expediente
                        </Link>

                        {!vigenciaVencida && (
                          <>
                            {cita.estado !== 'Completada' && (
                              <button 
                                type="button" 
                                onClick={() => cambiarEstadoRapido(cita, 'Completada')} 
                                className="btn-cita-ok"
                                title="Marcar como completada"
                              >
                                <FaCheckCircle /> Completar
                              </button>
                            )}
                            <button 
                              type="button" 
                              onClick={() => abrirModalEditarCita(cita)} 
                              className="btn-cita-edit"
                            >
                              <FaEdit /> Editar
                            </button>
                            <button 
                              type="button" 
                              onClick={() => handleEliminarCita(cita)} 
                              className="btn-cita-del"
                            >
                              <FaTrashAlt />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RESUMEN DE PRÓXIMAS CITAS */}
          <div className="agenda-proximas-card">
            <h4>Próximas Citas Programadas ({proximasCitas.length})</h4>
            {proximasCitas.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>Sin citas próximas pendientes.</p>
            ) : (
              <div className="proximas-mini-list">
                {proximasCitas.map((c) => (
                  <div 
                    key={c.idCita} 
                    onClick={() => setFechaSeleccionada(c.fecha)} 
                    className="proxima-mini-item"
                  >
                    <div>
                      <strong>{c.nombrePx}</strong>
                      <small style={{ display: 'block', color: '#64748b' }}>{c.motivo}</small>
                    </div>
                    <span className="proxima-fecha-tag">{c.fecha} • {c.hora}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* MODAL PARA CREAR / EDITAR CITA */}
      {isModalOpen && !vigenciaVencida && (
        <div className="agenda-modal-overlay">
          <div className="agenda-modal-content">
            <div className="agenda-modal-header">
              <h3>{isEditing ? 'Editar Cita Médica' : 'Agendar Nueva Cita'}</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn-close-agenda">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleGuardarCita} className="agenda-form">
              <div className="agenda-field">
                <label>Seleccionar Paciente (de Mis Pacientes) *</label>
                <select name="uidPx" value={formData.uidPx} onChange={handleChange} required>
                  <option value="">-- Seleccione un paciente --</option>
                  {misPacientes.map((px) => (
                    <option key={px.uid} value={px.uid}>
                      {px.nombre} {px.celular ? `(${px.celular})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="agenda-grid-3">
                <div className="agenda-field">
                  <label>Fecha de la Cita *</label>
                  <input type="date" name="fecha" value={formData.fecha} onChange={handleChange} required />
                </div>

                <div className="agenda-field">
                  <label>Hora *</label>
                  <input type="time" name="hora" value={formData.hora} onChange={handleChange} required />
                </div>

                <div className="agenda-field">
                  <label>Estado</label>
                  <select name="estado" value={formData.estado} onChange={handleChange}>
                    <option value="Programada">Programada</option>
                    <option value="Confirmada">Confirmada</option>
                    <option value="Completada">Completada</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                </div>
              </div>

              <div className="agenda-field">
                <label>Motivo de la Consulta *</label>
                <input 
                  type="text" 
                  name="motivo" 
                  value={formData.motivo} 
                  onChange={handleChange} 
                  placeholder="Ej. Consulta de seguimiento, Revisión de estudios, Control..." 
                  required 
                />
              </div>

              <div className="agenda-field">
                <label>Indicaciones previas para el paciente / Notas (Opcional)</label>
                <textarea 
                  name="notas" 
                  value={formData.notas} 
                  onChange={handleChange} 
                  rows="3" 
                  placeholder="Ej. Acudir en ayuno de 8 horas, traer resultados de laboratorio..."
                />
              </div>

              <div className="agenda-modal-actions">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-agenda-cancel">
                  Cancelar
                </button>
                <button type="submit" className="btn-agenda-save">
                  <FaSave /> {isEditing ? 'Actualizar Cita' : 'Guardar Cita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Agenda;