import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { ref, set, push } from 'firebase/database';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as signOutSecondary } from 'firebase/auth';
import { 
  FaArrowLeft, FaUserPlus, FaCamera, FaUpload, 
  FaTrashAlt, FaEnvelope, FaLock, FaPhoneAlt, 
  FaBirthdayCake, FaVenusMars, FaMapMarkerAlt, FaIdCard 
} from 'react-icons/fa';
import { ESTADOS_REPUBLICA } from '../constantes/estados';

const Formularionpx = () => {
  const navigate = useNavigate();
  const myuid = auth.currentUser?.uid;

  const [guardando, setGuardando] = useState(false);
  const [crearAccesoLogin, setCrearAccesoLogin] = useState(false);
  const [passwordPx, setPasswordPx] = useState('');

  const [formData, setFormData] = useState({
    nombre: '',
    correo: '',
    num_cel: '',
    fecha_nac: '',
    sexo: 'Masculino',
    direccion: '',
    localidad: 'Nuevo León',
    nss: '',
    fotoperfil: ''
  });

  // Candado: Si la vigencia está vencida, no permite registrar pacientes nuevos
  useEffect(() => {
    if (localStorage.getItem('vigenciaVencida') === 'true') {
      alert("⛔ Tu vigencia ha vencido. No puedes registrar pacientes nuevos.");
      navigate('/listapx', { replace: true });
    }
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Subir foto de perfil seleccionando archivo de imagen
  const handleSubirFotoPx = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      e.target.value = '';
      return alert("Solo se permiten archivos de imagen (PNG, JPG, JPEG, WEBP).");
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 360;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setFormData((prev) => ({ ...prev, fotoperfil: dataUrl }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!myuid) return alert("Sesión no válida.");
    if (localStorage.getItem('vigenciaVencida') === 'true') {
      return alert("⛔ Tu vigencia está vencida. No puedes agregar pacientes.");
    }

    setGuardando(true);
    try {
      let nuevoUid = '';

      // Si se marcó crear cuenta con correo y contraseña para que el paciente pueda iniciar sesión
      if (crearAccesoLogin && formData.correo.trim() && passwordPx.trim()) {
        if (passwordPx.trim().length < 6) {
          setGuardando(false);
          return alert("La contraseña del paciente debe tener al menos 6 caracteres.");
        }

        const appName = 'SecondaryAppRegistroPx';
        const existingApp = getApps().find((a) => a.name === appName);
        const secondaryApp = existingApp || initializeApp(firebaseConfig, appName);
        const secondaryAuth = getAuth(secondaryApp);

        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          formData.correo.trim(),
          passwordPx.trim()
        );
        nuevoUid = cred.user.uid;
        await signOutSecondary(secondaryAuth);
      } else {
        // Registro sin cuenta de acceso directo (genera llave única en BD)
        const refTemp = push(ref(db, 'usuarios/px'));
        nuevoUid = refTemp.key;
      }

      const objetoPaciente = {
        uid: nuevoUid,
        id: nuevoUid,
        nombre: formData.nombre.trim(),
        nombrecom: formData.nombre.trim(),
        correo: formData.correo.trim() || 'nocorreo',
        num_cel: formData.num_cel.trim(),
        celular: formData.num_cel.trim(),
        fecha_nac: formData.fecha_nac,
        fechanacimiento: formData.fecha_nac,
        sexo: formData.sexo,
        direccion: formData.direccion.trim(),
        localidad: formData.localidad,
        nss: formData.nss.trim(),
        fotoperfil: formData.fotoperfil || '',
        rol: 'px',
        creadoPor: myuid,
        fechaRegistro: new Date().toISOString()
      };

      // 1. Guardar en usuarios/px/[nuevoUid]
      await set(ref(db, `usuarios/px/${nuevoUid}`), objetoPaciente);

      // 2. Vincular a la lista del médico o enfermero actual: px/[myuid]/[nuevoUid]
      await set(ref(db, `px/${myuid}/${nuevoUid}`), { uid: nuevoUid });

      // 3. Guardar la foto de perfil en la carpeta fotoperfil/[nuevoUid] con el UID como nombre
      if (formData.fotoperfil) {
        await set(ref(db, `fotoperfil/${nuevoUid}`), {
          uid: nuevoUid,
          nombreArchivo: `${nuevoUid}.png`,
          ruta: `fotoperfil/${nuevoUid}`,
          url: formData.fotoperfil,
          fechaActualizacion: new Date().toISOString()
        });
      }

      alert("¡Paciente registrado y vinculado a tu lista exitosamente!");
      navigate(`/px/${nuevoUid}`);
    } catch (error) {
      console.error("Error al registrar paciente:", error);
      if (error.code === 'auth/email-already-in-use') {
        alert("Ese correo electrónico ya está registrado en el sistema. Puedes buscar al paciente en el buscador de 'Mis Pacientes' para agregarlo a tu lista.");
      } else {
        alert("Ocurrió un error al registrar al paciente: " + (error.message || ''));
      }
    } finally {
      setGuardando(false);
    }
  };

  const avatarDefault = 'https://cdn-icons-png.flaticon.com/512/387/387561.png';

  return (
    <div style={{ maxWidth: '820px', margin: '30px auto', padding: '0 20px', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/listapx" style={btnBackStyle}>
          <FaArrowLeft /> Regresar a Mis Pacientes
        </Link>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px' }}>
          <FaUserPlus style={{ color: '#2ecc71' }} /> Registrar Nuevo Paciente
        </h2>

        <form onSubmit={handleSubmit} style={gridFormStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Nombre Completo del Paciente *</label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Ej. María López Hernández"
              required
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}><FaBirthdayCake /> Fecha de Nacimiento *</label>
            <input
              type="date"
              name="fecha_nac"
              value={formData.fecha_nac}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}><FaVenusMars /> Sexo *</label>
            <select name="sexo" value={formData.sexo} onChange={handleChange} style={inputStyle}>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}><FaPhoneAlt /> Teléfono / Celular</label>
            <input
              type="text"
              name="num_cel"
              value={formData.num_cel}
              onChange={handleChange}
              placeholder="Ej. 8112345678"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}><FaMapMarkerAlt /> Estado / Localidad *</label>
            <select name="localidad" value={formData.localidad} onChange={handleChange} style={inputStyle} required>
              <option value="">Seleccione un estado...</option>
              {ESTADOS_REPUBLICA.map((estado) => (
                <option key={estado} value={estado}>{estado}</option>
              ))}
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}><FaMapMarkerAlt /> Dirección</label>
            <input
              type="text"
              name="direccion"
              value={formData.direccion}
              onChange={handleChange}
              placeholder="Calle, número, colonia..."
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}><FaIdCard /> NSS (Seguridad Social - Opcional)</label>
            <input
              type="text"
              name="nss"
              value={formData.nss}
              onChange={handleChange}
              placeholder="Número de Seguridad Social"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}><FaEnvelope /> Correo Electrónico</label>
            <input
              type="email"
              name="correo"
              value={formData.correo}
              onChange={handleChange}
              placeholder="paciente@ejemplo.com"
              required={crearAccesoLogin}
              style={inputStyle}
            />
          </div>

          {/* OPCIÓN PARA CREAR ACCESO DE LOGIN AL PACIENTE */}
          <div style={{ gridColumn: '1 / -1', backgroundColor: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600, color: '#1e293b' }}>
              <input
                type="checkbox"
                checked={crearAccesoLogin}
                onChange={(e) => setCrearAccesoLogin(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              Habilitar contraseña para que el paciente pueda iniciar sesión desde su celular/PC
            </label>

            {crearAccesoLogin && (
              <div style={{ marginTop: '12px', maxWidth: '360px' }}>
                <label style={labelStyle}><FaLock /> Contraseña para el Paciente (mín. 6 caracteres) *</label>
                <input
                  type="password"
                  value={passwordPx}
                  onChange={(e) => setPasswordPx(e.target.value)}
                  placeholder="••••••"
                  required={crearAccesoLogin}
                  style={inputStyle}
                />
              </div>
            )}
          </div>

          {/* FOTO DE PERFIL (ARCHIVO O URL) */}
          <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
            <label style={labelStyle}><FaCamera /> Foto de Perfil del Paciente (Opcional)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{
                backgroundColor: '#3498db', color: '#fff', padding: '9px 15px',
                borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
                display: 'inline-flex', alignItems: 'center', gap: '6px'
              }}>
                <FaUpload /> Seleccionar imagen
                <input type="file" accept="image/*" onChange={handleSubirFotoPx} style={{ display: 'none' }} />
              </label>

              <input
                type="text"
                name="fotoperfil"
                value={formData.fotoperfil && !formData.fotoperfil.startsWith('data:image') ? formData.fotoperfil : ''}
                onChange={handleChange}
                style={{ ...inputStyle, flex: 1, minWidth: '220px' }}
                placeholder="O pega aquí la URL de la imagen (https://...)"
              />

              {formData.fotoperfil && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, fotoperfil: '' })}
                  style={{
                    backgroundColor: '#fceceb', color: '#e74c3c', border: '1px solid #f5b7b1',
                    padding: '9px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <FaTrashAlt /> Quitar
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src={formData.fotoperfil || avatarDefault}
                alt="Vista previa"
                style={{ width: '54px', height: '54px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #3498db' }}
              />
              <span style={{ fontSize: '0.84rem', color: '#64748b' }}>
                Se guardará con el UID del paciente en <code>fotoperfil/[uid]</code>
              </span>
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
            <Link to="/listapx" style={btnCancelStyle}>Cancelar</Link>
            <button type="submit" disabled={guardando} style={btnSaveStyle}>
              <FaUserPlus /> {guardando ? 'Registrando...' : 'Guardar Paciente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const btnBackStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  color: '#3498db', textDecoration: 'none', fontWeight: 600,
  padding: '8px 14px', backgroundColor: '#e8f4fd', borderRadius: '8px'
};
const cardStyle = {
  backgroundColor: '#fff', padding: '28px', borderRadius: '16px',
  border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.04)'
};
const gridFormStyle = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px'
};
const fieldStyle = { display: 'flex', flexDirection: 'column', gap: '6px' };
const labelStyle = {
  fontSize: '0.85rem', fontWeight: 600, color: '#334155',
  display: 'flex', alignItems: 'center', gap: '6px'
};
const inputStyle = {
  padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1',
  fontSize: '0.95rem', color: '#1e293b', backgroundColor: '#fff'
};
const btnCancelStyle = {
  backgroundColor: '#f1f5f9', color: '#475569', textDecoration: 'none',
  padding: '10px 18px', borderRadius: '8px', fontWeight: 600, display: 'inline-flex', alignItems: 'center'
};
const btnSaveStyle = {
  backgroundColor: '#2ecc71', color: '#fff', border: 'none',
  padding: '10px 22px', borderRadius: '8px', fontWeight: 700,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px'
};

export default Formularionpx;