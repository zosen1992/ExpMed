import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, onValue, set, update, remove, get, push } from 'firebase/database';
import { 
  FaArrowLeft, FaUserPlus, FaUserMd, FaUserNurse, FaUserInjured, 
  FaUserShield, FaSearch, FaEdit, FaTrashAlt, FaTimes, FaSave, 
  FaCalendarCheck, FaLock, FaMapMarkerAlt, FaStar 
} from 'react-icons/fa';
import { ESTADOS_REPUBLICA, normalizarTexto } from '../constantes/estados';
import '../Estilos/AdminUsuarios.css';

const PASSWORD_DEFAULT = "000000";

const estadoInicialFormulario = {
  categoria: 'medico', // 'medico' | 'enfermeria' | 'px' | 'admin'
  nombre: '',
  correo: '',
  contras: PASSWORD_DEFAULT,
  num_cel: '',
  direccion: '',
  localidad: '',
  fotoperfil: '',
  // Vigencia y Visibilidad (Personal)
  vigencia: '',
  visibilidad: 'publico',
  calificacion: 5,
  // Médico
  cedula_partero: '',
  universidad: '',
  especialidad1: '',
  cedula_esp1: '',
  universidad_esp1: '',
  especialidad2: '',
  cedula_esp2: '',
  universidad_esp2: '',
  especialidad3: '',
  cedula_esp3: '',
  universidad_esp3: '',
  // Enfermería
  cedula: '',
  especialidad_enf: '',
  // Paciente
  fecha_nac: '',
  sexo: 'N/A',
  nss: ''
};

