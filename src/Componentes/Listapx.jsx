import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { ref, onValue, get, set } from 'firebase/database';
import { 
  FaHome, FaUserPlus, FaSearch, FaMapMarkerAlt, 
  FaPlusCircle, FaTimes 
} from 'react-icons/fa';
import Listapxcard from './Listapxcard';
import { normalizarTexto } from '../constantes/estados';
import '../Estilos/Listapx.css';

function Listapx() {
  const navigate = useNavigate();
  const myuid = auth.currentUser?.uid;

  const [misPacientesIds, setMisPacientesIds] = useState({});
  const [todosLosPacientes, setTodosLosPacientes] = useState([]);
  const [localidadProfesional, setLocalidadProfesional] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!myuid) return;

    // 1. Obtener la localidad del médico / enfermero logueado
    const obtenerLocalidadProf = async () => {
      const rolLocal = localStorage.getItem('rolActivo');
      const ramas = rolLocal 
        ? [rolLocal, 'medico', 'enfermeria', 'enfermero', 'enfemero', 'otro'] 
        : ['medico', 'enfermeria', 'enfermero', 'enfemero', 'otro'];

      for (const r of ramas) {
        const snap = await get(ref(db, `usuarios/${r}/${myuid}`));
        if (snap.exists()) {
          setLocalidadProfesional(snap.val().localidad || '');
          break;
        }
      }
    };
    obtenerLocalidadProf();

    // 2. Escuchar los IDs de pacientes del médico logueado: px/[myuid]
    const relRef = ref(db, `px/${myuid}`);
    const unsubRel = onValue(relRef, (snap) => {
      setMisPacientesIds(snap.exists() ? snap.val() : {});
    });

    // 3. Escuchar los pacientes registrados en usuarios/px
    const globalPxRef = ref(db, 'usuarios/px');
    const unsubGlobal = onValue(globalPxRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const lista = Object.keys(data).map((key) => ({
          ...data[key],
          id: key,
          uid: key
        }));
        setTodosLosPacientes(lista);
      } else {
        setTodosLosPacientes([]);
      }
      setCargando(false);
    });

    return () => {
      unsubRel();
      unsubGlobal();
    };
  }, [myuid]);

  // Advertencia obligatoria antes de agregar al paciente y abrir su expediente
  const handleSolicitarAgregarPx = async (pxObj) => {
    if (!myuid || !pxObj?.uid) return;

    const nombreMostrar = pxObj.nombre || pxObj.nombrecom || 'este paciente';
    const confirmar = window.confirm(
      `⚠️ Atención:\n\n` +
      `"${nombreMostrar}" aún no forma parte de tu lista de pacientes. Para acceder a su expediente, se agregará a tus pacientes asignados.\n\n` +
      `¿Deseas agregarlo a tus pacientes y continuar?`
    );

    if (!confirmar) return; // Si cancela, no abre el expediente ni lo agrega

    try {
      await set(ref(db, `px/${myuid}/${pxObj.uid}`), { uid: pxObj.uid });
      navigate(`/px/${pxObj.uid}`);
    } catch (error) {
      console.error("Error al vincular paciente:", error);
      alert("Ocurrió un error al agregar al paciente.");
    }
  };

  const termino = normalizarTexto(busqueda);
  const hayBusquedaActiva = termino.length > 0;

  // 1. SOLO PACIENTES DEL MÉDICO LOGUEADO (px/[myuid])
  const misPacientes = todosLosPacientes.filter((p) => {
    const perteneceAlMedico = Boolean(misPacientesIds && misPacientesIds[p.uid]);
    if (!perteneceAlMedico) return false;

    if (!hayBusquedaActiva) return true;

    const nombre = normalizarTexto(p.nombre || p.nombrecom);
    const correo = normalizarTexto(p.correo);
    const cel = normalizarTexto(p.num_cel || p.celular);
    const loc = normalizarTexto(p.localidad);
    const uid = normalizarTexto(p.uid);

    return (
      nombre.includes(termino) ||
      correo.includes(termino) ||
      cel.includes(termino) ||
      loc.includes(termino) ||
      uid.includes(termino)
    );
  });

  // 2. BÚSQUEDA DE PACIENTES EXISTENTES REGISTRADOS (Solo aparece cuando escribe en el buscador)
  const pacientesExistentesEncontrados = hayBusquedaActiva
    ? todosLosPacientes.filter((p) => {
        const yaEsMio = Boolean(misPacientesIds && misPacientesIds[p.uid]);
        if (yaEsMio) return false;

        const nombre = normalizarTexto(p.nombre || p.nombrecom);
        const correo = normalizarTexto(p.correo);
        const cel = normalizarTexto(p.num_cel || p.celular);
        const uid = normalizarTexto(p.uid);

        return (
          nombre.includes(termino) ||
          correo.includes(termino) ||
          cel.includes(termino) ||
          uid.includes(termino)
        );
      })
    : [];

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Cargando pacientes...</div>;

  return (
    <div style={{ maxWidth: '1050px', margin: '30px auto', padding: '0 20px', fontFamily: 'Segoe UI, sans-serif' }}>
      
      {/* BARRA DE NAVEGACIÓN Y ACCIONES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <Link to="/" style={btnMenuStyle}>
          <FaHome /> Menú Principal
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {localidadProfesional && (
            <span style={badgeLocStyle}>
              <FaMapMarkerAlt /> Localidad activa: {localidadProfesional}
            </span>
          )}
          <Link to="/formulario" style={btnNuevoPxStyle}>
            <FaUserPlus /> Registrar Nuevo Paciente
          </Link>
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA */}
      <div style={searchBarContainer}>
        <FaSearch style={{ color: '#3498db', fontSize: '1.1rem' }} />
        <input
          type="text"
          placeholder="Buscar en mis pacientes o buscar pacientes existentes registrados (por nombre, correo, celular o ID)..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={searchInputStyle}
        />
        {hayBusquedaActiva && (
          <button 
            onClick={() => setBusqueda('')} 
            style={{ background: 'none', border: 'none', color: '#95a5a6', cursor: 'pointer', fontSize: '1rem' }}
            title="Limpiar búsqueda"
          >
            <FaTimes />
          </button>
        )}
      </div>

      {/* SECCIÓN 1: PACIENTES ASIGNADOS AL MÉDICO LOGUEADO */}
      <h3 style={{ color: '#2c3e50', marginBottom: '15px' }}>
        Mis Pacientes ({misPacientes.length})
      </h3>

      {misPacientes.length === 0 ? (
        <div style={emptyBoxStyle}>
          <p style={{ margin: 0, color: '#7f8c8d' }}>
            {hayBusquedaActiva 
              ? `Ninguno de tus pacientes asignados coincide con "${busqueda}". Revisa los resultados generales debajo.` 
              : 'Aún no tienes pacientes asignados en tu lista. Registra uno nuevo o utiliza el buscador para encontrar un paciente existente.'}
          </p>
        </div>
      ) : (
        <div style={gridCardsStyle}>
          {misPacientes.map((item) => (
            <Listapxcard key={item.uid} item={item} {...item} />
          ))}
        </div>
      )}

      {/* SECCIÓN 2: RESULTADOS DE BÚSQUEDA EN PACIENTES EXISTENTES REGISTRADOS */}
      {hayBusquedaActiva && (
        <div style={{ marginTop: '35px' }}>
          <h3 style={{ color: '#2980b9', marginBottom: '12px', borderTop: '2px solid #eef2f5', paddingTop: '20px' }}>
            Pacientes existentes registrados encontrados ({pacientesExistentesEncontrados.length})
          </h3>

          {pacientesExistentesEncontrados.length === 0 ? (
            <div style={emptyBoxStyle}>
              <p style={{ margin: 0, color: '#7f8c8d' }}>
                No se encontraron otros pacientes registrados con el término "{busqueda}".
              </p>
            </div>
          ) : (
            <div style={gridCardsStyle}>
              {pacientesExistentesEncontrados.map((px) => {
                const mismaLocalidad = localidadProfesional && 
                  normalizarTexto(px.localidad) === normalizarTexto(localidadProfesional);

                return (
                  <div 
                    key={px.uid} 
                    onClick={() => handleSolicitarAgregarPx(px)}
                    style={cardExistenteStyle}
                    title="Haz clic para agregar este paciente a tu lista"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img 
                        src={px.fotoperfil && px.fotoperfil !== 'null' ? px.fotoperfil : 'https://cdn-icons-png.flaticon.com/512/387/387561.png'} 
                        alt={px.nombre || px.nombrecom} 
                        style={{ width: '54px', height: '54px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #d6eaf8' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ margin: '0 0 4px 0', color: '#2c3e50', fontSize: '1.05rem' }}>
                          {px.nombre || px.nombrecom || 'Paciente'}
                        </h4>
                        <small style={{ color: '#64748b', display: 'block' }}>
                          <FaMapMarkerAlt style={{ color: mismaLocalidad ? '#2ecc71' : '#3498db' }} />{' '}
                          <strong>{px.localidad || 'Sin localidad'}</strong>
                          {mismaLocalidad && <span style={{ color: '#27ae60', marginLeft: '4px' }}>(Tu localidad)</span>}
                        </small>
                        <small style={{ color: '#7f8c8d', display: 'block' }}>
                          {px.correo && px.correo !== 'nocorreo' ? px.correo : 'Sin correo'}
                        </small>
                      </div>
                    </div>

                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSolicitarAgregarPx(px);
                      }} 
                      style={btnVincularStyle}
                    >
                      <FaPlusCircle /> Agregar a Mis Pacientes
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

const btnMenuStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  backgroundColor: '#f1f3f5', color: '#2c3e50', padding: '10px 16px',
  borderRadius: '8px', textDecoration: 'none', fontWeight: 600
};

const badgeLocStyle = {
  backgroundColor: '#e8f4fd', color: '#2980b9', padding: '8px 14px',
  borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600,
  display: 'inline-flex', alignItems: 'center', gap: '6px'
};

const btnNuevoPxStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  backgroundColor: '#2ecc71', color: '#fff', padding: '10px 18px',
  borderRadius: '8px', textDecoration: 'none', fontWeight: 600
};

const searchBarContainer = {
  backgroundColor: '#fff', border: '2px solid #d6eaf8', borderRadius: '12px',
  padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
  marginBottom: '25px', boxShadow: '0 3px 10px rgba(52, 152, 219, 0.08)'
};

const searchInputStyle = {
  border: 'none', outline: 'none', width: '100%', fontSize: '0.96rem', color: '#2c3e50'
};

const gridCardsStyle = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '18px'
};

const emptyBoxStyle = {
  backgroundColor: '#f8f9fa', padding: '30px', borderRadius: '12px',
  textAlign: 'center', border: '1px dashed #ced4da'
};

const cardExistenteStyle = {
  backgroundColor: '#ffffff', border: '1px solid #bcdff1', borderRadius: '14px',
  padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
  justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  cursor: 'pointer'
};

const btnVincularStyle = {
  width: '100%', backgroundColor: '#3498db', color: '#fff', border: 'none',
  padding: '10px 12px', borderRadius: '8px', fontWeight: 600, fontSize: '0.88rem',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
};

export default Listapx;