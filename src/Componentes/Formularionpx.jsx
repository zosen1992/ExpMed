import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set, push, get } from 'firebase/database';
import { FaArrowLeft, FaSave, FaLock } from 'react-icons/fa';
import { ESTADOS_REPUBLICA } from '../constantes/estados';

useEffect(() => {
    if (localStorage.getItem('vigenciaVencida') === 'true') {
      alert("⛔ Tu vigencia ha vencido. No puedes registrar pacientes nuevos.");
      navigate('/listapx', { replace: true });
    }
  }, [navigate]);

const PASSWORD_DEFAULT = "000000";

const Formularionpx = () => {
  const navigate = useNavigate();
  const myuid = auth.currentUser?.uid;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    correo: '',
    contras: PASSWORD_DEFAULT,
    celular: '',
    fechanacimiento: '',
    sexo: 'N/A',
    direccion: '',
    localidad: '',
    nss: '',
    fotoperfil: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Impedir cualquier modificación al campo de contraseña
    if (name === 'contras') return;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // Busca en todas las ramas de usuarios a quién pertenece un correo existente
  const buscarDuenoDelCorreo = async (correoBuscado) => {
    const correoLimpio = correoBuscado.trim().toLowerCase();
    if (!correoLimpio) return null;

    const snapUsuarios = await get(ref(db, 'usuarios'));
    if (!snapUsuarios.exists()) return null;

    const ramas = snapUsuarios.val();
    const mapaRoles = {
      medico: 'Médico',
      enfermeria: 'Enfermería',
      enfermero: 'Enfermero',
      enfemero: 'Enfermero',
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
              nombre: userObj.nombre || userObj.nombrecom || 'Usuario sin nombre',
              rol: userObj.rol || mapaRoles[nombreRama] || nombreRama
            };
          }
        }
      }
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!myuid) return alert("Error: No hay sesión activa.");
    
    if (!formData.localidad) {
      return alert("Por favor selecciona una Localidad de la lista desplegable.");
    }

    setLoading(true);
    let appSecundaria = null;

    try {
      // 0. VERIFICAR SI EL CORREO YA EXISTE EN LA BASE DE DATOS E INDICAR NOMBRE Y ROL
      if (formData.correo.trim()) {
        const propietarioExistente = await buscarDuenoDelCorreo(formData.correo);
        if (propietarioExistente) {
          setLoading(false);
          return alert(
            `⚠️ Correo electrónico ya registrado:\n\n` +
            `Pertenece a: ${propietarioExistente.nombre}\n` +
            `Rol: ${propietarioExistente.rol.toUpperCase()}`
          );
        }
      }

      let nuevoUid = "";

      // 1. GENERAR USUARIO EN AUTH CON CONTRASEÑA FIJA "000000" (Si ingresó correo)
      if (formData.correo.trim()) {
        appSecundaria = initializeApp(auth.app.options, `AppSecundaria_${Date.now()}`);
        const authSecundario = getAuth(appSecundaria);

        const userCredential = await createUserWithEmailAndPassword(
          authSecundario,
          formData.correo.trim(),
          PASSWORD_DEFAULT
        );
        nuevoUid = userCredential.user.uid;

        await authSecundario.signOut();
        await deleteApp(appSecundaria);
        appSecundaria = null;
      } else {
        // 2. GENERAR UID AUTOMÁTICO (Si no ingresó correo)
        nuevoUid = push(ref(db, 'usuarios/px')).key;
      }
      if (formData.fotoperfil) {
        await set(ref(db, `fotoperfil/${nuevoUid}`), {
          uid: nuevoUid,
          nombreArchivo: `${nuevoUid}.png`,
          ruta: `fotoperfil/${nuevoUid}`,
          url: formData.fotoperfil,
          fechaActualizacion: new Date().toISOString()
        });
      }

      // 3. PREPARAR DATOS RUTA GLOBAL: usuarios/px/[UID]
      const datosGlobales = {
        uid: nuevoUid,
        id: nuevoUid,
        nombre: formData.nombre || "",
        nombrecom: formData.nombre || "",
        correo: formData.correo.trim() || "nocorreo",
        contras: PASSWORD_DEFAULT,
        num_cel: formData.celular || "",
        celular: formData.celular || "",
        fecha_nac: formData.fechanacimiento || "",
        fechanacimiento: formData.fechanacimiento || "",
        sexo: formData.sexo || "N/A",
        direccion: formData.direccion || "",
        localidad: formData.localidad || "",
        nss: formData.nss || "N/A",
        fotoperfil: formData.fotoperfil || "",
        rol: "px",
        
      };

      // 4. GUARDAR EN AMBAS RUTAS
      await set(ref(db, `usuarios/px/${nuevoUid}`), datosGlobales);
      await set(ref(db, `px/${myuid}/${nuevoUid}`), { uid: nuevoUid });

      alert(`¡Paciente registrado correctamente!\nContraseña asignada por defecto: ${PASSWORD_DEFAULT}`);
      navigate('/listapx');

    } catch (error) {
      console.error("Error al registrar paciente:", error);
      if (appSecundaria) {
        try { await deleteApp(appSecundaria); } catch (err) { console.error(err); }
      }

      if (error.code === 'auth/email-already-in-use') {
        const propietario = await buscarDuenoDelCorreo(formData.correo);
        if (propietario) {
          alert(
            `⚠️ El correo electrónico ya está en uso.\n\n` +
            `Pertenece a: ${propietario.nombre}\n` +
            `Rol: ${propietario.rol.toUpperCase()}`
          );
        } else {
          alert("El correo electrónico ingresado ya está registrado en Firebase Authentication.");
        }
      } else if (error.code === 'auth/invalid-email') {
        alert("El formato del correo electrónico no es válido.");
      } else {
        alert("Ocurrió un error al registrar al paciente: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <Link to="/listapx" style={backLinkStyle}>
          <FaArrowLeft /> Volver a mis pacientes
        </Link>

        <h2 style={{ textAlign: 'center', color: '#2c3e50', marginBottom: '20px' }}>
          Registrar Nuevo Paciente
        </h2>

        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={fieldGroup}>
            <label style={labelStyle}>Nombre Completo *</label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              required
              style={inputStyle}
              placeholder="Nombre y apellidos"
            />
            
          </div>

          <div style={rowTwoCols}>
            <div style={fieldGroup}>
              <label style={labelStyle}>Correo Electrónico</label>
              <input
                type="email"
                name="correo"
                value={formData.correo}
                onChange={handleChange}
                style={inputStyle}
                placeholder="ejemplo@correo.com"
              />
            </div>

            <div style={fieldGroup}>
              <label style={labelStyle}><FaLock style={{ fontSize: '0.75rem' }} /> Contraseña (Fija)</label>
              <input
                type="text"
                name="contras"
                value={PASSWORD_DEFAULT}
                readOnly
                disabled
                style={lockedInputStyle}
                title="Contraseña por defecto no modificable"
              />
            </div>
          </div>
          <small style={{ color: '#7f8c8d', textAlign: 'center', marginTop: '-8px' }}>
            La contraseña por defecto para todos los usuarios es <strong>000000</strong> (no modificable).
          </small>

          <div style={rowTwoCols}>
            <div style={fieldGroup}>
              <label style={labelStyle}>Celular</label>
              <input
                type="text"
                name="celular"
                value={formData.celular}
                onChange={handleChange}
                style={inputStyle}
                placeholder="10 dígitos"
              />
            </div>

            <div style={fieldGroup}>
              <label style={labelStyle}>Sexo</label>
              <select
                name="sexo"
                value={formData.sexo}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="N/A">Sin especificar</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
              </select>
            </div>
          </div>

          <div style={fieldGroup}>
            <label style={labelStyle}>Fecha de Nacimiento</label>
            <input
              type="date"
              name="fechanacimiento"
              value={formData.fechanacimiento}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div style={rowTwoCols}>
            <div style={fieldGroup}>
              <label style={labelStyle}>Dirección</label>
              <input
                type="text"
                name="direccion"
                value={formData.direccion}
                onChange={handleChange}
                style={inputStyle}
                placeholder="Calle, número, colonia"
              />
            </div>

            <div style={fieldGroup}>
              <label style={labelStyle}>Localidad (Estado) *</label>
              <select
                name="localidad"
                value={formData.localidad}
                onChange={handleChange}
                required
                style={inputStyle}
              >
                <option value="">Seleccione un estado...</option>
                {ESTADOS_REPUBLICA.map((estado) => (
                  <option key={estado} value={estado}>{estado}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={fieldGroup}>
            <label style={labelStyle}>NSS (Número de Seguridad Social)</label>
            <input
              type="text"
              name="nss"
              value={formData.nss}
              onChange={handleChange}
              style={inputStyle}
              placeholder="Opcional"
            />
          </div>

          <div style={fieldGroup}>
            <label style={labelStyle}>URL Foto de Perfil</label>
            <input
              type="text"
              name="fotoperfil"
              value={formData.fotoperfil}
              onChange={handleChange}
              style={inputStyle}
              placeholder="https://..."
            />
          </div>

          

          <button type="submit" disabled={loading} style={submitBtnStyle}>
            <FaSave /> {loading ? 'Verificando y guardando...' : 'Guardar Paciente'}
          </button>
        </form>
      </div>
    </div>
  );
};

const containerStyle = {
  display: 'flex', justifyContent: 'center', padding: '30px 15px', fontFamily: 'Segoe UI, Roboto, sans-serif'
};
const cardStyle = {
  background: '#fff', width: '100%', maxWidth: '480px', padding: '28px',
  borderRadius: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', border: '1px solid #e1e8ed'
};
const backLinkStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#3498db',
  textDecoration: 'none', fontSize: '0.9rem', fontWeight: '600', marginBottom: '10px'
};
const formStyle = {
  display: 'flex', flexDirection: 'column', gap: '14px'
};
const rowTwoCols = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'
};
const fieldGroup = {
  display: 'flex', flexDirection: 'column', gap: '5px'
};
const labelStyle = {
  fontSize: '0.85rem', fontWeight: '600', color: '#555', textAlign: 'center'
};
const inputStyle = {
  padding: '10px 12px', borderRadius: '8px', border: '1px solid #ccd1d1',
  fontSize: '0.92rem', outline: 'none', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff'
};
const lockedInputStyle = {
  ...inputStyle, backgroundColor: '#e9ecef', color: '#495057',
  fontWeight: 'bold', textAlign: 'center', cursor: 'not-allowed'
};
const submitBtnStyle = {
  backgroundColor: '#2ecc71', color: '#fff', border: 'none', padding: '12px',
  borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer',
  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '8px'
};

export default Formularionpx;