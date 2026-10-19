import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { ref, get, update, set, onValue } from 'firebase/database';
import { 
  FaArrowLeft, FaUserEdit, FaSave, FaEnvelope, 
  FaPhoneAlt, FaMapMarkerAlt, FaIdBadge, FaCalendarCheck, 
  FaCamera, FaUserMd, FaUserNurse, FaGraduationCap,
  FaEye, FaEyeSlash, FaStar, FaUniversity, FaSignature, FaTrashAlt, FaUpload, FaLock
} from 'react-icons/fa';
import { ESTADOS_REPUBLICA } from '../constantes/estados';
import { estaVigenciaVencida } from '../utilidades/verificadorVigencia';
import '../Estilos/Miperfil.css';

const Miperfil = () => {
  const { uid } = useParams();
  const targetUid = uid || auth.currentUser?.uid;

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [ramaEncontrada, setRamaEncontrada] = useState('');
  const [vigenciaVencida, setVigenciaVencida] = useState(
    localStorage.getItem('vigenciaVencida') === 'true'
  );

  const [formData, setFormData] = useState({
    nombre: '',
    correo: '',
    num_cel: '',
    direccion: '',
    localidad: '',
    rol: '',
    vigencia: '',
    fotoperfil: '',
    visibilidad: 'publico',
    oculto: false,
    calificacion: 5,
    recibirNotificaciones: true,
    // Campos para Médico
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
    firma: '',
    // Campos para Enfermero
    cedula: '',
    especialidad_enf: '',
    universidad_enf: ''
  });

  useEffect(() => {
    if (!targetUid) return;

    let unsubscribe = null;

    const buscarPerfilPorRol = async () => {
      setCargando(true);
      const rolLocal = (localStorage.getItem('rolActivo') || '').toLowerCase();

      const ramasPosibles = [
        rolLocal,
        'admin',
        'medico',
        'enfermero',
        'enfermeria',
        'enfemero',
        'otro',
        'px'
      ].filter((valor, indice, self) => valor && self.indexOf(valor) === indice);

      let ramaDetectada = '';

      for (const rama of ramasPosibles) {
        const snap = await get(ref(db, `usuarios/${rama}/${targetUid}`));
        if (snap.exists()) {
          ramaDetectada = rama;
          break;
        }
      }

      if (ramaDetectada) {
        setRamaEncontrada(ramaDetectada);
        const perfilRef = ref(db, `usuarios/${ramaDetectada}/${targetUid}`);
        
        unsubscribe = onValue(perfilRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            const esOculto = data.oculto === true || data.visibilidad === 'oculto';

            // Evaluar si la vigencia está vencida (para Médico y Enfermería)
            const rolEval = String(data.rol || ramaDetectada).toLowerCase();
            const aplicaVigencia = 
              ramaDetectada === 'medico' || 
              ramaDetectada === 'enfermeria' || 
              ramaDetectada === 'enfermero' || 
              ramaDetectada === 'enfemero' || 
              rolEval === 'medico' || 
              rolEval.includes('enfermer');

            if (aplicaVigencia) {
              const vencida = estaVigenciaVencida(data.vigencia);
              setVigenciaVencida(vencida);
              localStorage.setItem('vigenciaVencida', vencida ? 'true' : 'false');
              if (vencida) setEditMode(false);
            } else {
              setVigenciaVencida(false);
            }

            // Consultar también las carpetas dedicadas fotoperfil/[uid] y fimas/[uid]
            let fotoGuardada = data.fotoperfil || '';
            let firmaGuardada = data.firma || '';

            if (!fotoGuardada) {
              const snapFoto = await get(ref(db, `fotoperfil/${targetUid}`));
              if (snapFoto.exists()) fotoGuardada = snapFoto.val().url || snapFoto.val().imagen || '';
            }
            if (!firmaGuardada) {
              const snapFirma = await get(ref(db, `fimas/${targetUid}`));
              if (snapFirma.exists()) firmaGuardada = snapFirma.val().url || snapFirma.val().imagen || '';
            }

            setFormData({
              nombre: data.nombre || data.nombrecom || '',
              correo: data.correo || auth.currentUser?.email || '',
              num_cel: data.num_cel || data.celular || '',
              direccion: data.direccion || '',
              localidad: data.localidad || '',
              rol: data.rol || ramaDetectada,
              vigencia: data.vigencia || 'N/A',
              fotoperfil: fotoGuardada,
              visibilidad: esOculto ? 'oculto' : 'publico',
              oculto: esOculto,
              calificacion: data.calificacion !== undefined ? Number(data.calificacion) : 5,
              recibirNotificaciones: data.recibirNotificaciones !== undefined ? data.recibirNotificaciones : true,
              cedula_partero: data.cedula_partero || data.cedula || '',
              universidad: data.universidad || '',
              especialidad1: data.especialidad1 || '',
              cedula_esp1: data.cedula_esp1 || '',
              universidad_esp1: data.universidad_esp1 || '',
              especialidad2: data.especialidad2 || '',
              cedula_esp2: data.cedula_esp2 || '',
              universidad_esp2: data.universidad_esp2 || '',
              especialidad3: data.especialidad3 || '',
              cedula_esp3: data.cedula_esp3 || '',
              universidad_esp3: data.universidad_esp3 || '',
              firma: firmaGuardada,
              cedula: data.cedula || '',
              especialidad_enf: data.especialidad_enf || data.especialidad || '',
              universidad_enf: data.universidad_enf || ''
            });
          }
          setCargando(false);
        });
      } else {
        setCargando(false);
      }
    };

    buscarPerfilPorRol();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [targetUid]);

  const rolTexto = (formData.rol || '').trim().toLowerCase();
  const ramaTexto = (ramaEncontrada || '').trim().toLowerCase();

  const esMedico = ramaTexto === 'medico' || rolTexto === 'medico' || rolTexto === 'médico';
  const esEnfermero = 
    ramaTexto === 'enfermeria' || 
    ramaTexto === 'enfermero' || 
    ramaTexto === 'enfemero' || 
    rolTexto.includes('enfermer');

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'visibilidad') {
      setFormData({
        ...formData,
        visibilidad: value,
        oculto: value === 'oculto'
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleSubirImagenFotoPerfil = (e) => {
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

  const handleSubirImagenFirma = (e) => {
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
        const maxWidth = 450;
        const maxHeight = 180;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/png');
        setFormData((prev) => ({ ...prev, firma: dataUrl }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const toggleVisibilidadRapida = async () => {
    if (vigenciaVencida) {
      return alert("⛔ Modo de solo lectura: Tu vigencia está vencida y no puedes modificar tu perfil.");
    }
    if (!ramaEncontrada || !targetUid) return;
    const nuevoOculto = !formData.oculto;
    const nuevaVisibilidad = nuevoOculto ? 'oculto' : 'publico';
    try {
      await update(ref(db, `usuarios/${ramaEncontrada}/${targetUid}`), {
        visibilidad: nuevaVisibilidad,
        oculto: nuevoOculto
      });
    } catch (error) {
      console.error("Error al cambiar visibilidad:", error);
    }
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (vigenciaVencida) {
      return alert("⛔ Acción bloqueada: Tu vigencia está vencida y no puedes editar información.");
    }
    if (!ramaEncontrada || !targetUid) {
      return alert("Error: No se encontró la ruta del perfil para actualizar.");
    }

    setGuardando(true);
    try {
      const datosActualizar = {
        nombre: formData.nombre,
        num_cel: formData.num_cel,
        direccion: formData.direccion,
        localidad: formData.localidad,
        fotoperfil: formData.fotoperfil || '',
        visibilidad: formData.visibilidad,
        oculto: formData.visibilidad === 'oculto',
        calificacion: Number(formData.calificacion) || 0,
        recibirNotificaciones: Boolean(formData.recibirNotificaciones)
      };

      // 1. Guardar la Foto de Perfil en la carpeta/ruta "fotoperfil/[uid]"
      await set(ref(db, `fotoperfil/${targetUid}`), {
        uid: targetUid,
        nombreArchivo: `${targetUid}.png`,
        ruta: `fotoperfil/${targetUid}`,
        url: formData.fotoperfil || '',
        fechaActualizacion: new Date().toISOString()
      });

      if (esMedico) {
        datosActualizar.cedula_partero = formData.cedula_partero;
        datosActualizar.universidad = formData.universidad;
        datosActualizar.especialidad1 = formData.especialidad1;
        datosActualizar.cedula_esp1 = formData.cedula_esp1;
        datosActualizar.universidad_esp1 = formData.universidad_esp1;
        datosActualizar.especialidad2 = formData.especialidad2;
        datosActualizar.cedula_esp2 = formData.cedula_esp2;
        datosActualizar.universidad_esp2 = formData.universidad_esp2;
        datosActualizar.especialidad3 = formData.especialidad3;
        datosActualizar.cedula_esp3 = formData.cedula_esp3;
        datosActualizar.universidad_esp3 = formData.universidad_esp3;
        datosActualizar.firma = formData.firma || '';

        // 2. Guardar la Firma en "fimas/[uid]" y "firmas/[uid]"
        const objetoFirma = {
          uid: targetUid,
          nombreArchivo: `${targetUid}.png`,
          ruta: `fimas/${targetUid}`,
          url: formData.firma || '',
          fechaActualizacion: new Date().toISOString()
        };
        await set(ref(db, `fimas/${targetUid}`), objetoFirma);
        await set(ref(db, `firmas/${targetUid}`), objetoFirma);
      }

      if (esEnfermero) {
        datosActualizar.cedula = formData.cedula;
        datosActualizar.especialidad_enf = formData.especialidad_enf;
        datosActualizar.especialidad = formData.especialidad_enf;
        datosActualizar.universidad_enf = formData.universidad_enf;
      }

      await update(ref(db, `usuarios/${ramaEncontrada}/${targetUid}`), datosActualizar);
      alert("¡Datos, foto de perfil y firma guardados correctamente!");
      setEditMode(false);
    } catch (error) {
      console.error("Error al actualizar perfil:", error);
      alert("Ocurrió un error al guardar los cambios.");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return <div style={{ textAlign: 'center', marginTop: '60px' }}>Cargando información de tu perfil...</div>;
  }

  if (!ramaEncontrada) {
    return (
      <div className='miperfil-container'>
        <Link to="/" className='btn-regresar-perfil'><FaArrowLeft /> Volver al Panel</Link>
        <div className='perfil-empty'>
          <h3>No se encontraron datos para este usuario</h3>
          <p>Verifica que tu UID esté registrado dentro de la rama correspondiente en <code>usuarios/[rol]/{targetUid}</code>.</p>
        </div>
      </div>
    );
  }

  const avatarDefault = 'https://cdn-icons-png.flaticon.com/512/3774/3774299.png';

  return (
    <div className='miperfil-container'>
      
      {/* BANNER DE VIGENCIA VENCIDA */}
      {vigenciaVencida && (
        <div style={{
          backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba',
          borderRadius: '10px', padding: '12px 16px', marginBottom: '18px',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <FaLock />
          <span>
            <strong>Vigencia Vencida ({formData.vigencia}):</strong> Tu perfil se encuentra en modo solo lectura. Contacta al Administrador para renovar tu vigencia y habilitar la edición.
          </span>
        </div>
      )}

      {/* HEADER */}
      <div className='miperfil-header'>
        <Link to="/" className='btn-regresar-perfil'>
          <FaArrowLeft /> Volver al Panel de Control
        </Link>

        {!editMode && !vigenciaVencida && (
          <button onClick={() => setEditMode(true)} className='btn-editar-perfil'>
            <FaUserEdit /> Editar Mi Información
          </button>
        )}
      </div>

      {/* TARJETA PRINCIPAL DE PERFIL */}
      <div className='miperfil-card'>
        
        <div className='miperfil-banner'>
          <div className='miperfil-avatar-box'>
            <img 
              src={formData.fotoperfil || avatarDefault} 
              alt="Foto de perfil" 
              className='miperfil-avatar'
            />
          </div>
          <div className='miperfil-banner-info'>
            <div className='banner-top-row'>
              <h2>{formData.nombre || 'Sin nombre registrado'}</h2>
              
              <div className='banner-rating' title={`Calificación: ${formData.calificacion} de 5`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <FaStar 
                    key={star} 
                    className={star <= Math.round(formData.calificacion) ? 'star-filled' : 'star-empty'} 
                  />
                ))}
                <span className='rating-number'>{Number(formData.calificacion).toFixed(1)}</span>
              </div>
            </div>

            <div className='miperfil-badges'>
              <span className='badge-rol'>
                <FaIdBadge /> Rol: {formData.rol}
              </span>
              <span className='badge-vigencia' style={vigenciaVencida ? { backgroundColor: '#fee2e2', color: '#991b1b' } : {}}>
                <FaCalendarCheck /> Vigencia: {formData.vigencia} {vigenciaVencida ? '(Vencida)' : ''}
              </span>
              <span className='badge-ruta'>
                Ruta: usuarios/{ramaEncontrada}
              </span>

              <button 
                type="button" 
                onClick={toggleVisibilidadRapida} 
                disabled={vigenciaVencida}
                style={vigenciaVencida ? { opacity: 0.65, cursor: 'not-allowed' } : {}}
                className={`badge-visibilidad-btn ${formData.oculto ? 'estado-oculto' : 'estado-publico'}`}
              >
                {formData.oculto ? (
                  <><FaEyeSlash /> Ocultar a otros</>
                ) : (
                  <><FaEye /> Público</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* FORMULARIO / VISTA DE DATOS */}
        <form onSubmit={handleGuardar} className='miperfil-form'>
          
          <h4 className='perfil-section-title'>Visibilidad, Alertas y Calificación</h4>
          <div className='miperfil-grid' style={{ marginBottom: '25px' }}>
            
            <div className='perfil-field'>
              <label>
                {formData.visibilidad === 'oculto' ? <FaEyeSlash /> : <FaEye />} Estado de Visibilidad
              </label>
              <select
                name="visibilidad"
                value={formData.visibilidad}
                onChange={handleChange}
                disabled={!editMode || vigenciaVencida}
                className={(!editMode || vigenciaVencida) ? 'input-locked' : ''}
              >
                <option value="publico">Público (Visible para otros usuarios)</option>
                <option value="oculto">Ocultar a otros (Privado)</option>
              </select>
            </div>

            <div className='perfil-field'>
              <label>🔔 Notificaciones y Alertas Clínicas</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                <input 
                  type="checkbox" 
                  name="recibirNotificaciones" 
                  checked={formData.recibirNotificaciones} 
                  onChange={(e) => setFormData({ ...formData, recibirNotificaciones: e.target.checked })}
                  disabled={!editMode || vigenciaVencida}
                  style={{ width: '20px', height: '20px', cursor: (editMode && !vigenciaVencida) ? 'pointer' : 'default' }}
                />
                <span style={{ fontSize: '0.9rem', color: formData.recibirNotificaciones ? '#27ae60' : '#7f8c8d', fontWeight: 600 }}>
                  {formData.recibirNotificaciones ? 'Activadas (Recibir alertas)' : 'Desactivadas (Silenciado)'}
                </span>
              </div>
            </div>

          </div>

          <h4 className='perfil-section-title'>Datos Generales y de Contacto</h4>
          <div className='miperfil-grid'>
            
            <div className='perfil-field'>
              <label>Nombre Completo</label>
              <input 
                type="text" 
                name="nombre" 
                value={formData.nombre} 
                onChange={handleChange} 
                readOnly={!editMode || vigenciaVencida}
                className={(!editMode || vigenciaVencida) ? 'input-locked' : ''}
                required
              />
            </div>

            <div className='perfil-field'>
              <label><FaEnvelope /> Correo Electrónico (Cuenta)</label>
              <input 
                type="email" 
                name="correo" 
                value={formData.correo} 
                readOnly 
                className='input-locked'
              />
            </div>

            <div className='perfil-field'>
              <label><FaPhoneAlt /> Teléfono / Celular</label>
              <input 
                type="text" 
                name="num_cel" 
                value={formData.num_cel} 
                onChange={handleChange} 
                readOnly={!editMode || vigenciaVencida}
                className={(!editMode || vigenciaVencida) ? 'input-locked' : ''}
              />
            </div>

            <div className='perfil-field'>
              <label><FaMapMarkerAlt /> Dirección</label>
              <input 
                type="text" 
                name="direccion" 
                value={formData.direccion} 
                onChange={handleChange} 
                readOnly={!editMode || vigenciaVencida}
                className={(!editMode || vigenciaVencida) ? 'input-locked' : ''}
              />
            </div>

            <div className='perfil-field'>
              <label>Localidad / Estado</label>
              <select
                name="localidad"
                value={formData.localidad}
                onChange={handleChange}
                disabled={!editMode || vigenciaVencida}
                className={(!editMode || vigenciaVencida) ? 'input-locked' : ''}
              >
                <option value="">Seleccione un estado...</option>
                {ESTADOS_REPUBLICA.map((estado) => (
                  <option key={estado} value={estado}>{estado}</option>
                ))}
              </select>
            </div>

            <div className='perfil-field'>
              <label>Vigencia de cuenta</label>
              <input 
                type="text" 
                value={formData.vigencia} 
                readOnly 
                className='input-locked'
              />
            </div>

            {/* SECCIÓN DE FOTO DE PERFIL */}
            <div className='perfil-field field-full' style={{ marginTop: '10px' }}>
              <label><FaCamera /> Foto de Perfil (Ruta: <code>fotoperfil/{targetUid}</code>)</label>
              
              {editMode && !vigenciaVencida && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{
                    backgroundColor: '#3498db', color: '#fff', padding: '9px 16px',
                    borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
                    display: 'inline-flex', alignItems: 'center', gap: '8px'
                  }}>
                    <FaUpload /> Seleccionar imagen de perfil
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleSubirImagenFotoPerfil} 
                      style={{ display: 'none' }} 
                    />
                  </label>

                  <input 
                    type="text" 
                    name="fotoperfil" 
                    value={formData.fotoperfil && !formData.fotoperfil.startsWith('data:image') ? formData.fotoperfil : ''} 
                    onChange={handleChange} 
                    placeholder="O pega aquí la URL de la imagen (https://...)"
                    style={{ flex: 1, minWidth: '240px' }}
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
                      <FaTrashAlt /> Quitar foto
                    </button>
                  )}
                </div>
              )}

              <div style={{
                backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px',
                padding: '12px', display: 'flex', alignItems: 'center', gap: '16px'
              }}>
                <img 
                  src={formData.fotoperfil || avatarDefault} 
                  alt="Vista previa de perfil" 
                  style={{ width: '68px', height: '68px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #3498db' }} 
                />
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                  <strong>Archivo:</strong> <code>{targetUid}.png</code>
                  <p style={{ margin: '3px 0 0 0', color: '#64748b' }}>
                    {formData.fotoperfil ? 'Imagen lista y vinculada a tu UID.' : 'Usando avatar predeterminado.'}
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* SECCIÓN EXCLUSIVA PARA MÉDICO */}
          {esMedico && (
            <>
              <h4 className='perfil-section-title' style={{ marginTop: '30px' }}>
                <FaUserMd /> Acreditación Médica, Especialidades y Firma Digital
              </h4>
              <div className='miperfil-grid'>
                
                <div className='perfil-field'>
                  <label><FaGraduationCap /> Cédula Médico Cirujano y Partero</label>
                  <input 
                    type="text" 
                    name="cedula_partero" 
                    value={formData.cedula_partero} 
                    onChange={handleChange} 
                    readOnly={!editMode || vigenciaVencida}
                    placeholder="Cédula de Médico Partero"
                    className={(!editMode || vigenciaVencida) ? 'input-locked' : ''}
                  />
                </div>

                <div className='perfil-field'>
                  <label><FaUniversity /> Universidad (Médico Partero)</label>
                  <input 
                    type="text" 
                    name="universidad" 
                    value={formData.universidad} 
                    onChange={handleChange} 
                    readOnly={!editMode || vigenciaVencida}
                    placeholder="Ej. UANL, UNAM, ITESM..."
                    className={(!editMode || vigenciaVencida) ? 'input-locked' : ''}
                  />
                </div>

                {/* Especialidad 1 */}
                <div className='perfil-field'>
                  <label>Especialidad (1)</label>
                  <input 
                    type="text" 
                    name="especialidad1" 
                    value={formData.especialidad1} 
                    onChange={handleChange} 
                    readOnly={!editMode || vigenciaVencida}
                    placeholder="Ej. Cardiología, Pediatría..."
                    className={(!editMode || vigenciaVencida) ? 'input-locked' : ''}
                  />
                </div>
                <div className='perfil-field'>
                  <label>Cédula de Especialidad (1)</label>
                  <input 
                    type="text" 
                    name="cedula_esp1" 
                    value={formData.cedula_esp1} 
                    onChange={handleChange} 
                    readOnly={!editMode || vigenciaVencida}
                    placeholder="Número de cédula esp. 1"
                    className={(!editMode || vigenciaVencida) ? 'input-locked' : ''}
                  />
                </div>
                <div className='perfil-field field-full'>
                  <label><FaUniversity /> Universidad de Especialidad (1)</label>
                  <input 
                    type="text" 
                    name="universidad_esp1" 
                    value={formData.universidad_esp1} 
                    onChange={handleChange} 
                    readOnly={!editMode || vigenciaVencida}
                    placeholder="Institución que avala la Especialidad 1"
                    className={(!editMode || vigenciaVencida) ? 'input-locked' : ''}
                  />
                </div>

                {/* Especialidad 2 */}
                <div className='perfil-field'>
                  <label>Especialidad (2)</label>
                  <input 
                    type="text" 
                    name="especialidad2" 
                    value={formData.especialidad2} 
                    onChange={handleChange} 
                    readOnly={!editMode || vigenciaVencida}
                    placeholder="Opcional - Segunda especialidad"
                    className={(!editMode || vigenciaVencida) ? 'input-locked' : ''}
                  />
                </div>
                <div className='perfil-field'>
                  <label>Cédula de Especialidad (2)</label>
                  <input 
                    type="text" 
                    name="cedula_esp2" 
                    value={formData.cedula_esp2} 
                    onChange={handleChange} 
                    readOnly={!editMode || vigenciaVencida}
                    placeholder="Número de cédula esp. 2"
                    className={(!editMode || vigenciaVencida) ? 'input-locked' : ''}
                  />
                </div>
                <div className='perfil-field field-full'>
                  <label><FaUniversity /> Universidad de Especialidad (2)</label>
                  <input 
                    type="text" 
                    name="universidad_esp2" 
                    value={formData.universidad_esp2} 
                    onChange={handleChange} 
                    readOnly={!editMode || vigenciaVencida}
                    placeholder="Institución que avala la Especialidad 2"
                    className={(!editMode || vigenciaVencida) ? 'input-locked' : ''}
                  />
                </div>

                {/* Especialidad 3 */}
                <div className='perfil-field'>
                  <label>Especialidad (3)</label>
                  <input 
                    type="text" 
                    name="especialidad3" 
                    value={formData.especialidad3} 
                    onChange={handleChange} 
                    readOnly={!editMode || vigenciaVencida}
                    placeholder="Opcional - Tercera especialidad / Subespecialidad"
                    className={(!editMode || vigenciaVencida) ? 'input-locked' : ''}
                  />
                </div>
                <div className='perfil-field'>
                  <label>Cédula de Especialidad (3)</label>
                  <input 
                    type="text" 
                    name="cedula_esp3" 
                    value={formData.cedula_esp3} 
                    onChange={handleChange} 
                    readOnly={!editMode || vigenciaVencida}
                    placeholder="Número de cédula esp. 3"
                    className={(!editMode || vigenciaVencida) ? 'input-locked' : ''}
                  />
                </div>
                <div className='perfil-field field-full'>
                  <label><FaUniversity /> Universidad de Especialidad (3)</label>
                  <input 
                    type="text" 
                    name="universidad_esp3" 
                    value={formData.universidad_esp3} 
                    onChange={handleChange} 
                    readOnly={!editMode || vigenciaVencida}
                    placeholder="Institución que avala la Especialidad 3"
                    className={(!editMode || vigenciaVencida) ? 'input-locked' : ''}
                  />
                </div>

                {/* CAMPO DE FIRMA DEL MÉDICO */}
                <div className='perfil-field field-full' style={{ marginTop: '10px' }}>
                  <label><FaSignature /> Firma del Médico (Ruta: <code>fimas/{targetUid}</code>)</label>
                  
                  {editMode && !vigenciaVencida && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
                      <label style={{
                        backgroundColor: '#3498db', color: '#fff', padding: '9px 16px',
                        borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
                        display: 'inline-flex', alignItems: 'center', gap: '8px'
                      }}>
                        <FaUpload /> Subir imagen de firma (PNG / JPG)
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleSubirImagenFirma} 
                          style={{ display: 'none' }} 
                        />
                      </label>

                      <input 
                        type="text" 
                        name="firma" 
                        value={formData.firma && !formData.firma.startsWith('data:image') ? formData.firma : ''} 
                        onChange={handleChange} 
                        placeholder="O pega aquí la URL directa de tu firma (https://...)"
                        style={{ flex: 1, minWidth: '240px' }}
                      />

                      {formData.firma && (
                        <button 
                          type="button" 
                          onClick={() => setFormData({ ...formData, firma: '' })}
                          style={{
                            backgroundColor: '#fceceb', color: '#e74c3c', border: '1px solid #f5b7b1',
                            padding: '9px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600,
                            display: 'inline-flex', alignItems: 'center', gap: '6px'
                          }}
                        >
                          <FaTrashAlt /> Quitar firma
                        </button>
                      )}
                    </div>
                  )}

                  <div style={{
                    backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px',
                    padding: '16px', textAlign: 'center', minHeight: '90px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
                  }}>
                    {formData.firma ? (
                      <>
                        <img 
                          src={formData.firma} 
                          alt="Firma del médico" 
                          style={{ maxHeight: '75px', maxWidth: '240px', objectFit: 'contain', marginBottom: '6px' }} 
                        />
                        <div style={{ width: '210px', borderTop: '1px solid #334155', paddingTop: '4px', fontSize: '0.8rem', color: '#475569' }}>
                          Archivo: <code>{targetUid}.png</code> (sobre línea de receta)
                        </div>
                      </>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                        Sin imagen de firma registrada. {(editMode && !vigenciaVencida) ? 'Sube una imagen con fondo transparente o blanco.' : ''}
                      </span>
                    )}
                  </div>
                </div>

              </div>
            </>
          )}

          {/* SECCIÓN EXCLUSIVA PARA ENFERMERÍA */}
          {esEnfermero && (
            <>
              <h4 className='perfil-section-title' style={{ marginTop: '30px' }}>
                <FaUserNurse /> Acreditación de Enfermería
              </h4>
              <div className='miperfil-grid'>
                <div className='perfil-field'>
                  <label><FaGraduationCap /> Cédula Profesional</label>
                  <input 
                    type="text" 
                    name="cedula" 
                    value={formData.cedula} 
                    onChange={handleChange} 
                    readOnly={!editMode || vigenciaVencida}
                    placeholder="Número de cédula profesional"
                    className={(!editMode || vigenciaVencida) ? 'input-locked' : ''}
                  />
                </div>

                <div className='perfil-field'>
                  <label>Especialidad</label>
                  <input 
                    type="text" 
                    name="especialidad_enf" 
                    value={formData.especialidad_enf} 
                    onChange={handleChange} 
                    readOnly={!editMode || vigenciaVencida}
                    placeholder="Ej. Enfermería Quirúrgica, Cuidados Intensivos..."
                    className={(!editMode || vigenciaVencida) ? 'input-locked' : ''}
                  />
                </div>
              </div>
            </>
          )}

          {editMode && !vigenciaVencida && (
            <div className='miperfil-actions'>
              <button 
                type="button" 
                onClick={() => setEditMode(false)} 
                className='btn-cancelar-perfil'
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={guardando} 
                className='btn-guardar-perfil'
              >
                <FaSave /> {guardando ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          )}
        </form>

      </div>
    </div>
  );
};

export default Miperfil;