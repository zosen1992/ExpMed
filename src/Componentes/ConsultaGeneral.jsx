import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { ref, onValue, set, push, update, remove, get } from 'firebase/database';
import { 
  FaArrowLeft, FaPlus, FaSearch, FaCalendarAlt, FaEraser, 
  FaEye, FaEdit, FaTrashAlt, FaTimes, FaSave, FaUserAlt, 
  FaNotesMedical, FaHeartbeat, FaPills, FaPrint, FaLock 
} from 'react-icons/fa';
import { MdOutlineGroups } from 'react-icons/md';
import ModalReceta from './ModalReceta';
import { estaVigenciaVencida } from '../utilidades/verificadorVigencia';
import '../Estilos/ConsultaGeneral.css';

const ConsultaGeneral = () => {
  const myuid = auth.currentUser?.uid;

  const [consultas, setConsultas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nombreMedico, setNombreMedico] = useState('');
  const [perfilMedico, setPerfilMedico] = useState({});
  const [vigenciaVencida, setVigenciaVencida] = useState(
    localStorage.getItem('vigenciaVencida') === 'true'
  );

  const [busquedaNombre, setBusquedaNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [editId, setEditId] = useState(null);

  // Estado para la Vista Previa de Receta
  const [recetaActiva, setRecetaActiva] = useState(null);

  const [formData, setFormData] = useState({
    nombrePx: '',
    edad: '',
    sexo: 'N/E',
    alergias: 'Negadas',
    ta: '',
    fc: '',
    temp: '',
    spo2: '',
    peso: '',
    motivoNota: '',
    diagnostico: '',
    tratamiento: '',
    firma: ''
  });

  useEffect(() => {
    if (!myuid) return;

    // 1. Obtener datos completos del médico y validar su vigencia
    const cargarMedico = async () => {
      const snap = await get(ref(db, `usuarios/medico/${myuid}`));
      if (snap.exists()) {
        const data = snap.val();
        setPerfilMedico(data);
        setNombreMedico(data.nombre || data.nombrecom || 'Médico');

        const vencida = estaVigenciaVencida(data.vigencia);
        setVigenciaVencida(vencida);
        localStorage.setItem('vigenciaVencida', vencida ? 'true' : 'false');
      } else {
        setNombreMedico(auth.currentUser?.email || 'Médico');
      }
    };
    cargarMedico();

    // 2. Cargar consultas rápidas creadas por este médico
    const cgRef = ref(db, `consultageneral/${myuid}`);
    const unsubscribe = onValue(cgRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const lista = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(item => item.uidMedico === myuid)
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setConsultas(lista);
      } else {
        setConsultas([]);
      }
      setCargando(false);
    });

    return () => unsubscribe();
  }, [myuid]);

  // Armar el objeto de Receta y abrir la vista previa
  const abrirVistaPreviaReceta = (item) => {
    const listaEsp = [];
    if (perfilMedico.especialidad1) {
      listaEsp.push({
        nombre: perfilMedico.especialidad1,
        cedula: perfilMedico.cedula_esp1,
        universidad: perfilMedico.universidad_esp1
      });
    }
    if (perfilMedico.especialidad2) {
      listaEsp.push({
        nombre: perfilMedico.especialidad2,
        cedula: perfilMedico.cedula_esp2,
        universidad: perfilMedico.universidad_esp2
      });
    }
    if (perfilMedico.especialidad3) {
      listaEsp.push({
        nombre: perfilMedico.especialidad3,
        cedula: perfilMedico.cedula_esp3,
        universidad: perfilMedico.universidad_esp3
      });
    }

    setRecetaActiva({
      nombreMedico: item.firma || nombreMedico,
      universidad: perfilMedico.universidad || '',
      cedulaPartero: perfilMedico.cedula_partero || perfilMedico.cedula || '',
      especialidades: listaEsp,
      direccionMedico: perfilMedico.direccion || '',
      localidadMedico: perfilMedico.localidad || '',
      telefonoMedico: perfilMedico.num_cel || perfilMedico.celular || '',
      correoMedico: perfilMedico.correo || '',
      firmaMedico: perfilMedico.firma || '',
      nombrePx: item.nombrePx || 'Paciente',
      edadPx: item.edad || '',
      sexoPx: item.sexo || '',
      alergiasPx: item.alergias || 'Negadas',
      ta: item.ta || '',
      fc: item.fc || '',
      temp: item.temp || '',
      spo2: item.spo2 || '',
      peso: item.peso || '',
      folio: item.id || '001',
      fecha: item.fecha || new Date().toLocaleDateString('es-MX'),
      diagnostico: item.diagnostico || '',
      tratamiento: item.tratamiento || ''
    });
  };

  const extraerFechaISO = (item) => {
    if (item.fechaISO) return item.fechaISO;
    if (!item.fecha) return '';
    const soloFecha = item.fecha.split(',')[0].split(' ')[0].trim();
    const partes = soloFecha.includes('/') ? soloFecha.split('/') : soloFecha.split('-');
    if (partes.length === 3) {
      if (partes[2].length === 4) return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
      if (partes[0].length === 4) return `${partes[0]}-${partes[1].padStart(2, '0')}-${partes[2].padStart(2, '0')}`;
    }
    return '';
  };

  const abrirModalNuevo = () => {
    if (vigenciaVencida) {
      return alert("⛔ Modo de solo lectura: Tu vigencia está vencida y no puedes crear nuevas notas rápidas.");
    }
    setIsEditing(false);
    setIsReadOnly(false);
    setEditId(null);
    setFormData({
      nombrePx: '',
      edad: '',
      sexo: 'N/E',
      alergias: 'Negadas',
      ta: '',
      fc: '',
      temp: '',
      spo2: '',
      peso: '',
      motivoNota: '',
      diagnostico: '',
      tratamiento: '',
      firma: nombreMedico
    });
    setIsModalOpen(true);
  };

  const abrirModalRegistro = (item, modoLectura = false) => {
    if (item.uidMedico !== myuid) {
      return alert("Acceso denegado: Solo el médico que creó esta nota puede visualizarla o editarla.");
    }
    if (vigenciaVencida) {
      modoLectura = true;
    }

    setIsEditing(!modoLectura);
    setIsReadOnly(modoLectura);
    setEditId(item.id);
    setFormData({
      nombrePx: item.nombrePx || '',
      edad: item.edad || '',
      sexo: item.sexo || 'N/E',
      alergias: item.alergias || 'Negadas',
      ta: item.ta || '',
      fc: item.fc || '',
      temp: item.temp || '',
      spo2: item.spo2 || '',
      peso: item.peso || '',
      motivoNota: item.motivoNota || '',
      diagnostico: item.diagnostico || '',
      tratamiento: item.tratamiento || '',
      firma: item.firma || nombreMedico
    });
    setIsModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!myuid) return alert("Error: Sesión no válida.");
    if (vigenciaVencida) {
      return alert("⛔ Acción bloqueada: Tu cuenta está en modo solo lectura por vigencia vencida.");
    }

    try {
      const ahora = new Date();
      const fechaActual = ahora.toLocaleString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      const hoyISO = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;

      if (isEditing) {
        await update(ref(db, `consultageneral/${myuid}/${editId}`), {
          ...formData,
          ultimaModificacion: fechaActual
        });
        alert("Nota médica rápida actualizada correctamente.");
      } else {
        const nuevaRef = push(ref(db, `consultageneral/${myuid}`));
        await set(nuevaRef, {
          ...formData,
          id: nuevaRef.key,
          uidMedico: myuid,
          firma: nombreMedico,
          fecha: fechaActual,
          fechaISO: hoyISO,
          timestamp: Date.now()
        });
        alert("Nota médica rápida guardada exitosamente.");
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error al guardar consulta rápida:", error);
      alert("Ocurrió un error al guardar la nota.");
    }
  };

  const handleEliminar = async (item) => {
    if (vigenciaVencida) {
      return alert("⛔ Acción bloqueada: No puedes eliminar notas con vigencia vencida.");
    }
    if (item.uidMedico !== myuid) return;
    if (window.confirm(`¿Deseas eliminar permanentemente la nota rápida de "${item.nombrePx}"?`)) {
      try {
        await remove(ref(db, `consultageneral/${myuid}/${item.id}`));
      } catch (error) {
        console.error("Error al eliminar:", error);
      }
    }
  };

  const limpiarFiltros = () => {
    setBusquedaNombre('');
    setFechaInicio('');
    setFechaFin('');
  };

  const consultasFiltradas = consultas.filter((item) => {
    const coincideNombre = !busquedaNombre || 
      (item.nombrePx || '').toLowerCase().includes(busquedaNombre.trim().toLowerCase());

    const fechaItem = extraerFechaISO(item);
    let coincideFecha = true;
    if (fechaInicio && fechaItem) coincideFecha = coincideFecha && (fechaItem >= fechaInicio);
    if (fechaFin && fechaItem) coincideFecha = coincideFecha && (fechaItem <= fechaFin);

    return coincideNombre && coincideFecha;
  });

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '60px' }}>Cargando notas de consulta general...</div>;

  return (
    <div className='cg-container'>
      
      {/* BANNER DE VIGENCIA VENCIDA */}
      {vigenciaVencida && (
        <div style={{
          backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba',
          borderRadius: '10px', padding: '12px 16px', marginBottom: '18px',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <FaLock />
          <span>
            <strong>Modo Solo Lectura (Vigencia Vencida):</strong> Solo puedes consultar tus notas rápidas previas. No está permitido crear, editar ni eliminar registros.
          </span>
        </div>
      )}

      {/* CABECERA */}
      <div className='cg-header'>
        <Link to="/" className='btn-regresar-cg'>
          <FaArrowLeft /> Volver al Panel Principal
        </Link>

        <div className='cg-title-row'>
          <div>
            <h2 className='cg-titulo'><MdOutlineGroups /> Consulta General (Notas Rápidas)</h2>
            <p className='cg-subtitulo'>Atención ambulatoria sin apertura de expediente • Visible únicamente para ti</p>
          </div>

          {!vigenciaVencida && (
            <button onClick={abrirModalNuevo} className='btn-nueva-cg'>
              <FaPlus /> Nueva Nota Rápida
            </button>
          )}
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA Y FECHAS */}
      {consultas.length > 0 && (
        <div className='cg-filtros-card'>
          <div className='cg-search-box'>
            <label><FaSearch /> Buscar Paciente Genérico:</label>
            <input 
              type="text" 
              placeholder="Escribe el nombre del paciente..." 
              value={busquedaNombre}
              onChange={(e) => setBusquedaNombre(e.target.value)}
            />
          </div>

          <div className='cg-dates-box'>
            <div className='cg-date-field'>
              <label><FaCalendarAlt /> Desde:</label>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>

            <div className='cg-date-field'>
              <label><FaCalendarAlt /> Hasta:</label>
              <input type="date" value={fechaFin} min={fechaInicio} onChange={(e) => setFechaFin(e.target.value)} />
            </div>

            {(busquedaNombre || fechaInicio || fechaFin) && (
              <button onClick={limpiarFiltros} className='btn-limpiar-cg'>
                <FaEraser /> Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      {/* LISTA DE NOTAS RÁPIDAS */}
      {consultas.length === 0 ? (
        <div className='cg-empty'>
          <FaNotesMedical className='cg-empty-icon' />
          <h3>No tienes notas médicas rápidas registradas</h3>
          <p>
            {vigenciaVencida
              ? 'Con vigencia vencida no puedes registrar nuevas notas médicas rápidas.'
              : 'Utiliza este espacio para registrar consultas de primera vez o ambulatorias que no requieren seguimiento en expediente.'}
          </p>
          {!vigenciaVencida && (
            <button onClick={abrirModalNuevo} className='btn-nueva-cg' style={{ margin: '15px auto 0 auto' }}>
              <FaPlus /> Crear Primera Nota Rápida
            </button>
          )}
        </div>
      ) : consultasFiltradas.length === 0 ? (
        <div className='cg-empty'>
          <FaSearch className='cg-empty-icon' />
          <h3>No se encontraron coincidencias</h3>
          <p>Ninguna nota rápida coincide con el nombre o rango de fechas seleccionado.</p>
          <button onClick={limpiarFiltros} className='btn-limpiar-cg' style={{ margin: '12px auto 0 auto' }}>
            <FaEraser /> Mostrar todas mis notas
          </button>
        </div>
      ) : (
        <div className='cg-list'>
          {consultasFiltradas.map((item) => (
            <div key={item.id} className='cg-card'>
              <div className='cg-card-info'>
                <div className='cg-card-top'>
                  <h3 className='cg-px-name'>
                    <FaUserAlt className='px-mini-icon' /> {item.nombrePx}
                  </h3>
                  <div className='cg-meta-pills'>
                    {item.edad && <span className='pill-meta'>{item.edad} años</span>}
                    {item.sexo && item.sexo !== 'N/E' && <span className='pill-meta'>{item.sexo}</span>}
                    <span className='cg-fecha'>{item.fecha}</span>
                  </div>
                </div>

                {(item.ta || item.temp || item.fc || item.spo2 || item.peso) && (
                  <div className='cg-sv-row'>
                    {item.ta && <span><strong>TA:</strong> {item.ta}</span>}
                    {item.fc && <span><strong>FC:</strong> {item.fc} lpm</span>}
                    {item.temp && <span><strong>Temp:</strong> {item.temp} °C</span>}
                    {item.spo2 && <span><strong>SpO2:</strong> {item.spo2}%</span>}
                    {item.peso && <span><strong>Peso:</strong> {item.peso} kg</span>}
                  </div>
                )}

                <div className='cg-resumen'>
                  <p><strong>Diagnóstico:</strong> {item.diagnostico}</p>
                  <p className='cg-nota-preview'><strong>Nota:</strong> {item.motivoNota}</p>
                  <p className='cg-nota-preview'><strong>Tratamiento:</strong> {item.tratamiento}</p>
                </div>
              </div>

              <div className='cg-card-actions'>
                <button onClick={() => abrirModalRegistro(item, true)} className='btn-cg-act btn-cg-ver'>
                  <FaEye /> Ver
                </button>
                
                {/* BOTÓN PARA IMPRIMIR PLAN / RECETA */}
                <button 
                  onClick={() => abrirVistaPreviaReceta(item)} 
                  className='btn-cg-act'
                  style={{ backgroundColor: '#e8f4fd', color: '#2980b9' }}
                  title="Imprimir receta médica"
                >
                  <FaPrint /> Imprimir Plan
                </button>

                {!vigenciaVencida && (
                  <>
                    <button onClick={() => abrirModalRegistro(item, false)} className='btn-cg-act btn-cg-edit'>
                      <FaEdit /> Editar
                    </button>
                    <button onClick={() => handleEliminar(item)} className='btn-cg-act btn-cg-del'>
                      <FaTrashAlt /> Eliminar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL FORMULARIO */}
      {isModalOpen && (
        <div className='cg-modal-overlay'>
          <div className='cg-modal-content'>
            <div className='cg-modal-header'>
              <h3>
                {isReadOnly ? 'Detalle de Consulta Rápida' : (isEditing ? 'Editar Nota Rápida' : 'Nueva Nota Médica Rápida')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className='btn-close-cg'><FaTimes /></button>
            </div>

            <form onSubmit={handleGuardar} className='cg-form'>
              <h4 className='cg-sec-title'><FaUserAlt /> Datos del Paciente (Sin Seguimiento)</h4>
              <div className='cg-grid-4'>
                <div className='cg-field cg-span-2'>
                  <label>Nombre del Paciente (Genérico) *</label>
                  <input type="text" name="nombrePx" value={formData.nombrePx} onChange={handleChange} placeholder="Ej. Juan Pérez (Ambulatorio)" required readOnly={isReadOnly} />
                </div>

                <div className='cg-field'>
                  <label>Edad</label>
                  <input type="text" name="edad" value={formData.edad} onChange={handleChange} placeholder="Ej. 32" readOnly={isReadOnly} />
                </div>

                <div className='cg-field'>
                  <label>Sexo</label>
                  <select name="sexo" value={formData.sexo} onChange={handleChange} disabled={isReadOnly}>
                    <option value="N/E">Sin especificar</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                </div>
              </div>

              <div className='cg-field'>
                <label>Alergias conocidas</label>
                <input type="text" name="alergias" value={formData.alergias} onChange={handleChange} placeholder="Negadas o especificar medicamento/alimento" readOnly={isReadOnly} />
              </div>

              <h4 className='cg-sec-title'><FaHeartbeat /> Signos Vitales Rápidos (Opcional)</h4>
              <div className='cg-grid-5'>
                <div className='cg-field'><label>T.A. (mmHg)</label><input type="text" name="ta" value={formData.ta} onChange={handleChange} placeholder="120/80" readOnly={isReadOnly} /></div>
                <div className='cg-field'><label>F.C. (lpm)</label><input type="text" name="fc" value={formData.fc} onChange={handleChange} placeholder="75" readOnly={isReadOnly} /></div>
                <div className='cg-field'><label>Temp (°C)</label><input type="text" name="temp" value={formData.temp} onChange={handleChange} placeholder="36.5" readOnly={isReadOnly} /></div>
                <div className='cg-field'><label>SpO2 (%)</label><input type="text" name="spo2" value={formData.spo2} onChange={handleChange} placeholder="98" readOnly={isReadOnly} /></div>
                <div className='cg-field'><label>Peso (kg)</label><input type="text" name="peso" value={formData.peso} onChange={handleChange} placeholder="70" readOnly={isReadOnly} /></div>
              </div>

              <h4 className='cg-sec-title'><FaPills /> Evaluación y Nota Médica</h4>
              <div className='cg-field'>
                <label>Motivo de Consulta y Nota Clínica (Padecimiento / Exploración) *</label>
                <textarea name="motivoNota" value={formData.motivoNota} onChange={handleChange} rows="4" required readOnly={isReadOnly} />
              </div>

              <div className='cg-field'>
                <label>Impresión Diagnóstica *</label>
                <input type="text" name="diagnostico" value={formData.diagnostico} onChange={handleChange} required readOnly={isReadOnly} />
              </div>

              <div className='cg-field'>
                <label>Plan de Manejo y Tratamiento *</label>
                <textarea name="tratamiento" value={formData.tratamiento} onChange={handleChange} rows="3" required readOnly={isReadOnly} />
              </div>

              <div className='cg-field'>
                <label>Médico Responsable (Privado)</label>
                <input type="text" value={formData.firma} readOnly className='cg-input-locked' />
              </div>

              <div className='cg-modal-actions'>
                <button 
                  type="button" 
                  onClick={() => abrirVistaPreviaReceta({ ...formData, id: editId || 'NUEVA', fecha: new Date().toLocaleDateString('es-MX') })} 
                  className='btn-cg-act'
                  style={{ backgroundColor: '#3498db', color: '#fff', padding: '10px 16px', marginRight: 'auto' }}
                >
                  <FaPrint /> Vista Previa e Imprimir Plan
                </button>

                <button type="button" onClick={() => setIsModalOpen(false)} className='btn-cg-cancel'>
                  {isReadOnly ? 'Cerrar' : 'Cancelar'}
                </button>
                {!isReadOnly && !vigenciaVencida && (
                  <button type="submit" className='btn-cg-save'>
                    <FaSave /> {isEditing ? 'Actualizar Nota' : 'Guardar Nota Rápida'}
                  </button>
                )}
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL VISTA PREVIA DE RECETA */}
      <ModalReceta 
        isOpen={!!recetaActiva} 
        onClose={() => setRecetaActiva(null)} 
        datosReceta={recetaActiva} 
      />

    </div>
  );
};

export default ConsultaGeneral;