import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { ref, onValue, set, push, update, remove, get } from 'firebase/database';
import { 
  FaArrowLeft, FaPlus, FaEdit, FaTrashAlt, FaTimes, 
  FaSave, FaEye, FaEyeSlash, FaUserMd, FaUserNurse, 
  FaSyringe, FaLock, FaCalendarAlt, FaEraser, FaPrint 
} from 'react-icons/fa';
import { GoBook } from "react-icons/go";
import ModalReceta from './ModalReceta';
import { estaVigenciaVencida } from '../utilidades/verificadorVigencia';
import '../Estilos/Consulta.css';

const Consulta = () => {
  const { id } = useParams(); // UID del paciente
  const navigate = useNavigate();
  const myuid = auth.currentUser?.uid; // UID del usuario logueado

  const [visitas, setVisitas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [rolUsuario, setRolUsuario] = useState(localStorage.getItem('rolActivo') || "");
  const [vigenciaVencida, setVigenciaVencida] = useState(
    localStorage.getItem('vigenciaVencida') === 'true'
  );

  // Datos para receta
  const [datosPx, setDatosPx] = useState({});
  const [alergiasTexto, setAlergiasTexto] = useState("Negadas");
  const [ultimoSv, setUltimoSv] = useState({});
  const [recetaActiva, setRecetaActiva] = useState(null);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  // Estados de Modales
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [tipoSeleccionado, setTipoSeleccionado] = useState("");
  
  const [isEditing, setIsEditing] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [editPid, setEditPid] = useState(null);

  const [formData, setFormData] = useState({});

  const calcularEdad = (fechaString) => {
    if (!fechaString) return '';
    let fechaNacimiento = new Date(fechaString);
    if (isNaN(fechaNacimiento.getTime()) && fechaString.includes('/')) {
      const partes = fechaString.split('/');
      if (partes.length === 3) fechaNacimiento = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
    }
    if (isNaN(fechaNacimiento.getTime())) return '';
    const hoy = new Date();
    let edadCalc = hoy.getFullYear() - fechaNacimiento.getFullYear();
    const m = hoy.getMonth() - fechaNacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < fechaNacimiento.getDate())) edadCalc--;
    return edadCalc;
  };

  useEffect(() => {
    if (myuid && id) {
      // 1. Obtener nombre, ROL y estado de VIGENCIA del usuario logueado
      const obtenerDatosUsuarioLogueado = async () => {
        const rolLocal = localStorage.getItem('rolActivo');
        const ramas = rolLocal 
          ? [rolLocal, 'medico', 'enfermeria', 'enfermero', 'enfemero', 'px', 'admin', 'otro'] 
          : ['medico', 'enfermeria', 'enfermero', 'enfemero', 'px', 'admin', 'otro'];

        for (const rama of ramas) {
          const snap = await get(ref(db, `usuarios/${rama}/${myuid}`));
          if (snap.exists()) {
            const data = snap.val();
            setNombreUsuario(data.nombre || data.nombrecom || auth.currentUser?.email || "Usuario");
            const rolDetectado = data.rol || rama;
            setRolUsuario(rolDetectado);

            const rolLow = String(rolDetectado).toLowerCase();
            if ((rama === 'px' || rolLow === 'px') && id !== myuid) {
              navigate(`/consulta/${myuid}`, { replace: true });
            }

            // Verificar si es Médico o Enfermería y si su vigencia está vencida
            if (rama === 'medico' || rama === 'enfermeria' || rama === 'enfermero' || rama === 'enfemero' || rolLow === 'medico' || rolLow.includes('enfermer')) {
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
      obtenerDatosUsuarioLogueado();

      // 2. Obtener datos del paciente, alergias y últimos signos vitales
      const pxRef = ref(db, `usuarios/px/${id}`);
      const unsubPx = onValue(pxRef, (snap) => {
        if (snap.exists()) setDatosPx(snap.val());
      });

      const alRef = ref(db, `alergias/${id}`);
      const unsubAl = onValue(alRef, (snap) => {
        if (snap.exists()) {
          const lista = Object.values(snap.val()).map(a => a.alergia).filter(Boolean);
          setAlergiasTexto(lista.length > 0 ? lista.join(', ') : 'Negadas');
        } else {
          setAlergiasTexto('Negadas');
        }
      });

      const svRef = ref(db, `signosvitales/${id}`);
      const unsubSv = onValue(svRef, (snap) => {
        if (snap.exists()) {
          const arr = Object.values(snap.val());
          setUltimoSv(arr[arr.length - 1] || {});
        }
      });

      // 3. Obtener registros de Visita Médica
      const visitasRef = ref(db, `visitamedica/${id}`);
      const unsubscribeVisitas = onValue(visitasRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const visitasArray = Object.keys(data).map(key => ({
            pid: key,
            ...data[key]
          })).reverse();
          setVisitas(visitasArray);
        } else {
          setVisitas([]);
        }
        setCargando(false);
      });

      return () => {
        unsubPx();
        unsubAl();
        unsubSv();
        unsubscribeVisitas();
      };
    }
  }, [id, myuid, navigate]);

  const rolNormalizado = rolUsuario.trim().toLowerCase();
  const rolLocal = (localStorage.getItem('rolActivo') || '').trim().toLowerCase();

  const esPx = rolLocal === 'px' || rolNormalizado === 'px' || rolNormalizado === 'paciente';
  const esMedico = !esPx && (rolLocal === 'medico' || rolNormalizado === 'medico' || rolNormalizado === 'médico');
  const esEnfermero = !esPx && (rolLocal === 'enfermeria' || rolNormalizado.includes('enfermer'));

  const abrirVistaPreviaReceta = async (notaItem) => {
    if (!esMedico) return;
    const uidMedicoNota = notaItem.uidg || myuid;
    let infoMedico = {};

    try {
      const snapMed = await get(ref(db, `usuarios/medico/${uidMedicoNota}`));
      if (snapMed.exists()) {
        infoMedico = snapMed.val();
      }
    } catch (e) {
      console.error("Error al consultar médico para receta:", e);
    }

    const listaEsp = [];
    if (infoMedico.especialidad1) {
      listaEsp.push({ nombre: infoMedico.especialidad1, cedula: infoMedico.cedula_esp1, universidad: infoMedico.universidad_esp1 });
    }
    if (infoMedico.especialidad2) {
      listaEsp.push({ nombre: infoMedico.especialidad2, cedula: infoMedico.cedula_esp2, universidad: infoMedico.universidad_esp2 });
    }
    if (infoMedico.especialidad3) {
      listaEsp.push({ nombre: infoMedico.especialidad3, cedula: infoMedico.cedula_esp3, universidad: infoMedico.universidad_esp3 });
    }

    const edadCalculada = calcularEdad(datosPx.fecha_nac || datosPx.fechanacimiento);

    setRecetaActiva({
      nombreMedico: infoMedico.nombre || infoMedico.nombrecom || notaItem.Firma || nombreUsuario,
      universidad: infoMedico.universidad || '',
      cedulaPartero: infoMedico.cedula_partero || infoMedico.cedula || '',
      especialidades: listaEsp,
      direccionMedico: infoMedico.direccion || '',
      localidadMedico: infoMedico.localidad || '',
      telefonoMedico: infoMedico.num_cel || infoMedico.celular || '',
      correoMedico: infoMedico.correo || '',
      firmaMedico: infoMedico.firma || '',
      nombrePx: datosPx.nombre || datosPx.nombrecom || 'Paciente',
      edadPx: edadCalculada,
      sexoPx: datosPx.sexo || '',
      alergiasPx: alergiasTexto,
      ta: ultimoSv.tas && ultimoSv.tad ? `${ultimoSv.tas}/${ultimoSv.tad}` : '',
      fc: ultimoSv.fc || '',
      temp: ultimoSv.temp || '',
      spo2: ultimoSv.spo2 || '',
      peso: ultimoSv.peso || '',
      talla: ultimoSv.talla || '',
      imc: ultimoSv.imc || '',
      folio: notaItem.pid || '001',
      fecha: notaItem.fecha || new Date().toLocaleDateString('es-MX'),
      diagnostico: notaItem.diagnostico || '',
      tratamiento: notaItem.tratamiento || ''
    });
  };

  const extraerFechaISO = (item) => {
    if (item.fechaISO) return item.fechaISO;
    if (!item.fecha) return "";

    const soloFecha = item.fecha.split(',')[0].split(' ')[0].trim();
    const partes = soloFecha.includes('/') ? soloFecha.split('/') : soloFecha.split('-');
    
    if (partes.length === 3) {
      if (partes[2].length === 4) {
        return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
      }
      if (partes[0].length === 4) {
        return `${partes[0]}-${partes[1].padStart(2, '0')}-${partes[2].padStart(2, '0')}`;
      }
    }
    return "";
  };

  const iniciarFormularioNuevo = (tipo) => {
    if (esPx || vigenciaVencida) {
      return alert("⛔ Modo de solo lectura: Tu vigencia está vencida y no puedes agregar nuevos registros.");
    }
    if (esMedico && tipo === 'ENFERMERIA') {
      return alert("Restricción de Rol: Como Médico no puedes realizar Notas de Enfermería.");
    }
    if (esEnfermero && tipo === 'MEDICA') {
      return alert("Restricción de Rol: Como personal de Enfermería no puedes realizar Notas Médicas.");
    }

    setTipoSeleccionado(tipo);
    setIsSelectorOpen(false);
    setIsEditing(false);
    setIsReadOnly(false);
    setEditPid(null);

    if (tipo === 'MEDICA') {
      setFormData({
        motivo: '',
        exploracion: '',
        diagnostico: '',
        tratamiento: '',
        pronostico: 'Bueno para la vida y la función',
        oculto: false,
        Firma: nombreUsuario
      });
    } else if (tipo === 'ENFERMERIA') {
      setFormData({
        estadoGeneral: '',
        intervenciones: '',
        medicamentos: '',
        observaciones: '',
        Firma: nombreUsuario
      });
    } else if (tipo === 'PROCEDIMIENTO') {
      setFormData({
        nombreProcedimiento: '',
        diagnosticoPre: '',
        anestesia: 'Local',
        descripcionTecnica: '',
        complicaciones: 'Sin eventualidades',
        cuidadosPost: '',
        Firma: nombreUsuario
      });
    }
    setIsFormOpen(true);
  };

  const abrirRegistro = (item, modoLectura = false) => {
    if (esPx) {
      if (item.tipo !== 'PROCEDIMIENTO') return;
      modoLectura = true;
    }

    // Si la vigencia está vencida, forzar siempre modo lectura y solo sobre registros propios
    if (vigenciaVencida) {
      if (item.uidg !== myuid) return alert("Con vigencia vencida solo puedes visualizar registros creados por ti.");
      modoLectura = true;
    }

    if (!modoLectura && item.uidg !== myuid) {
      return alert("Acceso denegado: Solo el usuario que creó este registro puede editarlo.");
    }
    if (!modoLectura && esMedico && item.tipo === 'ENFERMERIA') {
      return alert("Restricción de Rol: Un perfil de Médico no puede editar Notas de Enfermería.");
    }
    if (!modoLectura && esEnfermero && item.tipo === 'MEDICA') {
      return alert("Restricción de Rol: Un perfil de Enfermería no puede editar Notas Médicas.");
    }

    setTipoSeleccionado(item.tipo);
    setIsEditing(!modoLectura);
    setIsReadOnly(modoLectura);
    setEditPid(item.pid);
    setFormData({
      ...item,
      Firma: item.Firma || nombreUsuario
    });
    setIsFormOpen(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!myuid || esPx || vigenciaVencida) {
      return alert("⛔ Acción bloqueada: Tu cuenta está en modo solo lectura por vigencia vencida.");
    }

    if (esEnfermero && tipoSeleccionado === 'MEDICA') {
      return alert("Acción bloqueada: El perfil de Enfermería no tiene permisos para guardar Notas Médicas.");
    }
    if (esMedico && tipoSeleccionado === 'ENFERMERIA') {
      return alert("Acción bloqueada: El perfil de Médico no tiene permisos para guardar Notas de Enfermería.");
    }

    try {
      const ahora = new Date();
      const fechaActual = ahora.toLocaleString('es-MX', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit'
      });
      const hoyISO = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;

      if (isEditing) {
        if (formData.uidg !== myuid) {
          return alert("No tienes permiso para modificar este registro.");
        }
        const datosActualizados = {
          ...formData,
          ultimaModificacion: fechaActual
        };
        await update(ref(db, `visitamedica/${id}/${editPid}`), datosActualizados);
        alert("Registro actualizado exitosamente.");
      } else {
        const nuevaVisitaRef = push(ref(db, `visitamedica/${id}`));
        const pidGenerado = nuevaVisitaRef.key;

        const nuevoRegistro = {
          ...formData,
          pid: pidGenerado,
          uid: id,
          uidg: myuid,
          Firma: nombreUsuario,
          tipo: tipoSeleccionado,
          fecha: fechaActual,
          fechaISO: hoyISO
        };

        await set(nuevaVisitaRef, nuevoRegistro);
        alert("Visita registrada correctamente.");
      }
      setIsFormOpen(false);
    } catch (error) {
      console.error("Error al guardar visita:", error);
      alert("Ocurrió un error al guardar la información.");
    }
  };

  const toggleOcultoRapido = async (item) => {
    if (esPx || vigenciaVencida || item.uidg !== myuid) {
      return alert("Acción no permitida en modo de vigencia vencida.");
    }
    try {
      const nuevoEstado = !item.oculto;
      await update(ref(db, `visitamedica/${id}/${item.pid}`), { oculto: nuevoEstado });
    } catch (error) {
      console.error("Error al cambiar visibilidad:", error);
    }
  };

  const handleEliminar = async (item) => {
    if (esPx || vigenciaVencida || item.uidg !== myuid) {
      return alert("Acción no permitida en modo de vigencia vencida.");
    }
    const confirmar = window.confirm("¿Estás seguro de que deseas eliminar este registro de forma permanente?");
    if (confirmar) {
      try {
        await remove(ref(db, `visitamedica/${id}/${item.pid}`));
        alert("Registro eliminado.");
      } catch (error) {
        console.error("Error al eliminar:", error);
        alert("No se pudo eliminar el registro.");
      }
    }
  };

  const limpiarFiltrosFecha = () => {
    setFechaInicio("");
    setFechaFin("");
  };

  // FILTRO BASE POR ROL Y VIGENCIA:
  // - Si es Paciente (esPx): Solo ve PROCEDIMIENTOS.
  // - Si tiene Vigencia Vencida (vigenciaVencida): Solo puede ver los registros que ÉL MISMO haya hecho (v.uidg === myuid).
  const visitasPermitidasPorRol = visitas.filter((v) => {
    if (esPx) return v.tipo === 'PROCEDIMIENTO';
    if (vigenciaVencida) return v.uidg === myuid;
    return true;
  });

  const visitasFiltradas = visitasPermitidasPorRol.filter((v) => {
    const coincideTipo = esPx ? v.tipo === 'PROCEDIMIENTO' : (filtroTipo === "TODOS" || v.tipo === filtroTipo);
    
    const fechaItem = extraerFechaISO(v);
    let coincideFecha = true;

    if (fechaInicio && fechaItem) coincideFecha = coincideFecha && (fechaItem >= fechaInicio);
    if (fechaFin && fechaItem) coincideFecha = coincideFecha && (fechaItem <= fechaFin);

    return coincideTipo && coincideFecha;
  });

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Cargando registros...</div>;

  return (
    <div className='visita-container'>
      
      {/* BANNER DE MODO VIGENCIA VENCIDA */}
      {vigenciaVencida && !esPx && (
        <div style={{
          backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba',
          borderRadius: '10px', padding: '12px 16px', marginBottom: '18px',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <FaLock />
          <span>
            <strong>Modo Solo Lectura (Vigencia Vencida):</strong> Solo se muestran los registros realizados por ti. No puedes agregar, editar ni eliminar información.
          </span>
        </div>
      )}

      {/* HEADER */}
      <div className='visita-header'>
        <Link to={`/px/${id}`} className='btn-regresar'>
          <FaArrowLeft /> Regresar al expediente
        </Link>
        <div className='visita-title-row'>
          <h2 className='visita-titulo'>
            {esPx ? <><FaSyringe /> Mis Procedimientos</> : <><GoBook /> Visita Médica</>}
          </h2>

          {/* El botón Añadir Visita se oculta si es Paciente o si tiene la Vigencia Vencida */}
          {!esPx && !vigenciaVencida && visitasPermitidasPorRol.length > 0 && (
            <button onClick={() => setIsSelectorOpen(true)} className='btn-anadir-top'>
              <FaPlus /> Añadir Visita
            </button>
          )}
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      {visitasPermitidasPorRol.length > 0 && (
        <div className='filtros-panel'>
          
          {!esPx && (
            <div className='visita-tabs'>
              <button className={filtroTipo === 'TODOS' ? 'tab-active' : ''} onClick={() => setFiltroTipo('TODOS')}>Todos ({visitasPermitidasPorRol.length})</button>
              <button className={filtroTipo === 'MEDICA' ? 'tab-active' : ''} onClick={() => setFiltroTipo('MEDICA')}><FaUserMd/> Notas Médicas</button>
              <button className={filtroTipo === 'ENFERMERIA' ? 'tab-active' : ''} onClick={() => setFiltroTipo('ENFERMERIA')}><FaUserNurse/> Enfermería</button>
              <button className={filtroTipo === 'PROCEDIMIENTO' ? 'tab-active' : ''} onClick={() => setFiltroTipo('PROCEDIMIENTO')}><FaSyringe/> Procedimientos</button>
            </div>
          )}

          <div className='filtro-fechas-bar'>
            <div className='fecha-label-main'>
              <FaCalendarAlt /> <span>Filtrar por fecha:</span>
            </div>
            
            <div className='fecha-inputs-group'>
              <div className='fecha-input-item'>
                <label>Desde:</label>
                <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
              </div>

              <div className='fecha-input-item'>
                <label>Hasta:</label>
                <input type="date" value={fechaFin} min={fechaInicio} onChange={(e) => setFechaFin(e.target.value)} />
              </div>

              {(fechaInicio || fechaFin) && (
                <button onClick={limpiarFiltrosFecha} className='btn-limpiar-fecha'>
                  <FaEraser /> Limpiar
                </button>
              )}
            </div>
          </div>

        </div>
      )}

      {/* LISTA DE VISITAS / PROCEDIMIENTOS */}
      {visitasPermitidasPorRol.length === 0 ? (
        <div className='empty-state'>
          {esPx ? <FaSyringe className='empty-icon' /> : <GoBook className='empty-icon' />}
          <h3>
            {esPx 
              ? 'No tienes procedimientos registrados' 
              : (vigenciaVencida ? 'No tienes registros propios en este paciente' : 'No existe información de visitas médicas')}
          </h3>
          <p>
            {esPx 
              ? 'Cuando el personal médico o de enfermería registre un procedimiento en tu expediente, podrás consultarlo aquí.' 
              : (vigenciaVencida 
                  ? 'Con vigencia vencida solo puedes visualizar registros que hayan sido creados por ti.' 
                  : 'Este paciente aún no cuenta con notas médicas, registros de enfermería ni procedimientos.')}
          </p>
          {!esPx && !vigenciaVencida && (
            <button onClick={() => setIsSelectorOpen(true)} className='btn-agregar-main'>
              <FaPlus /> Añadir Visita
            </button>
          )}
        </div>
      ) : visitasFiltradas.length === 0 ? (
        <div className='empty-state'>
          <FaCalendarAlt className='empty-icon' />
          <h3>Sin resultados para este filtro</h3>
          <p>No se encontraron registros que coincidan con el rango de fechas seleccionado.</p>
          <button onClick={limpiarFiltrosFecha} className='btn-limpiar-fecha' style={{ margin: '0 auto' }}>
            <FaEraser /> Restablecer fechas
          </button>
        </div>
      ) : (
        <div className='lista-visitas'>
          {visitasFiltradas.map((item) => {
            const esAutor = !esPx && item.uidg === myuid;
            const estaBloqueadoPorOculto = item.tipo === 'MEDICA' && item.oculto && !esAutor;

            return (
              <div key={item.pid} className={`visita-card border-${item.tipo?.toLowerCase()} ${item.oculto ? 'card-oculta' : ''}`}>
                
                <div className='visita-info'>
                  <div className='visita-card-header'>
                    <span className={`badge-tipo bg-${item.tipo?.toLowerCase()}`}>
                      {item.tipo === 'MEDICA' && <><FaUserMd/> Nota Médica</>}
                      {item.tipo === 'ENFERMERIA' && <><FaUserNurse/> Nota Enfermería</>}
                      {item.tipo === 'PROCEDIMIENTO' && <><FaSyringe/> Procedimiento</>}
                    </span>
                    <span className='visita-fecha'>{item.fecha}</span>
                    
                    {item.tipo === 'MEDICA' && item.oculto && (
                      <span className='badge-oculto'>
                        <FaEyeSlash /> Confidencial / Oculto
                      </span>
                    )}
                  </div>

                  {estaBloqueadoPorOculto ? (
                    <div className='contenido-restringido'>
                      <FaLock /> <span>Esta nota médica fue marcada como oculta por su autor ({item.Firma}).</span>
                    </div>
                  ) : (
                    <div className='visita-resumen'>
                      {item.tipo === 'MEDICA' && (
                        <>
                          <p><strong>Motivo:</strong> {item.motivo}</p>
                          <p><strong>Diagnóstico:</strong> {item.diagnostico}</p>
                        </>
                      )}
                      {item.tipo === 'ENFERMERIA' && (
                        <>
                          <p><strong>Cuidados / Intervenciones:</strong> {item.intervenciones}</p>
                          <p><strong>Medicamentos:</strong> {item.medicamentos || 'N/A'}</p>
                        </>
                      )}
                      {item.tipo === 'PROCEDIMIENTO' && (
                        <>
                          <p><strong>Procedimiento:</strong> {item.nombreProcedimiento}</p>
                          <p><strong>Incidentes:</strong> {item.complicaciones}</p>
                          {item.cuidadosPost && <p><strong>Cuidados Post-procedimiento:</strong> {item.cuidadosPost}</p>}
                        </>
                      )}
                    </div>
                  )}

                  <p className='visita-firma'>
                    <strong>Realizó / Firma:</strong> {item.Firma} {esAutor && <span className='tag-autor'>(Tú)</span>}
                  </p>
                </div>

                {/* BOTONES DE ACCIÓN */}
                <div className='visita-acciones'>
                  {!estaBloqueadoPorOculto && (
                    <button onClick={() => abrirRegistro(item, true)} className='btn-accion btn-ver'>
                      <FaEye /> Ver
                    </button>
                  )}

                  {item.tipo === 'MEDICA' && !estaBloqueadoPorOculto && esMedico && (
                    <button 
                      onClick={() => abrirVistaPreviaReceta(item)} 
                      className='btn-accion'
                      style={{ backgroundColor: '#e8f4fd', color: '#2980b9' }}
                      title="Previsualizar e imprimir receta médica"
                    >
                      <FaPrint /> Imprimir Plan
                    </button>
                  )}

                  {/* Si la vigencia está vencida, NO puede editar, borrar ni cambiar visibilidad */}
                  {esAutor && !vigenciaVencida && (
                    <>
                      {item.tipo === 'MEDICA' && (
                        <button 
                          onClick={() => toggleOcultoRapido(item)} 
                          className={`btn-accion ${item.oculto ? 'btn-mostrar' : 'btn-ocultar'}`}
                        >
                          {item.oculto ? <><FaEye /> Mostrar</> : <><FaEyeSlash /> Ocultar</>}
                        </button>
                      )}

                      <button onClick={() => abrirRegistro(item, false)} className='btn-accion btn-editar'>
                        <FaEdit /> Editar
                      </button>

                      <button onClick={() => handleEliminar(item)} className='btn-accion btn-eliminar'>
                        <FaTrashAlt /> Eliminar
                      </button>
                    </>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: SELECTOR DE TIPO (Oculto si la vigencia está vencida) */}
      {!esPx && !vigenciaVencida && isSelectorOpen && (
        <div className='modal-overlay'>
          <div className='modal-selector-content'>
            <div className='modal-header'>
              <h3>Seleccione el tipo de registro</h3>
              <button onClick={() => setIsSelectorOpen(false)} className='btn-close'><FaTimes /></button>
            </div>
            
            <div className='selector-grid'>
              <button 
                onClick={() => iniciarFormularioNuevo('MEDICA')} 
                className={`selector-card card-medica ${esEnfermero ? 'selector-disabled' : ''}`}
                disabled={esEnfermero}
              >
                <FaUserMd className='selector-icon' />
                <span>Nota Médica</span>
                {esEnfermero ? (
                  <small className='texto-restringido'><FaLock /> No disponible para Enfermería</small>
                ) : (
                  <small>Consulta, diagnóstico y tratamiento (SOAP)</small>
                )}
              </button>

              <button 
                onClick={() => iniciarFormularioNuevo('ENFERMERIA')} 
                className={`selector-card card-enfermeria ${esMedico ? 'selector-disabled' : ''}`}
                disabled={esMedico}
              >
                <FaUserNurse className='selector-icon' />
                <span>Nota Enfermería</span>
                {esMedico ? (
                  <small className='texto-restringido'><FaLock /> No disponible para rol Médico</small>
                ) : (
                  <small>Cuidados generales, medicación y evolución</small>
                )}
              </button>

              <button onClick={() => iniciarFormularioNuevo('PROCEDIMIENTO')} className='selector-card card-procedimiento'>
                <FaSyringe className='selector-icon' />
                <span>Procedimiento</span>
                <small>Intervenciones, curaciones, suturas o cirugías menores</small>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: FORMULARIO / DETALLE */}
      {isFormOpen && (
        <div className='modal-overlay'>
          <div className='modal-form-content'>
            <div className='modal-header'>
              <h3>
                {isReadOnly ? 'Ver ' : (isEditing ? 'Editar ' : 'Nueva ')}
                {tipoSeleccionado === 'MEDICA' && 'Nota Médica'}
                {tipoSeleccionado === 'ENFERMERIA' && 'Nota de Enfermería'}
                {tipoSeleccionado === 'PROCEDIMIENTO' && 'Nota de Procedimiento'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className='btn-close'><FaTimes /></button>
            </div>

            <form onSubmit={handleGuardar} className='form-visita'>
              
              {tipoSeleccionado === 'MEDICA' && !esPx && (
                <>
                  {(!isReadOnly || formData.uidg === myuid) && (
                    <div className='oculto-toggle-bar'>
                      <div>
                        <strong>Privacidad de la Nota:</strong>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
                          {formData.oculto 
                            ? 'Nota OCULTA (Confidencial, solo tú puedes leer su contenido).' 
                            : 'Nota PÚBLICA (Visible en el expediente clínico).'}
                        </p>
                      </div>
                      {!isReadOnly && !vigenciaVencida && (
                        <button 
                          type="button" 
                          onClick={() => setFormData({ ...formData, oculto: !formData.oculto })}
                          className={`btn-switch-oculto ${formData.oculto ? 'active-oculto' : 'active-visible'}`}
                        >
                          {formData.oculto ? <><FaEyeSlash /> Oculto</> : <><FaEye /> Público</>}
                        </button>
                      )}
                    </div>
                  )}

                  <div className='form-group'>
                    <label>Motivo de Consulta / Padecimiento Actual (Subjetivo) *</label>
                    <textarea name="motivo" value={formData.motivo || ''} onChange={handleChange} rows="3" required readOnly={isReadOnly} />
                  </div>

                  <div className='form-group'>
                    <label>Exploración Física (Objetivo) *</label>
                    <textarea name="exploracion" value={formData.exploracion || ''} onChange={handleChange} rows="3" required readOnly={isReadOnly} />
                  </div>

                  <div className='form-group'>
                    <label>Diagnóstico o Problemas Clínicos (Análisis) *</label>
                    <input type="text" name="diagnostico" value={formData.diagnostico || ''} onChange={handleChange} required readOnly={isReadOnly} />
                  </div>

                  <div className='form-group'>
                    <label>Plan de Manejo y Tratamiento *</label>
                    <textarea name="tratamiento" value={formData.tratamiento || ''} onChange={handleChange} rows="3" required readOnly={isReadOnly} />
                  </div>

                  <div className='form-group'>
                    <label>Pronóstico</label>
                    <input type="text" name="pronostico" value={formData.pronostico || ''} onChange={handleChange} readOnly={isReadOnly} />
                  </div>
                </>
              )}

              {tipoSeleccionado === 'ENFERMERIA' && !esPx && (
                <>
                  <div className='form-group'>
                    <label>Habitus Exterior / Estado General *</label>
                    <input type="text" name="estadoGeneral" value={formData.estadoGeneral || ''} onChange={handleChange} required readOnly={isReadOnly} />
                  </div>
                  <div className='form-group'>
                    <label>Intervenciones y Cuidados de Enfermería *</label>
                    <textarea name="intervenciones" value={formData.intervenciones || ''} onChange={handleChange} rows="3" required readOnly={isReadOnly} />
                  </div>
                  <div className='form-group'>
                    <label>Ministración de Medicamentos</label>
                    <textarea name="medicamentos" value={formData.medicamentos || ''} onChange={handleChange} rows="2" readOnly={isReadOnly} />
                  </div>
                  <div className='form-group'>
                    <label>Observaciones y Respuesta del Paciente</label>
                    <textarea name="observaciones" value={formData.observaciones || ''} onChange={handleChange} rows="2" readOnly={isReadOnly} />
                  </div>
                </>
              )}

              {tipoSeleccionado === 'PROCEDIMIENTO' && (
                <>
                  <div className='form-group'>
                    <label>Nombre del Procedimiento Realizado *</label>
                    <input type="text" name="nombreProcedimiento" value={formData.nombreProcedimiento || ''} onChange={handleChange} required readOnly={isReadOnly} />
                  </div>
                  <div className='form-grid-2'>
                    <div className='form-group'>
                      <label>Diagnóstico Pre-procedimiento *</label>
                      <input type="text" name="diagnosticoPre" value={formData.diagnosticoPre || ''} onChange={handleChange} required readOnly={isReadOnly} />
                    </div>
                    <div className='form-group'>
                      <label>Tipo de Anestesia / Sedación</label>
                      <input type="text" name="anestesia" value={formData.anestesia || ''} onChange={handleChange} readOnly={isReadOnly} />
                    </div>
                  </div>
                  <div className='form-group'>
                    <label>Descripción de la Técnica y Hallazgos *</label>
                    <textarea name="descripcionTecnica" value={formData.descripcionTecnica || ''} onChange={handleChange} rows="3" required readOnly={isReadOnly} />
                  </div>
                  <div className='form-group'>
                    <label>Incidentes, Accidentes o Complicaciones</label>
                    <input type="text" name="complicaciones" value={formData.complicaciones || ''} onChange={handleChange} readOnly={isReadOnly} />
                  </div>
                  <div className='form-group'>
                    <label>Cuidados e Indicaciones Post-procedimiento</label>
                    <textarea name="cuidadosPost" value={formData.cuidadosPost || ''} onChange={handleChange} rows="2" readOnly={isReadOnly} />
                  </div>
                </>
              )}

              <div className='form-group'>
                <label>Firma del Responsable:</label>
                <input type="text" name="Firma" value={formData.Firma || ''} readOnly className='input-readonly' />
              </div>

              <div className='modal-actions'>
                {tipoSeleccionado === 'MEDICA' && esMedico && (
                  <button 
                    type="button" 
                    onClick={() => abrirVistaPreviaReceta({ ...formData, pid: editPid || 'NUEVA', fecha: formData.fecha || new Date().toLocaleDateString('es-MX') })} 
                    className='btn-accion'
                    style={{ backgroundColor: '#3498db', color: '#fff', padding: '10px 16px', marginRight: 'auto' }}
                  >
                    <FaPrint /> Vista Previa e Imprimir Plan
                  </button>
                )}

                <button type="button" onClick={() => setIsFormOpen(false)} className='btn-cancelar'>
                  {isReadOnly ? 'Cerrar' : 'Cancelar'}
                </button>
                {!isReadOnly && !esPx && !vigenciaVencida && (
                  <button type="submit" className='btn-guardar'>
                    <FaSave /> {isEditing ? 'Actualizar Cambios' : 'Guardar Registro'}
                  </button>
                )}
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL DE VISTA PREVIA E IMPRESIÓN DE RECETA */}
      <ModalReceta 
        isOpen={!!recetaActiva} 
        onClose={() => setRecetaActiva(null)} 
        datosReceta={recetaActiva} 
      />

    </div>
  );
};

export default Consulta;