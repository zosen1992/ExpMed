import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { ref, get, set } from 'firebase/database';
import { 
  FaArrowLeft, FaSearch, FaMapMarkerAlt, FaUserMd, 
  FaUserNurse, FaStar, FaPhoneAlt, FaGraduationCap, 
  FaComments, FaCheckCircle 
} from 'react-icons/fa';
import { ESTADOS_REPUBLICA, normalizarTexto } from '../constantes/estados';
import { estaVigenciaVencida } from '../utilidades/verificadorVigencia';

const generarChatId = (uid1, uid2) => {
  return [uid1, uid2].sort().join('_');
};

const BuscarProfesional = () => {
  const navigate = useNavigate();
  const myuid = auth.currentUser?.uid;

  const [profesionales, setProfesionales] = useState([]);
  const [misMedicosSet, setMisMedicosSet] = useState(new Set());
  const [datosPaciente, setDatosPaciente] = useState({});
  const [cargando, setCargando] = useState(true);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('TODOS'); // 'TODOS' | 'medico' | 'enfermeria'

  useEffect(() => {
    if (!myuid) return;

    const cargarDirectorioProfesionales = async () => {
      try {
        // 1. Obtener datos del paciente logueado
        const snapPx = await get(ref(db, `usuarios/px/${myuid}`));
        if (snapPx.exists()) {
          const pxVal = snapPx.val();
          setDatosPaciente(pxVal);
          if (pxVal.localidad) {
            setFiltroEstado(pxVal.localidad);
          }
        }

        // 2. Verificar qué médicos/enfermeros ya tienen a este paciente asignado en px/[uidProf]/[myuid]
        const snapRelaciones = await get(ref(db, 'px'));
        const setAsignados = new Set();
        if (snapRelaciones.exists()) {
          const relVal = snapRelaciones.val();
          Object.keys(relVal).forEach((uidProf) => {
            if (relVal[uidProf] && relVal[uidProf][myuid]) {
              setAsignados.add(uidProf);
            }
          });
        }
        setMisMedicosSet(setAsignados);

        // 3. Cargar profesionales públicos de usuarios/medico y usuarios/enfermeria
        const snapUsuarios = await get(ref(db, 'usuarios'));
        if (snapUsuarios.exists()) {
          const ramas = snapUsuarios.val();
          const lista = [];
          const uidsAgregados = new Set();

          const ramasConfig = [
            { nodo: 'medico', rolNorm: 'medico', etiqueta: 'Médico' },
            { nodo: 'enfermeria', rolNorm: 'enfermeria', etiqueta: 'Enfermería' },
            { nodo: 'enfermero', rolNorm: 'enfermeria', etiqueta: 'Enfermería' },
            { nodo: 'enfemero', rolNorm: 'enfermeria', etiqueta: 'Enfermería' }
          ];

          ramasConfig.forEach(({ nodo, rolNorm, etiqueta }) => {
            if (ramas[nodo]) {
              Object.keys(ramas[nodo]).forEach((uidProf) => {
                if (uidsAgregados.has(uidProf)) return;
                const u = ramas[nodo][uidProf];
                const esOculto = u.oculto === true || u.visibilidad === 'oculto';
                if (esOculto) return; // Respetar privacidad de perfiles ocultos

                uidsAgregados.add(uidProf);
                lista.push({
                  uid: uidProf,
                  nombre: u.nombre || u.nombrecom || 'Profesional de Salud',
                  rol: rolNorm,
                  rolEtiqueta: etiqueta,
                  cedula: u.cedula_partero || u.cedula || '',
                  universidad: u.universidad || u.universidad_enf || '',
                  especialidad1: u.especialidad1 || u.especialidad_enf || u.especialidad || '',
                  cedula_esp1: u.cedula_esp1 || '',
                  especialidad2: u.especialidad2 || '',
                  especialidad3: u.especialidad3 || '',
                  localidad: u.localidad || 'Sin localidad',
                  direccion: u.direccion || '',
                  telefono: u.num_cel || u.celular || '',
                  fotoperfil: u.fotoperfil || '',
                  enDescanso: estaVigenciaVencida(u.vigencia),
                  calificacion: u.calificacion !== undefined ? Number(u.calificacion) : 5
                });
              });
            }
          });

          setProfesionales(lista);
        }
      } catch (error) {
        console.error("Error al cargar profesionales:", error);
      } finally {
        setCargando(false);
      }
    };

    cargarDirectorioProfesionales();
  }, [myuid]);

  // Acción del botón "Enviar Mensaje"
  const handleIniciarMensajeConProfesional = async (prof) => {
    //if (!myuid || !prof?.uid) return;
    if (!myuid || !prof?.uid) return;

    if (prof.enDescanso) {
      return alert(
        `🌿 Profesional temporalmente fuera de línea:\n\n` +
        `En este momento ${prof.nombre} ha hecho una pausa en la recepción de mensajes por motivos de agenda y descanso profesional.\n\n` +
        `Te sugerimos contactar a otro especialista disponible en el directorio.`
      );
    }

    const esMiMedico = misMedicosSet.has(prof.uid);

    // Si NO es su médico tratante, mostrar advertencia antes de proceder
    if (!esMiMedico) {
      const confirmar = window.confirm(
        `⚠️ Aviso importante:\n\n` +
        `El profesional "${prof.nombre}" aún no te tiene registrado en su lista de pacientes.\n\n` +
        `Puedes enviarle una solicitud de mensaje, sin embargo, ten en cuenta que al no ser tu médico tratante podría no responder.\n\n` +
        `¿Deseas continuar y enviarle mensaje?`
      );
      if (!confirmar) return;
    }

    try {
      const chatId = generarChatId(myuid, prof.uid);
      const snapChat = await get(ref(db, `chats/${chatId}/info`));

      if (!snapChat.exists()) {
        const ahoraStr = new Date().toLocaleString('es-MX', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });

        await set(ref(db, `chats/${chatId}/info`), {
          chatId,
          participantes: {
            [myuid]: true,
            [prof.uid]: true
          },
          datosParticipantes: {
            [myuid]: {
              uid: myuid,
              nombre: datosPaciente.nombre || datosPaciente.nombrecom || 'Paciente',
              rol: 'px',
              especialidad: '',
              fotoperfil: datosPaciente.fotoperfil || ''
            },
            [prof.uid]: {
              uid: prof.uid,
              nombre: prof.nombre,
              rol: prof.rol,
              especialidad: prof.especialidad1 || prof.rolEtiqueta,
              fotoperfil: prof.fotoperfil || ''
            }
          },
          estado: 'pendiente',
          iniciadoPor: myuid,
          aprobadorUid: prof.uid,
          esPacienteAsignado: esMiMedico, // Indica al médico si ya es su paciente o si es externo
          ultimoMensaje: 'Solicitud de conversación pendiente...',
          ultimaFecha: ahoraStr,
          timestamp: Date.now(),
          noLeidos: {
            [myuid]: 0,
            [prof.uid]: 0
          }
        });
      }

      navigate(`/chat/${chatId}`);
    } catch (error) {
      console.error("Error al abrir chat con profesional:", error);
      alert("No se pudo abrir la ventana de mensaje.");
    }
  };

  const termino = normalizarTexto(busqueda);

  const listaFiltrada = profesionales.filter((p) => {
    const coincideCat = filtroCategoria === 'TODOS' || p.rol === filtroCategoria;
    const coincideEstado = !filtroEstado || normalizarTexto(p.localidad) === normalizarTexto(filtroEstado);
    const coincideTexto = !termino ||
      normalizarTexto(p.nombre).includes(termino) ||
      normalizarTexto(p.especialidad1).includes(termino) ||
      normalizarTexto(p.especialidad2).includes(termino) ||
      normalizarTexto(p.direccion).includes(termino);

    return coincideCat && coincideEstado && coincideTexto;
  });

  const avatarDefault = 'https://cdn-icons-png.flaticon.com/512/3774/3774299.png';

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '60px' }}>Cargando directorio de profesionales...</div>;

  return (
    <div style={{ maxWidth: '1080px', margin: '28px auto', padding: '0 20px', fontFamily: 'Segoe UI, Roboto, sans-serif' }}>
      
      {/* CABECERA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <Link to={`/px/${myuid}`} style={btnBackStyle}>
          <FaArrowLeft /> Regresar a mi menú
        </Link>

        <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.55rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaUserMd style={{ color: '#3498db' }} /> Buscar Profesional de Salud
        </h2>
      </div>

      {/* BARRA DE FILTROS */}
      <div style={filterBoxStyle}>
        <div style={searchInputWrapper}>
          <FaSearch style={{ color: '#3498db' }} />
          <input
            type="text"
            placeholder="Buscar por nombre, especialidad o consultorio..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={inputCleanStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={selectWrapperStyle}>
            <FaMapMarkerAlt style={{ color: '#3498db' }} />
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={selectCleanStyle}>
              <option value="">Todos los estados</option>
              {ESTADOS_REPUBLICA.map((est) => (
                <option key={est} value={est}>{est}</option>
              ))}
            </select>
          </div>

          <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={selectCategoryStyle}>
            <option value="TODOS">Médicos y Enfermería</option>
            <option value="medico">Solo Médicos</option>
            <option value="enfermeria">Solo Enfermería</option>
          </select>
        </div>
      </div>

      {/* LISTADO DE PROFESIONALES */}
      {listaFiltrada.length === 0 ? (
        <div style={emptyBoxStyle}>
          <h3 style={{ margin: '0 0 6px 0', color: '#334155' }}>No se encontraron profesionales con estos filtros</h3>
          <p style={{ margin: 0, color: '#64748b' }}>Intenta seleccionar "Todos los estados" o cambiar tu búsqueda.</p>
        </div>
      ) : (
        <div style={gridStyle}>
          {listaFiltrada.map((prof) => {
            const esMiMedico = misMedicosSet.has(prof.uid);

            return (
              <div key={prof.uid} style={cardStyle}>
                <div>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '12px' }}>
                    <img
                      src={prof.fotoperfil && prof.fotoperfil !== 'null' ? prof.fotoperfil : avatarDefault}
                      alt={prof.nombre}
                      style={avatarStyle}
                      onError={(e) => { e.target.onerror = null; e.target.src = avatarDefault; }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.08rem', color: '#1e293b' }}>{prof.nombre}</h3>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#f59e0b', fontWeight: 700, fontSize: '0.86rem' }}>
                          <FaStar /> {prof.calificacion.toFixed(1)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '5px' }}>
                        <span style={prof.rol === 'medico' ? badgeMedStyle : badgeEnfStyle}>
                          {prof.rol === 'medico' ? <><FaUserMd /> Médico</> : <><FaUserNurse /> Enfermería</>}
                        </span>

                        {esMiMedico && (
                          <span style={badgeMiMedicoStyle}>
                            <FaCheckCircle /> Es tu médico
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={infoBodyStyle}>
                    {prof.especialidad1 && (
                      <p style={infoRowStyle}>
                        <FaGraduationCap style={{ color: '#3498db', flexShrink: 0 }} />
                        <span><strong>Especialidad:</strong> {prof.especialidad1}</span>
                      </p>
                    )}
                    {prof.cedula && (
                      <p style={infoRowStyle}>
                        <span><strong>Céd. Prof.:</strong> {prof.cedula} {prof.universidad ? `(${prof.universidad})` : ''}</span>
                      </p>
                    )}
                    <p style={infoRowStyle}>
                      <FaMapMarkerAlt style={{ color: '#e74c3c', flexShrink: 0 }} />
                      <span><strong>Localidad:</strong> {prof.localidad} {prof.direccion ? `• ${prof.direccion}` : ''}</span>
                    </p>
                    {prof.telefono && (
                      <p style={infoRowStyle}>
                        <FaPhoneAlt style={{ color: '#2ecc71', flexShrink: 0 }} />
                        <span><strong>Contacto:</strong> {prof.telefono}</span>
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleIniciarMensajeConProfesional(prof)}
                  style={esMiMedico ? btnMsgDirectoStyle : btnMsgExternoStyle}
                >
                  <FaComments /> Enviar Mensaje {!esMiMedico && '(Solicitar contacto)'}
                </button>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

const btnBackStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  backgroundColor: '#e8f4fd', color: '#3498db', padding: '8px 15px',
  borderRadius: '8px', textDecoration: 'none', fontWeight: 600
};
const filterBoxStyle = {
  backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px',
  padding: '14px 16px', marginBottom: '22px', display: 'flex', flexWrap: 'wrap',
  gap: '12px', justifyContent: 'space-between', alignItems: 'center',
  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
};
const searchInputWrapper = {
  flex: 1, minWidth: '240px', display: 'flex', alignItems: 'center', gap: '10px',
  backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '9px 14px'
};
const inputCleanStyle = {
  border: 'none', outline: 'none', width: '100%', backgroundColor: 'transparent', fontSize: '0.94rem'
};
const selectWrapperStyle = {
  display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8fafc',
  border: '1px solid #cbd5e1', borderRadius: '10px', padding: '8px 12px'
};
const selectCleanStyle = {
  border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '0.9rem', color: '#1e293b'
};
const selectCategoryStyle = {
  backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px',
  padding: '8px 12px', fontSize: '0.9rem', color: '#1e293b', outline: 'none'
};
const gridStyle = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '18px'
};
const cardStyle = {
  backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
  padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
  gap: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
};
const avatarStyle = {
  width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover',
  border: '2px solid #e8f4fd', flexShrink: 0
};
const badgeMedStyle = {
  backgroundColor: '#e8f4fd', color: '#2980b9', fontSize: '0.75rem', fontWeight: 700,
  padding: '3px 8px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px'
};
const badgeEnfStyle = {
  backgroundColor: '#e8f8f5', color: '#16a085', fontSize: '0.75rem', fontWeight: 700,
  padding: '3px 8px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px'
};
const badgeMiMedicoStyle = {
  backgroundColor: '#dcfce7', color: '#166534', fontSize: '0.74rem', fontWeight: 700,
  padding: '3px 8px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px'
};
const infoBodyStyle = {
  backgroundColor: '#f8fafc', borderRadius: '10px', padding: '10px 12px',
  display: 'flex', flexDirection: 'column', gap: '6px'
};
const infoRowStyle = {
  margin: 0, fontSize: '0.84rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px'
};
const btnMsgDirectoStyle = {
  width: '100%', backgroundColor: '#2ecc71', color: '#ffffff', border: 'none',
  padding: '10px 14px', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
};
const btnMsgExternoStyle = {
  width: '100%', backgroundColor: '#3498db', color: '#ffffff', border: 'none',
  padding: '10px 14px', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
};
const emptyBoxStyle = {
  backgroundColor: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '14px',
  padding: '40px 20px', textAlign: 'center'
};

export default BuscarProfesional;