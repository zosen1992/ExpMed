import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { ref, onValue, update, set } from 'firebase/database';
import { 
  FaArrowLeft, FaUserEdit, FaSave, FaPhoneAlt, 
  FaEnvelope, FaMapMarkerAlt, FaIdCard, FaBirthdayCake, 
  FaVenusMars, FaCamera, FaUpload, FaTrashAlt 
} from 'react-icons/fa';
import { ESTADOS_REPUBLICA } from '../constantes/estados';

const Datospx = () => {
  const { id } = useParams();
  const [cargando, setCargando] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '',
    correo: '',
    num_cel: '',
    fecha_nac: '',
    sexo: 'N/A',
    direccion: '',
    localidad: '',
    nss: '',
    fotoperfil: ''
  });

  useEffect(() => {
    if (!id) return;
    const pxRef = ref(db, `usuarios/px/${id}`);
    const unsubscribe = onValue(pxRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setFormData({
          nombre: data.nombre || data.nombrecom || '',
          correo: data.correo || '',
          num_cel: data.num_cel || data.celular || '',
          fecha_nac: data.fecha_nac || data.fechanacimiento || '',
          sexo: data.sexo || 'N/A',
          direccion: data.direccion || '',
          localidad: data.localidad || '',
          nss: data.nss || '',
          fotoperfil: data.fotoperfil || ''
        });
      }
      setCargando(false);
    });

    return () => unsubscribe();
  }, [id]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

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

  const handleGuardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      // Guardar en la carpeta/nodo fotoperfil/[id] con el UID como nombre
      await set(ref(db, `fotoperfil/${id}`), {
        uid: id,
        nombreArchivo: `${id}.png`,
        ruta: `fotoperfil/${id}`,
        url: formData.fotoperfil || '',
        fechaActualizacion: new Date().toISOString()
      });

      await update(ref(db, `usuarios/px/${id}`), {
        nombre: formData.nombre,
        nombrecom: formData.nombre,
        num_cel: formData.num_cel,
        celular: formData.num_cel,
        fecha_nac: formData.fecha_nac,
        fechanacimiento: formData.fecha_nac,
        sexo: formData.sexo,
        direccion: formData.direccion,
        localidad: formData.localidad,
        nss: formData.nss,
        fotoperfil: formData.fotoperfil || ''
      });
      alert("Información y foto de perfil del paciente actualizadas correctamente.");
      setEditMode(false);
    } catch (error) {
      console.error("Error al actualizar datos del paciente:", error);
      alert("Hubo un error al guardar los cambios.");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Cargando información del paciente...</div>;

  const avatarDefault = 'https://cdn-icons-png.flaticon.com/512/387/387561.png';

  return (
    <div style={{ maxWidth: '800px', margin: '30px auto', padding: '0 20px', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Link to={`/px/${id}`} style={btnBackStyle}>
          <FaArrowLeft /> Regresar al menú del paciente
        </Link>

        {!editMode && localStorage.getItem('vigenciaVencida') !== 'true' && (
          <button onClick={() => setEditMode(true)} style={btnEditStyle}>
            <FaUserEdit /> Actualizar Información
          </button>
        )}
      </div>

      <div style={cardContainerStyle}>
        <h2 style={{ marginTop: 0, color: '#2c3e50', borderBottom: '2px solid #eef2f5', paddingBottom: '12px' }}>
          Información General del Paciente
        </h2>

        <form onSubmit={handleGuardar} style={gridFormStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Nombre Completo *</label>
            <input 
              type="text" 
              name="nombre" 
              value={formData.nombre} 
              onChange={handleChange} 
              readOnly={!editMode} 
              required
              style={!editMode ? lockedInputStyle : inputStyle} 
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}><FaEnvelope /> Correo Electrónico</label>
            <input 
              type="text" 
              value={formData.correo} 
              readOnly 
              style={lockedInputStyle} 
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}><FaPhoneAlt /> Teléfono / Celular</label>
            <input 
              type="text" 
              name="num_cel" 
              value={formData.num_cel} 
              onChange={handleChange} 
              readOnly={!editMode} 
              style={!editMode ? lockedInputStyle : inputStyle} 
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}><FaBirthdayCake /> Fecha de Nacimiento</label>
            <input 
              type="date" 
              name="fecha_nac" 
              value={formData.fecha_nac} 
              onChange={handleChange} 
              readOnly={!editMode} 
              style={!editMode ? lockedInputStyle : inputStyle} 
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}><FaVenusMars /> Sexo</label>
            <select 
              name="sexo" 
              value={formData.sexo} 
              onChange={handleChange} 
              disabled={!editMode} 
              style={!editMode ? lockedInputStyle : inputStyle}
            >
              <option value="N/A">Sin especificar</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}><FaIdCard /> NSS (Seguridad Social)</label>
            <input 
              type="text" 
              name="nss" 
              value={formData.nss} 
              onChange={handleChange} 
              readOnly={!editMode} 
              style={!editMode ? lockedInputStyle : inputStyle} 
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}><FaMapMarkerAlt /> Dirección</label>
            <input 
              type="text" 
              name="direccion" 
              value={formData.direccion} 
              onChange={handleChange} 
              readOnly={!editMode} 
              style={!editMode ? lockedInputStyle : inputStyle} 
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}><FaMapMarkerAlt /> Localidad (Estado)</label>
            <select 
              name="localidad" 
              value={formData.localidad} 
              onChange={handleChange} 
              disabled={!editMode} 
              style={!editMode ? lockedInputStyle : inputStyle}
            >
              <option value="">Seleccione un estado...</option>
              {ESTADOS_REPUBLICA.map((estado) => (
                <option key={estado} value={estado}>{estado}</option>
              ))}
            </select>
          </div>

          {/* FOTO DE PERFIL (ARCHIVO O URL) */}
          <div style={{ ...fieldStyle, gridColumn: '1 / -1', marginTop: '8px' }}>
            <label style={labelStyle}><FaCamera /> Foto de Perfil (Ruta: <code>fotoperfil/{id}</code>)</label>
            
            {editMode && (
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
            )}

            <div style={{
              backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px',
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '14px'
            }}>
              <img 
                src={formData.fotoperfil || avatarDefault} 
                alt="Avatar Paciente" 
                style={{ width: '58px', height: '58px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #3498db' }} 
              />
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Archivo: <code>{id}.png</code>
              </span>
            </div>
          </div>

          {editMode && (
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px' }}>
              <button type="button" onClick={() => setEditMode(false)} style={btnCancelStyle}>
                Cancelar
              </button>
              <button type="submit" disabled={guardando} style={btnSaveStyle}>
                <FaSave /> {guardando ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          )}
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
const btnEditStyle = {
  backgroundColor: '#3498db', color: '#fff', border: 'none',
  padding: '10px 16px', borderRadius: '8px', fontWeight: 600,
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
};
const cardContainerStyle = {
  backgroundColor: '#fff', padding: '28px', borderRadius: '14px',
  border: '1px solid #e1e8ed', boxShadow: '0 4px 15px rgba(0,0,0,0.04)'
};
const gridFormStyle = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px'
};
const fieldStyle = { display: 'flex', flexDirection: 'column', gap: '6px' };
const labelStyle = {
  fontSize: '0.85rem', fontWeight: 600, color: '#555',
  display: 'flex', alignItems: 'center', gap: '6px'
};
const inputStyle = {
  padding: '10px 12px', borderRadius: '8px', border: '1px solid #ccd1d1',
  fontSize: '0.95rem', color: '#2c3e50', backgroundColor: '#fff'
};
const lockedInputStyle = {
  ...inputStyle, backgroundColor: '#f8f9fa', color: '#6c757d', borderColor: '#e9ecef'
};
const btnCancelStyle = {
  backgroundColor: '#f1f3f5', color: '#495057', border: 'none',
  padding: '10px 18px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer'
};
const btnSaveStyle = {
  backgroundColor: '#2ecc71', color: '#fff', border: 'none',
  padding: '10px 20px', borderRadius: '8px', fontWeight: 600,
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
};

export default Datospx;