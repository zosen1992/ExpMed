import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { ref, get, update } from 'firebase/database';
import { 
  FaArrowLeft, FaUserMd, FaUserNurse, FaMapMarkerAlt, 
  FaStethoscope, FaStar, FaPhoneAlt, FaBuilding, 
  FaIdCard, FaTimes, FaCheckCircle, FaLock, FaSearch 
} from 'react-icons/fa';
import { normalizarTexto } from '../constantes/estados';
import '../Estilos/BuscarProfesional.css';

const BuscarProfesional = () => {
  const myuid = auth.currentUser?.uid;

  const [tipoProfesional, setTipoProfesional] = useState('medico');
  const [profesionales, setProfesionales] = useState([]);
  const [localidadPaciente, setLocalidadPaciente] = useState('');
  const [cargando, setCargando] = useState(true);

  // Filtros
  const [filtroEspecialidad, setFiltroEspecialidad] = useState('');
  const [busquedaNombre, setBusquedaNombre] = useState('');

  // Estados del Modal de Detalle
  const [profesionalActivo, setProfesionalActivo] = useState(null);
  const [esMiProfesional, setEsMiProfesional] = useState(false);
  const [verificandoRelacion, setVerificandoRelacion] = useState(false);
  const [miCalificacion, setMiCalificacion] = useState(5);
  const [guardandoCalif, setGuardandoCalif] = useState(false);

  useEffect(() => {
    const cargarDatosYProfesionales = async () => {
      setCargando(true);
      setFiltroEspecialidad('');
      try {
        // 1. Obtener la localidad del paciente logueado
        let locPx = '';
        if (myuid) {
          const snapPx = await get(ref(db, `usuarios/px/${myuid}`));
          if (snapPx.exists()) {
            locPx = (snapPx.val().localidad || '').trim();
            setLocalidadPaciente(locPx);
          }
        }

        // 2. Buscar profesionales según el tipo seleccionado
        const ramasABuscar = tipoProfesional === 'medico' 
          ? ['medico'] 
          : ['enfermeria', 'enfermero', 'enfemero'];

        const mapaUnico = {};

        for (const rama of ramasABuscar) {
          const snap = await get(ref(db, `usuarios/${rama}`));
          if (snap.exists()) {
            const data = snap.val();
            Object.keys(data).forEach((uidProf) => {
              const item = data[uidProf];
              
              // Validar estatus "publico"
              const esEstatusPublico = 
                String(item.visibilidad || '').trim().toLowerCase() === 'publico' && 
                item.oculto !== true;

              // Validar que coincida con la localidad del paciente logueado
              const locProf = (item.localidad || '').trim();
              const coincideLocalidadConPx = locPx 
                ? normalizarTexto(locProf) === normalizarTexto(locPx)
                : true;

              if (esEstatusPublico && coincideLocalidadConPx) {
                let listaEspecialidades = [];
                if (tipoProfesional === 'medico') {
                  if (item.especialidad1) listaEspecialidades.push(item.especialidad1.trim());
                  if (item.especialidad2) listaEspecialidades.push(item.especialidad2.trim());
                  if (item.especialidad3) listaEspecialidades.push(item.especialidad3.trim());
                  if (listaEspecialidades.length === 0) listaEspecialidades.push('Médico General / Cirujano Partero');
                } else {
                  const espEnf = item.especialidad_enf || item.especialidad || 'Enfermería General';
                  listaEspecialidades.push(espEnf.trim());
                }

                mapaUnico[uidProf] = {
                  uid: uidProf,
                  ramaOrigen: rama,
                  ...item,
                  nombreMostrar: item.nombre || item.nombrecom || 'Profesional de la Salud',
                  localidadMostrar: locProf || 'Sin especificar',
                  especialidadesArray: listaEspecialidades,
                  especialidadTexto: listaEspecialidades.join(' • '),
                  calificacionPromedio: item.calificacion !== undefined ? Number(item.calificacion) : 5
                };
              }
            });
          }
        }

        setProfesionales(Object.values(mapaUnico));
      } catch (error) {
        console.error("Error al cargar directorio:", error);
      } finally {
        setCargando(false);
      }
    };

    cargarDatosYProfesionales();
  }, [tipoProfesional, myuid]);

  const especialidadesDisponibles = Array.from(
    new Set(profesionales.flatMap(p => p.especialidadesArray).filter(Boolean))
  ).sort();

  const profesionalesFiltrados = profesionales.filter((prof) => {
    const coincideEspecialidad = !filtroEspecialidad || prof.especialidadesArray.some(
      esp => esp.toLowerCase() === filtroEspecialidad.toLowerCase()
    );
    const coincideNombre = !busquedaNombre || prof.nombreMostrar.toLowerCase().includes(busquedaNombre.toLowerCase());

    return coincideEspecialidad && coincideNombre;
  });

  const abrirDetalleProfesional = async (prof) => {
    setProfesionalActivo(prof);
    setVerificandoRelacion(true);
    setEsMiProfesional(false);

    const califPrevia = prof.calificacionesPorPx?.[myuid];
    setMiCalificacion(califPrevia ? Number(califPrevia) : 5);

    try {
      if (myuid) {
        const relSnap = await get(ref(db, `px/${prof.uid}/${myuid}`));
        setEsMiProfesional(relSnap.exists());
      }
    } catch (error) {
      console.error("Error al verificar relación paciente-profesional:", error);
    } finally {
      setVerificandoRelacion(false);
    }
  };

  const handleEnviarCalificacion = async () => {
    if (!profesionalActivo || !myuid || !esMiProfesional) return;
    setGuardandoCalif(true);

    try {
      const rama = profesionalActivo.ramaOrigen;
      const profUid = profesionalActivo.uid;

      const profSnap = await get(ref(db, `usuarios/${rama}/${profUid}`));
      if (profSnap.exists()) {
        const dataActual = profSnap.val();
        const votosActuales = dataActual.calificacionesPorPx || {};
        
        votosActuales[myuid] = Number(miCalificacion);

        const valores = Object.values(votosActuales).map(Number);
        const suma = valores.reduce((acc, curr) => acc + curr, 0);
        const nuevoPromedio = Number((suma / valores.length).toFixed(1));

        await update(ref(db, `usuarios/${rama}/${profUid}`), {
          calificacion: nuevoPromedio,
          calificacionesPorPx: votosActuales
        });

        setProfesionalActivo({
          ...profesionalActivo,
          calificacionPromedio: nuevoPromedio,
          calificacionesPorPx: votosActuales
        });

        setProfesionales(prev => prev.map(p => 
          p.uid === profUid 
            ? { ...p, calificacionPromedio: nuevoPromedio, calificacionesPorPx: votosActuales } 
            : p
        ));

        alert("¡Gracias! Tu calificación ha sido registrada correctamente.");
      }
    } catch (error) {
      console.error("Error al guardar calificación:", error);
      alert("Hubo un error al registrar tu calificación.");
    } finally {
      setGuardandoCalif(false);
    }
  };

  const avatarDefault = 'https://cdn-icons-png.flaticon.com/512/3774/3774299.png';

  return (
    <div className='directorio-container'>
      
      {/* HEADER */}
      <div className='directorio-header'>
        <Link to={myuid ? `/px/${myuid}` : '/'} className='btn-regresar-dir'>
          <FaArrowLeft /> Regresar a mi menú
        </Link>
        <h2 className='directorio-titulo'>Directorio de Profesionales</h2>
        <p className='directorio-subtitulo'>
          Mostrando profesionales disponibles en tu localidad:{' '}
          <strong style={{ color: '#2980b9' }}>{localidadPaciente || 'No definida en tu perfil'}</strong>
        </p>
      </div>

      {/* SELECTOR DE TIPO DE PERSONAL: MÉDICO O ENFERMERO */}
      <div className='selector-rol-bar'>
        <button 
          type="button"
          className={`btn-rol-tab ${tipoProfesional === 'medico' ? 'active-rol' : ''}`}
          onClick={() => setTipoProfesional('medico')}
        >
          <FaUserMd className='tab-icon' /> Médicos
        </button>

        <button 
          type="button"
          className={`btn-rol-tab ${tipoProfesional === 'enfermeria' ? 'active-rol' : ''}`}
          onClick={() => setTipoProfesional('enfermeria')}
        >
          <FaUserNurse className='tab-icon' /> Enfermeros
        </button>
      </div>

      {/* BARRA DE FILTROS */}
      <div className='filtros-directorio-box'>
        
        <div className='filtro-item'>
          <label><FaMapMarkerAlt /> Tu Localidad</label>
          <input 
            type="text" 
            value={localidadPaciente || 'Sin localidad asignada'} 
            readOnly 
            style={{ backgroundColor: '#e8f4fd', color: '#1b4f72', fontWeight: 'bold' }}
          />
        </div>

        <div className='filtro-item'>
          <label><FaStethoscope /> Especialidad</label>
          <select value={filtroEspecialidad} onChange={(e) => setFiltroEspecialidad(e.target.value)}>
            <option value="">Todas las especialidades</option>
            {especialidadesDisponibles.map((esp, idx) => (
              <option key={idx} value={esp}>{esp}</option>
            ))}
          </select>
        </div>

        <div className='filtro-item'>
          <label><FaSearch /> Buscar por nombre</label>
          <input 
            type="text" 
            placeholder="Ej. Dr. Mario..." 
            value={busquedaNombre}
            onChange={(e) => setBusquedaNombre(e.target.value)}
          />
        </div>

      </div>

      {/* LISTADO DE TARJETAS */}
      {cargando ? (
        <div className='dir-loading'>Buscando profesionales disponibles en {localidadPaciente}...</div>
      ) : profesionalesFiltrados.length === 0 ? (
        <div className='dir-empty'>
          {tipoProfesional === 'medico' ? <FaUserMd className='dir-empty-icon' /> : <FaUserNurse className='dir-empty-icon' />}
          <h3>No se encontraron profesionales en {localidadPaciente || 'tu localidad'}</h3>
          <p>Asegúrate de tener actualizada tu localidad en el apartado de Información General.</p>
        </div>
      ) : (
        <div className='grid-profesionales'>
          {profesionalesFiltrados.map((prof) => (
            <div 
              key={prof.uid} 
              className='card-profesional'
              onClick={() => abrirDetalleProfesional(prof)}
            >
              <img 
                src={prof.fotoperfil || avatarDefault} 
                alt={prof.nombreMostrar} 
                className='prof-avatar'
              />
              
              <div className='prof-card-body'>
                <h3 className='prof-name'>{prof.nombreMostrar}</h3>
                <p className='prof-specialty'>{prof.especialidadTexto}</p>
                
                <div className='prof-meta'>
                  <span className='prof-loc'>
                    <FaMapMarkerAlt /> {prof.localidadMostrar}
                  </span>
                  <span className='prof-rating'>
                    <FaStar className='star-gold' /> {prof.calificacionPromedio.toFixed(1)}
                  </span>
                </div>

                <span className='prof-ver-mas'>Ver teléfono, dirección y más →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE DETALLE */}
      {profesionalActivo && (
        <div className='modal-dir-overlay' onClick={() => setProfesionalActivo(null)}>
          <div className='modal-dir-content' onClick={(e) => e.stopPropagation()}>
            
            <button className='btn-close-dir' onClick={() => setProfesionalActivo(null)}>
              <FaTimes />
            </button>

            <div className='modal-prof-header'>
              <img 
                src={profesionalActivo.fotoperfil || avatarDefault} 
                alt={profesionalActivo.nombreMostrar} 
                className='modal-prof-avatar'
              />
              <div>
                <h3>{profesionalActivo.nombreMostrar}</h3>
                <span className='badge-prof-rol'>
                  {tipoProfesional === 'medico' ? 'Médico' : 'Enfermería'}
                </span>
                <div className='modal-stars-display'>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <FaStar 
                      key={s} 
                      className={s <= Math.round(profesionalActivo.calificacionPromedio) ? 'star-gold' : 'star-gray'} 
                    />
                  ))}
                  <span>({profesionalActivo.calificacionPromedio.toFixed(1)} / 5.0)</span>
                </div>
              </div>
            </div>

            <div className='modal-prof-details'>
              <div className='detail-row'>
                <FaStethoscope className='detail-icon' />
                <div>
                  <strong>Especialidad(es):</strong>
                  <p>{profesionalActivo.especialidadTexto}</p>
                </div>
              </div>

              {(profesionalActivo.cedula_partero || profesionalActivo.cedula) && (
                <div className='detail-row'>
                  <FaIdCard className='detail-icon' />
                  <div>
                    <strong>Cédula Profesional:</strong>
                    <p>{profesionalActivo.cedula_partero || profesionalActivo.cedula}</p>
                    {profesionalActivo.cedula_esp1 && <small>Céd. Esp 1: {profesionalActivo.cedula_esp1} </small>}
                    {profesionalActivo.cedula_esp2 && <small>| Céd. Esp 2: {profesionalActivo.cedula_esp2}</small>}
                  </div>
                </div>
              )}

              <div className='detail-row'>
                <FaPhoneAlt className='detail-icon' />
                <div>
                  <strong>Teléfono de Contacto:</strong>
                  <p>{profesionalActivo.num_cel || profesionalActivo.celular || 'No especificado'}</p>
                </div>
              </div>

              <div className='detail-row'>
                <FaBuilding className='detail-icon' />
                <div>
                  <strong>Dirección / Consultorio:</strong>
                  <p>{profesionalActivo.direccion || 'No especificada'}</p>
                </div>
              </div>

              <div className='detail-row'>
                <FaMapMarkerAlt className='detail-icon' />
                <div>
                  <strong>Localidad:</strong>
                  <p>{profesionalActivo.localidadMostrar}</p>
                </div>
              </div>
            </div>

            <div className='modal-rating-section'>
              {verificandoRelacion ? (
                <p style={{ textAlign: 'center', color: '#7f8c8d' }}>Verificando vínculo con el profesional...</p>
              ) : esMiProfesional ? (
                <div className='rating-box-allowed'>
                  <div className='rating-allowed-header'>
                    <FaCheckCircle style={{ color: '#2ecc71' }} />
                    <strong>Eres paciente registrado de este profesional</strong>
                  </div>
                  <p>Selecciona de 1 a 5 estrellas para calificar su atención:</p>
                  
                  <div className='interactive-stars'>
                    {[1, 2, 3, 4, 5].map((num) => (
                      <FaStar
                        key={num}
                        onClick={() => setMiCalificacion(num)}
                        className={`star-btn ${num <= miCalificacion ? 'star-gold' : 'star-gray'}`}
                      />
                    ))}
                  </div>

                  <button 
                    type="button" 
                    onClick={handleEnviarCalificacion} 
                    disabled={guardandoCalif}
                    className='btn-enviar-calif'
                  >
                    {guardandoCalif ? 'Guardando...' : `Enviar calificación (${miCalificacion} ★)`}
                  </button>
                </div>
              ) : (
                <div className='rating-box-locked'>
                  <FaLock className='lock-icon' />
                  <div>
                    <strong>Calificación deshabilitada</strong>
                    <p>Solo los pacientes dados de alta en el expediente de este profesional pueden calificarlo.</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default BuscarProfesional;