const AdminUsuarios = () => {
  const [usuariosPorRama, setUsuariosPorRama] = useState({});
  const [cargando, setCargando] = useState(true);

  // Filtros de vista
  const [tabActiva, setTabActiva] = useState('medico'); // 'medico' | 'enfermeria' | 'px' | 'admin'
  const [busqueda, setBusqueda] = useState('');
  const [filtroLocalidad, setFiltroLocalidad] = useState('');

  // Modal Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [uidEditando, setUidEditando] = useState(null);
  const [ramaOriginalEditando, setRamaOriginalEditando] = useState('');
  const [formData, setFormData] = useState(estadoInicialFormulario);

  useEffect(() => {
    const usuariosRef = ref(db, 'usuarios');
    const unsubscribe = onValue(usuariosRef, (snapshot) => {
      if (snapshot.exists()) {
        setUsuariosPorRama(snapshot.val());
      } else {
        setUsuariosPorRama({});
      }
      setCargando(false);
    });

    return () => unsubscribe();
  }, []);

  // Unificar la lista de usuarios según la pestaña seleccionada
  const obtenerListaPorTab = (categoria) => {
    let ramas = [categoria];
    if (categoria === 'enfermeria') ramas = ['enfermeria', 'enfermero', 'enfemero'];
    if (categoria === 'admin') ramas = ['admin', 'otro'];

    const mapa = {};
    ramas.forEach((r) => {
      const nodo = usuariosPorRama[r];
      if (nodo && typeof nodo === 'object') {
        Object.keys(nodo).forEach((uid) => {
          mapa[uid] = {
            ...nodo[uid],
            uid,
            ramaReal: r,
            categoriaNormalizada: categoria
          };
        });
      }
    });
    return Object.values(mapa);
  };

  // Verificar si un correo ya existe en toda la base de datos
  const buscarDuenoDelCorreo = async (correoBuscado) => {
    const correoLimpio = correoBuscado.trim().toLowerCase();
    if (!correoLimpio || correoLimpio === 'nocorreo') return null;

    const snapUsuarios = await get(ref(db, 'usuarios'));
    if (!snapUsuarios.exists()) return null;

    const ramas = snapUsuarios.val();
    const mapaRoles = {
      medico: 'Médico',
      enfermeria: 'Enfermería',
      enfermero: 'Enfermería',
      enfemero: 'Enfermería',
      px: 'Paciente',
      admin: 'Administrador',
      otro: 'Administrador'
    };

    for (const nombreRama of Object.keys(ramas)) {
      const usuariosEnRama = ramas[nombreRama];
      if (usuariosEnRama && typeof usuariosEnRama === 'object') {
        for (const uidUsuario of Object.keys(usuariosEnRama)) {
          const userObj = usuariosEnRama[uidUsuario];
          const correoUsuario = String(userObj?.correo || '').trim().toLowerCase();

          if (correoUsuario && correoUsuario !== 'nocorreo' && correoUsuario === correoLimpio) {
            return {
              uid: uidUsuario,
              nombre: userObj.nombre || userObj.nombrecom || 'Usuario',
              rol: userObj.rol || mapaRoles[nombreRama] || nombreRama
            };
          }
        }
      }
    }
    return null;
  };

  const abrirModalCrear = () => {
    setIsEditing(false);
    setUidEditando(null);
    setRamaOriginalEditando('');
    setFormData({
      ...estadoInicialFormulario,
      categoria: tabActiva,
      contras: PASSWORD_DEFAULT
    });
    setIsModalOpen(true);
  };

  const abrirModalEditar = (user) => {
    setIsEditing(true);
    setUidEditando(user.uid);
    setRamaOriginalEditando(user.ramaReal);

    const esOculto = user.oculto === true || user.visibilidad === 'oculto';

    setFormData({
      categoria: user.categoriaNormalizada || tabActiva,
      nombre: user.nombre || user.nombrecom || '',
      correo: user.correo || '',
      contras: PASSWORD_DEFAULT,
      num_cel: user.num_cel || user.celular || '',
      direccion: user.direccion || '',
      localidad: user.localidad || '',
      fotoperfil: user.fotoperfil || '',
      vigencia: user.vigencia && user.vigencia !== 'N/A' ? user.vigencia : '',
      visibilidad: esOculto ? 'oculto' : 'publico',
      calificacion: user.calificacion !== undefined ? Number(user.calificacion) : 5,
      // Médico
      cedula_partero: user.cedula_partero || user.cedula || '',
      universidad: user.universidad || '',
      especialidad1: user.especialidad1 || '',
      cedula_esp1: user.cedula_esp1 || '',
      universidad_esp1: user.universidad_esp1 || '',
      especialidad2: user.especialidad2 || '',
      cedula_esp2: user.cedula_esp2 || '',
      universidad_esp2: user.universidad_esp2 || '',
      especialidad3: user.especialidad3 || '',
      cedula_esp3: user.cedula_esp3 || '',
      universidad_esp3: user.universidad_esp3 || '',
      // Enfermería
      cedula: user.cedula || '',
      especialidad_enf: user.especialidad_enf || user.especialidad || '',
      // Paciente
      fecha_nac: user.fecha_nac || user.fechanacimiento || '',
      sexo: user.sexo || 'N/A',
      nss: user.nss || ''
    });
    setIsModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'contras') return; // Contraseña siempre fija en 000000
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGuardarUsuario = async (e) => {
    e.preventDefault();
    if (!formData.localidad) {
      return alert("Por favor selecciona una Localidad de la lista desplegable.");
    }

    setGuardando(true);
    let appSecundaria = null;

    try {
      const cat = formData.categoria; // 'medico' | 'enfermeria' | 'px' | 'admin'
      const ramaDestino = cat; // Guardamos siempre en la rama limpia ('medico', 'enfermeria', 'px', 'admin')
      let targetUid = uidEditando;

      // SI ES CREACIÓN DE NUEVO USUARIO
      if (!isEditing) {
        if (cat !== 'px' && !formData.correo.trim()) {
          setGuardando(false);
          return alert("El correo electrónico es obligatorio para crear personal Médico, Enfermería o Admin.");
        }

        if (formData.correo.trim()) {
          const dueno = await buscarDuenoDelCorreo(formData.correo);
          if (dueno) {
            setGuardando(false);
            return alert(
              `⚠️ Correo electrónico ya registrado:\n\n` +
              `Pertenece a: ${dueno.nombre}\n` +
              `Rol: ${dueno.rol.toUpperCase()}`
            );
          }

          appSecundaria = initializeApp(auth.app.options, `AdminCreate_${Date.now()}`);
          const authSec = getAuth(appSecundaria);
          const cred = await createUserWithEmailAndPassword(
            authSec,
            formData.correo.trim(),
            PASSWORD_DEFAULT
          );
          targetUid = cred.user.uid;
          await authSec.signOut();
          await deleteApp(appSecundaria);
          appSecundaria = null;
        } else {
          // Paciente sin correo
          targetUid = push(ref(db, 'usuarios/px')).key;
        }
      }

      // CONSTRUIR OBJETO DE DATOS SEGÚN LA CATEGORÍA
      const objetoGuardar = {
        uid: targetUid,
        id: targetUid,
        nombre: formData.nombre.trim(),
        nombrecom: formData.nombre.trim(),
        correo: formData.correo.trim() || 'nocorreo',
        contras: PASSWORD_DEFAULT,
        num_cel: formData.num_cel.trim(),
        celular: formData.num_cel.trim(),
        direccion: formData.direccion.trim(),
        localidad: formData.localidad,
        fotoperfil: formData.fotoperfil.trim(),
        rol: cat
      };

      if (cat === 'medico') {
        objetoGuardar.vigencia = formData.vigencia || 'N/A';
        objetoGuardar.visibilidad = formData.visibilidad;
        objetoGuardar.oculto = formData.visibilidad === 'oculto';
        objetoGuardar.calificacion = Number(formData.calificacion) || 5;
        objetoGuardar.cedula_partero = formData.cedula_partero;
        objetoGuardar.universidad = formData.universidad;
        objetoGuardar.especialidad1 = formData.especialidad1;
        objetoGuardar.cedula_esp1 = formData.cedula_esp1;
        objetoGuardar.universidad_esp1 = formData.universidad_esp1;
        objetoGuardar.especialidad2 = formData.especialidad2;
        objetoGuardar.cedula_esp2 = formData.cedula_esp2;
        objetoGuardar.universidad_esp2 = formData.universidad_esp2;
        objetoGuardar.especialidad3 = formData.especialidad3;
        objetoGuardar.cedula_esp3 = formData.cedula_esp3;
        objetoGuardar.universidad_esp3 = formData.universidad_esp3;
      } else if (cat === 'enfermeria') {
        objetoGuardar.vigencia = formData.vigencia || 'N/A';
        objetoGuardar.visibilidad = formData.visibilidad;
        objetoGuardar.oculto = formData.visibilidad === 'oculto';
        objetoGuardar.calificacion = Number(formData.calificacion) || 5;
        objetoGuardar.cedula = formData.cedula;
        objetoGuardar.especialidad_enf = formData.especialidad_enf;
        objetoGuardar.especialidad = formData.especialidad_enf;
      } else if (cat === 'px') {
        objetoGuardar.fecha_nac = formData.fecha_nac;
        objetoGuardar.fechanacimiento = formData.fecha_nac;
        objetoGuardar.sexo = formData.sexo || 'N/A';
        objetoGuardar.nss = formData.nss || 'N/A';
      } else if (cat === 'admin') {
        objetoGuardar.vigencia = formData.vigencia || 'N/A';
      }

      // Si al editar cambió de categoría/rama (ej. estaba en 'otro' y pasa a 'admin'), limpiamos la rama anterior
      if (isEditing && ramaOriginalEditando && ramaOriginalEditando !== ramaDestino) {
        await remove(ref(db, `usuarios/${ramaOriginalEditando}/${targetUid}`));
      }

      if (isEditing) {
        await update(ref(db, `usuarios/${ramaDestino}/${targetUid}`), objetoGuardar);
        alert("Perfil actualizado correctamente.");
      } else {
        await set(ref(db, `usuarios/${ramaDestino}/${targetUid}`), objetoGuardar);
        alert(`Usuario creado exitosamente en la categoría "${cat.toUpperCase()}" con contraseña por defecto: ${PASSWORD_DEFAULT}`);
      }

      setTabActiva(cat);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error al guardar usuario desde Admin:", error);
      if (appSecundaria) {
        try { await deleteApp(appSecundaria); } catch (e) { console.error(e); }
      }
      if (error.code === 'auth/email-already-in-use') {
        const propietario = await buscarDuenoDelCorreo(formData.correo);
        if (propietario) {
          alert(`⚠️ El correo ya está registrado.\nPertenece a: ${propietario.nombre}\nRol: ${propietario.rol.toUpperCase()}`);
        } else {
          alert("El correo electrónico ya existe en Firebase Authentication.");
        }
      } else {
        alert("Error al procesar el usuario: " + error.message);
      }
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarUsuario = async (user) => {
    if (user.uid === auth.currentUser?.uid) {
      return alert("No puedes eliminar tu propia cuenta de Administrador en sesión.");
    }

    const confirmar = window.confirm(
      `⚠️ ¿Estás seguro de que deseas eliminar permanentemente el perfil de "${user.nombre || user.nombrecom}" (${user.categoriaNormalizada.toUpperCase()})?`
    );
    if (!confirmar) return;

    try {
      await remove(ref(db, `usuarios/${user.ramaReal}/${user.uid}`));
      alert("Usuario eliminado correctamente de la base de datos.");
    } catch (error) {
      console.error("Error al eliminar usuario:", error);
      alert("No se pudo eliminar el usuario.");
    }
  };

  const listaActual = obtenerListaPorTab(tabActiva);

  const listaFiltrada = listaActual.filter((u) => {
    const t = normalizarTexto(busqueda);
    const coincideTexto = !t ||
      normalizarTexto(u.nombre || u.nombrecom).includes(t) ||
      normalizarTexto(u.correo).includes(t) ||
      normalizarTexto(u.num_cel || u.celular).includes(t) ||
      normalizarTexto(u.uid).includes(t);

    const coincideLoc = !filtroLocalidad ||
      normalizarTexto(u.localidad) === normalizarTexto(filtroLocalidad);

    return coincideTexto && coincideLoc;
  });

  // Evaluar si una fecha de vigencia está vencida
  const esVigenciaVencida = (fechaStr) => {
    if (!fechaStr || fechaStr === 'N/A') return false;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const f = new Date(fechaStr);
    return !isNaN(f.getTime()) && f < hoy;
  };

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '60px' }}>Cargando módulo de administración...</div>;

  return (
    <div className='admin-container'>
      
      {/* CABECERA */}
      <div className='admin-header'>
        <Link to="/" className='btn-regresar-admin'>
          <FaArrowLeft /> Volver al Panel de Control
        </Link>

        <div className='admin-title-bar'>
          <div>
            <h2 className='admin-titulo'><FaUserShield /> Administración de Perfiles y Usuarios</h2>
            <p className='admin-subtitulo'>
              Crea, modifica o elimina cuentas de Médicos, Enfermería, Pacientes y Administradores • Contraseña global fija: <strong>000000</strong>
            </p>
          </div>

          <button onClick={abrirModalCrear} className='btn-crear-usuario'>
            <FaUserPlus /> Crear Nuevo Usuario
          </button>
        </div>
      </div>

      {/* PESTAÑAS POR CATEGORÍA */}
      <div className='admin-tabs'>
        <button 
          className={`admin-tab-btn ${tabActiva === 'medico' ? 'active' : ''}`} 
          onClick={() => setTabActiva('medico')}
        >
          <FaUserMd /> Médicos ({obtenerListaPorTab('medico').length})
        </button>

        <button 
          className={`admin-tab-btn ${tabActiva === 'enfermeria' ? 'active' : ''}`} 
          onClick={() => setTabActiva('enfermeria')}
        >
          <FaUserNurse /> Enfermería ({obtenerListaPorTab('enfermeria').length})
        </button>

        <button 
          className={`admin-tab-btn ${tabActiva === 'px' ? 'active' : ''}`} 
          onClick={() => setTabActiva('px')}
        >
          <FaUserInjured /> Pacientes ({obtenerListaPorTab('px').length})
        </button>

        <button 
          className={`admin-tab-btn ${tabActiva === 'admin' ? 'active' : ''}`} 
          onClick={() => setTabActiva('admin')}
        >
          <FaUserShield /> Administradores ({obtenerListaPorTab('admin').length})
        </button>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTRO DE LOCALIDAD */}
      <div className='admin-filtros-bar'>
        <div className='admin-search-input'>
          <FaSearch />
          <input 
            type="text" 
            placeholder="Buscar por nombre, correo, teléfono o UID..." 
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className='admin-loc-select'>
          <FaMapMarkerAlt />
          <select value={filtroLocalidad} onChange={(e) => setFiltroLocalidad(e.target.value)}>
            <option value="">Todas las localidades</option>
            {ESTADOS_REPUBLICA.map((est) => (
              <option key={est} value={est}>{est}</option>
            ))}
          </select>
        </div>
      </div>

      {/* LISTADO DE USUARIOS */}
      {listaFiltrada.length === 0 ? (
        <div className='admin-empty'>
          <h3>No se encontraron usuarios en esta categoría</h3>
          <p>Puedes registrar uno nuevo haciendo clic en el botón superior "Crear Nuevo Usuario".</p>
        </div>
      ) : (
        <div className='admin-users-grid'>
          {listaFiltrada.map((u) => {
            const vencido = esVigenciaVencida(u.vigencia);
            return (
              <div key={u.uid} className='admin-user-card'>
                <div className='admin-card-top'>
                  <img 
                    src={u.fotoperfil && u.fotoperfil !== 'null' ? u.fotoperfil : 'https://cdn-icons-png.flaticon.com/512/3774/3774299.png'} 
                    alt={u.nombre} 
                    className='admin-user-avatar'
                  />
                  <div className='admin-user-main'>
                    <h4>{u.nombre || u.nombrecom || 'Sin nombre'}</h4>
                    <span className='admin-user-email'>{u.correo || 'Sin correo'}</span>
                    <div className='admin-badges-row'>
                      <span className='badge-admin-loc'><FaMapMarkerAlt /> {u.localidad || 'Sin localidad'}</span>
                      {(tabActiva === 'medico' || tabActiva === 'enfermeria' || tabActiva === 'admin') && (
                        <span className={`badge-admin-vig ${vencido ? 'vig-vencida' : 'vig-activa'}`}>
                          <FaCalendarCheck /> Vigencia: {u.vigencia || 'N/A'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Resumen de datos específicos según categoría */}
                <div className='admin-card-details'>
                  {tabActiva === 'medico' && (
                    <>
                      <p><strong>Céd. Médico Partero:</strong> {u.cedula_partero || u.cedula || 'N/D'} {u.universidad ? `(${u.universidad})` : ''}</p>
                      {u.especialidad1 && <p><strong>Esp. 1:</strong> {u.especialidad1} (Céd: {u.cedula_esp1 || 'N/D'})</p>}
                      <p><strong>Visibilidad:</strong> {u.oculto || u.visibilidad === 'oculto' ? 'Oculto a otros' : 'Público'} • <FaStar style={{ color: '#f1c40f' }} /> {u.calificacion ?? 5}</p>
                    </>
                  )}

                  {tabActiva === 'enfermeria' && (
                    <>
                      <p><strong>Cédula Prof.:</strong> {u.cedula || 'N/D'}</p>
                      <p><strong>Especialidad:</strong> {u.especialidad_enf || u.especialidad || 'General'}</p>
                      <p><strong>Visibilidad:</strong> {u.oculto || u.visibilidad === 'oculto' ? 'Oculto a otros' : 'Público'} • <FaStar style={{ color: '#f1c40f' }} /> {u.calificacion ?? 5}</p>
                    </>
                  )}

                  {tabActiva === 'px' && (
                    <>
                      <p><strong>F. Nacimiento:</strong> {u.fecha_nac || u.fechanacimiento || 'N/D'} • <strong>Sexo:</strong> {u.sexo || 'N/A'}</p>
                      <p><strong>NSS:</strong> {u.nss || 'N/A'} • <strong>Tel:</strong> {u.num_cel || u.celular || 'N/D'}</p>
                    </>
                  )}

                  {tabActiva === 'admin' && (
                    <p><strong>Teléfono:</strong> {u.num_cel || u.celular || 'N/D'} • <strong>Rama:</strong> usuarios/{u.ramaReal}</p>
                  )}
                </div>

                <div className='admin-card-actions'>
                  <button onClick={() => abrirModalEditar(u)} className='btn-admin-edit'>
                    <FaEdit /> Modificar Perfil
                  </button>
                  <button onClick={() => handleEliminarUsuario(u)} className='btn-admin-del'>
                    <FaTrashAlt /> Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =================================================================
          MODAL DE CREACIÓN / MODIFICACIÓN DE USUARIO SEGÚN CATEGORÍA
         ================================================================= */}
      {isModalOpen && (
        <div className='admin-modal-overlay'>
          <div className='admin-modal-content'>
            <div className='admin-modal-header'>
              <h3>{isEditing ? `Modificar Perfil (${formData.nombre})` : 'Crear Nuevo Usuario'}</h3>
              <button onClick={() => setIsModalOpen(false)} className='btn-close-admin'><FaTimes /></button>
            </div>

            <form onSubmit={handleGuardarUsuario} className='admin-form'>
              
              {/* CATEGORÍA Y CONTRASEÑA FIJA */}
              <div className='admin-grid-3'>
                <div className='admin-field'>
                  <label>Categoría / Rol de Usuario *</label>
                  <select name="categoria" value={formData.categoria} onChange={handleChange} required>
                    <option value="medico">Médico</option>
                    <option value="enfermeria">Enfermería</option>
                    <option value="px">Paciente</option>
                    <option value="admin">Administrador (Admin)</option>
                  </select>
                </div>

                <div className='admin-field'>
                  <label>Correo Electrónico {formData.categoria !== 'px' ? '*' : '(Opcional en Px)'}</label>
                  <input 
                    type="email" 
                    name="correo" 
                    value={formData.correo === 'nocorreo' ? '' : formData.correo} 
                    onChange={handleChange} 
                    readOnly={isEditing}
                    required={formData.categoria !== 'px'}
                    placeholder="usuario@correo.com"
                    className={isEditing ? 'input-locked-admin' : ''}
                  />
                </div>

                <div className='admin-field'>
                  <label><FaLock /> Contraseña por Defecto (Fija)</label>
                  <input 
                    type="text" 
                    name="contras" 
                    value={PASSWORD_DEFAULT} 
                    readOnly 
                    disabled
                    className='input-locked-admin'
                  />
                </div>
              </div>

              {/* DATOS GENERALES COMUNES */}
              <h4 className='admin-sec-title'>Datos Generales y Localidad</h4>
              <div className='admin-grid-3'>
                <div className='admin-field'>
                  <label>Nombre Completo *</label>
                  <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} required />
                </div>

                <div className='admin-field'>
                  <label>Teléfono / Celular</label>
                  <input type="text" name="num_cel" value={formData.num_cel} onChange={handleChange} />
                </div>

                <div className='admin-field'>
                  <label>Localidad (Estado) *</label>
                  <select name="localidad" value={formData.localidad} onChange={handleChange} required>
                    <option value="">Seleccione un estado...</option>
                    {ESTADOS_REPUBLICA.map((estado) => (
                      <option key={estado} value={estado}>{estado}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className='admin-grid-2'>
                <div className='admin-field'>
                  <label>Dirección / Consultorio</label>
                  <input type="text" name="direccion" value={formData.direccion} onChange={handleChange} />
                </div>

                <div className='admin-field'>
                  <label>URL Foto de Perfil</label>
                  <input type="text" name="fotoperfil" value={formData.fotoperfil} onChange={handleChange} placeholder="https://..." />
                </div>
              </div>

              {/* VIGENCIA Y VISIBILIDAD (Aplica para Médico, Enfermería y Admin) */}
              {formData.categoria !== 'px' && (
                <>
                  <h4 className='admin-sec-title'>Control de Vigencia y Visibilidad</h4>
                  <div className='admin-grid-3'>
                    <div className='admin-field'>
                      <label><FaCalendarCheck /> Fecha de Vigencia de la Cuenta *</label>
                      <input 
                        type="date" 
                        name="vigencia" 
                        value={formData.vigencia} 
                        onChange={handleChange} 
                        required={formData.categoria === 'medico' || formData.categoria === 'enfermeria'}
                      />
                    </div>

                    {(formData.categoria === 'medico' || formData.categoria === 'enfermeria') && (
                      <>
                        <div className='admin-field'>
                          <label>Estatus en Directorio</label>
                          <select name="visibilidad" value={formData.visibilidad} onChange={handleChange}>
                            <option value="publico">Público</option>
                            <option value="oculto">Ocultar a otros</option>
                          </select>
                        </div>

                        <div className='admin-field'>
                          <label>Calificación (0 a 5)</label>
                          <input type="number" step="0.1" min="0" max="5" name="calificacion" value={formData.calificacion} onChange={handleChange} />
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* CAMPOS EXCLUSIVOS DE MÉDICO */}
              {formData.categoria === 'medico' && (
                <>
                  <h4 className='admin-sec-title'>Acreditación Médica y Especialidades</h4>
                  <div className='admin-grid-2'>
                    <div className='admin-field'>
                      <label>Cédula Médico Cirujano y Partero</label>
                      <input type="text" name="cedula_partero" value={formData.cedula_partero} onChange={handleChange} />
                    </div>
                    <div className='admin-field'>
                      <label>Universidad (Médico Partero)</label>
                      <input type="text" name="universidad" value={formData.universidad} onChange={handleChange} />
                    </div>
                  </div>

                  <div className='admin-grid-3'>
                    <div className='admin-field'>
                      <label>Especialidad (1)</label>
                      <input type="text" name="especialidad1" value={formData.especialidad1} onChange={handleChange} />
                    </div>
                    <div className='admin-field'>
                      <label>Cédula Especialidad (1)</label>
                      <input type="text" name="cedula_esp1" value={formData.cedula_esp1} onChange={handleChange} />
                    </div>
                    <div className='admin-field'>
                      <label>Universidad Esp. (1)</label>
                      <input type="text" name="universidad_esp1" value={formData.universidad_esp1} onChange={handleChange} />
                    </div>
                  </div>

                  <div className='admin-grid-3'>
                    <div className='admin-field'>
                      <label>Especialidad (2)</label>
                      <input type="text" name="especialidad2" value={formData.especialidad2} onChange={handleChange} />
                    </div>
                    <div className='admin-field'>
                      <label>Cédula Especialidad (2)</label>
                      <input type="text" name="cedula_esp2" value={formData.cedula_esp2} onChange={handleChange} />
                    </div>
                    <div className='admin-field'>
                      <label>Universidad Esp. (2)</label>
                      <input type="text" name="universidad_esp2" value={formData.universidad_esp2} onChange={handleChange} />
                    </div>
                  </div>

                  <div className='admin-grid-3'>
                    <div className='admin-field'>
                      <label>Especialidad (3)</label>
                      <input type="text" name="especialidad3" value={formData.especialidad3} onChange={handleChange} />
                    </div>
                    <div className='admin-field'>
                      <label>Cédula Especialidad (3)</label>
                      <input type="text" name="cedula_esp3" value={formData.cedula_esp3} onChange={handleChange} />
                    </div>
                    <div className='admin-field'>
                      <label>Universidad Esp. (3)</label>
                      <input type="text" name="universidad_esp3" value={formData.universidad_esp3} onChange={handleChange} />
                    </div>
                  </div>
                </>
              )}

              {/* CAMPOS EXCLUSIVOS DE ENFERMERÍA */}
              {formData.categoria === 'enfermeria' && (
                <>
                  <h4 className='admin-sec-title'>Acreditación de Enfermería</h4>
                  <div className='admin-grid-2'>
                    <div className='admin-field'>
                      <label>Cédula Profesional</label>
                      <input type="text" name="cedula" value={formData.cedula} onChange={handleChange} />
                    </div>
                    <div className='admin-field'>
                      <label>Especialidad</label>
                      <input type="text" name="especialidad_enf" value={formData.especialidad_enf} onChange={handleChange} />
                    </div>
                  </div>
                </>
              )}

              {/* CAMPOS EXCLUSIVOS DE PACIENTE */}
              {formData.categoria === 'px' && (
                <>
                  <h4 className='admin-sec-title'>Datos Clínicos del Paciente</h4>
                  <div className='admin-grid-3'>
                    <div className='admin-field'>
                      <label>Fecha de Nacimiento</label>
                      <input type="date" name="fecha_nac" value={formData.fecha_nac} onChange={handleChange} />
                    </div>
                    <div className='admin-field'>
                      <label>Sexo</label>
                      <select name="sexo" value={formData.sexo} onChange={handleChange}>
                        <option value="N/A">Sin especificar</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                      </select>
                    </div>
                    <div className='admin-field'>
                      <label>NSS (Seguridad Social)</label>
                      <input type="text" name="nss" value={formData.nss} onChange={handleChange} />
                    </div>
                  </div>
                </>
              )}

              <div className='admin-modal-actions'>
                <button type="button" onClick={() => setIsModalOpen(false)} className='btn-admin-cancel'>
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} className='btn-admin-save'>
                  <FaSave /> {guardando ? 'Procesando...' : (isEditing ? 'Guardar Cambios' : 'Crear Usuario')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminUsuarios;