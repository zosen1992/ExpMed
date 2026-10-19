import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { ref, onValue, set, push, update, get, remove } from 'firebase/database';
import { FaArrowLeft, FaPlus, FaEdit, FaTimes, FaSave, FaEye, FaTrashAlt, FaLock } from 'react-icons/fa';
import { PiSealWarningDuotone } from "react-icons/pi";
import { estaVigenciaVencida } from '../utilidades/verificadorVigencia';
import '../Estilos/Alergias.css';

const Alergias = () => {
  const { id } = useParams(); // ID del paciente
  const myuid = auth.currentUser?.uid; // UID del usuario logueado

  const [alergias, setAlergias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [vigenciaVencida, setVigenciaVencida] = useState(
    localStorage.getItem('vigenciaVencida') === 'true'
  );

  // Estados del Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [editPid, setEditPid] = useState(null);

  const [formData, setFormData] = useState({
    alergia: '',
    nota: '',
    firma: ''
  });

  useEffect(() => {
    if (myuid) {
      // 1. Buscar el nombre y estado de vigencia del usuario logueado
      const obtenerNombreYVigencia = async () => {
        const rolLocal = localStorage.getItem('rolActivo');
        const ramas = rolLocal 
          ? [rolLocal, 'medico', 'enfermeria', 'enfermero', 'enfemero', 'px', 'admin', 'otro'] 
          : ['medico', 'enfermeria', 'enfermero', 'enfemero', 'px', 'admin', 'otro'];

        for (const r of ramas) {
          const snap = await get(ref(db, `usuarios/${r}/${myuid}`));
          if (snap.exists()) {
            const val = snap.val();
            const nombreDetectado = val.nombre || val.nombrecom || auth.currentUser?.email || "Usuario";
            setNombreUsuario(nombreDetectado);

            const rolLow = String(val.rol || r).toLowerCase();
            if (r === 'medico' || r === 'enfermeria' || r === 'enfermero' || r === 'enfemero' || rolLow === 'medico' || rolLow.includes('enfermer')) {
              const vencida = estaVigenciaVencida(val.vigencia);
              setVigenciaVencida(vencida);
              localStorage.setItem('vigenciaVencida', vencida ? 'true' : 'false');
            } else {
              setVigenciaVencida(false);
            }
            break;
          }
        }
      };

      obtenerNombreYVigencia();

      // 2. Obtener las alergias del paciente
      if (id) {
        const alergiasRef = ref(db, `alergias/${id}`);
        const unsubscribeAlergias = onValue(alergiasRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            const alergiasArray = Object.keys(data).map(key => ({
              pid: key,
              ...data[key]
            })).reverse();
            setAlergias(alergiasArray);
          } else {
            setAlergias([]);
          }
          setCargando(false);
        });

        return () => {
          unsubscribeAlergias();
        };
      }
    }
  }, [id, myuid]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const abrirModalNuevo = () => {
    if (vigenciaVencida) {
      return alert("⛔ Modo de solo lectura: Tu vigencia está vencida y no puedes agregar nuevas alergias.");
    }
    setIsEditing(false);
    setIsReadOnly(false);
    setEditPid(null);
    setFormData({ 
      alergia: '', 
      nota: '', 
      firma: nombreUsuario || auth.currentUser?.email || 'Usuario Clínico' 
    });
    setIsModalOpen(true);
  };

  // Función para Ver (modoLectura = true) o Editar (modoLectura = false)
  const abrirModalRegistro = (alergiaItem, modoLectura = false) => {
    if (vigenciaVencida) {
      if (alergiaItem.uidcap !== myuid) {
        return alert("Con vigencia vencida solo puedes visualizar registros creados por ti.");
      }
      modoLectura = true;
    }

    if (!modoLectura && alergiaItem.uidcap !== myuid) {
      return alert("Acceso denegado: Solo el usuario que registró esta alergia puede editarla.");
    }

    setIsEditing(!modoLectura);
    setIsReadOnly(modoLectura);
    setEditPid(alergiaItem.pid);

    setFormData({
      alergia: alergiaItem.alergia || '',
      nota: alergiaItem.nota || '',
      firma: modoLectura 
        ? (alergiaItem.firma || 'Sin firma') 
        : (nombreUsuario || alergiaItem.firma || auth.currentUser?.email),
      uidcap: alergiaItem.uidcap
    });
    setIsModalOpen(true);
  };

  // Eliminar alergia (Solo quien la agregó y con vigencia activa)
  const handleEliminar = async (alergiaItem) => {
    if (vigenciaVencida) {
      return alert("⛔ Acción bloqueada: No puedes eliminar registros con vigencia vencida.");
    }
    if (alergiaItem.uidcap !== myuid) {
      return alert("Acceso denegado: Solo el usuario que agregó esta alergia puede eliminarla.");
    }

    const confirmar = window.confirm(`¿Estás seguro de que deseas eliminar el registro de alergia "${alergiaItem.alergia}"?`);
    if (confirmar) {
      try {
        await remove(ref(db, `alergias/${id}/${alergiaItem.pid}`));
        alert("Alergia eliminada correctamente.");
      } catch (error) {
        console.error("Error al eliminar alergia:", error);
        alert("No se pudo eliminar el registro.");
      }
    }
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!myuid) return alert("Error: Sesión no válida.");
    if (vigenciaVencida) {
      return alert("⛔ Acción bloqueada: Tu cuenta está en modo solo lectura por vigencia vencida.");
    }

    try {
      const fechaActual = new Date().toLocaleString('es-MX', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
      });

      const firmaFinal = formData.firma?.trim() || nombreUsuario || auth.currentUser?.email || "Usuario";

      if (isEditing) {
        if (formData.uidcap && formData.uidcap !== myuid) {
          return alert("No tienes permiso para modificar este registro.");
        }
        const actualizacion = {
          alergia: formData.alergia,
          nota: formData.nota,
          firma: firmaFinal,
          uidcap: myuid 
        };
        await update(ref(db, `alergias/${id}/${editPid}`), actualizacion);
        alert("Alergia actualizada correctamente.");
      } else {
        const nuevaAlergiaRef = push(ref(db, `alergias/${id}`));
        const pidGenerado = nuevaAlergiaRef.key;

        const nuevaAlergia = {
          alergia: formData.alergia,
          fecha: fechaActual,
          firma: firmaFinal,
          fotoperfil: "null",
          nota: formData.nota,
          pid: pidGenerado,
          uid: id,         
          uidcap: myuid    
        };
        await set(nuevaAlergiaRef, nuevaAlergia);
        alert("Alergia registrada correctamente.");
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error al guardar alergia:", error);
      alert("Hubo un error al procesar la solicitud.");
    }
  };

  // Si la vigencia está vencida, solo ve las alergias que él mismo capturó
  const alergiasVisibles = vigenciaVencida
    ? alergias.filter((item) => item.uidcap === myuid)
    : alergias;

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Cargando alergias...</div>;

  return (
    <div className='alergias-container'>
      {vigenciaVencida && (
        <div style={{
          backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba',
          borderRadius: '10px', padding: '12px 16px', marginBottom: '18px',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <FaLock />
          <span>
            <strong>Modo Solo Lectura (Vigencia Vencida):</strong> Solo se muestran las alergias registradas por ti. No puedes agregar, editar ni eliminar información.
          </span>
        </div>
      )}

      <div className='alergias-header'>
        <Link to={`/px/${id}`} className='btn-regresar'>
          <FaArrowLeft /> Regresar al menú
        </Link>
        <h2 className='alergias-titulo'><PiSealWarningDuotone /> Registro de Alergias</h2>
      </div>

      {alergiasVisibles.length === 0 ? (
        <div className='empty-state'>
          <PiSealWarningDuotone className='empty-icon' />
          <h3>{vigenciaVencida ? 'Sin registros propios de alergias' : 'No hay información registrada'}</h3>
          <p>
            {vigenciaVencida
              ? 'Con vigencia vencida solo puedes visualizar registros que hayan sido capturados por ti.'
              : 'Este paciente no tiene alergias capturadas en el sistema.'}
          </p>
          {!vigenciaVencida && (
            <button onClick={abrirModalNuevo} className='btn-agregar-main'>
              <FaPlus /> Agregar Alergia
            </button>
          )}
        </div>
      ) : (
        <div className='lista-alergias'>
          {!vigenciaVencida && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
               <button onClick={abrirModalNuevo} className='btn-agregar-small'>
                 <FaPlus /> Nueva Alergia
               </button>
            </div>
          )}

          {alergiasVisibles.map((item) => {
            const esAutor = item.uidcap === myuid;
            return (
              <div key={item.pid} className='alergia-card'>
                <div className='alergia-info'>
                  <h4 className='alergia-nombre'>{item.alergia}</h4>
                  <p className='alergia-firma'><strong>Firma:</strong> {item.firma || 'N/D'}</p>
                  {item.nota && <p className='alergia-nota'><strong>Nota:</strong> {item.nota}</p>}
                  <p className='alergia-fecha'>Capturado: {item.fecha}</p>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => abrirModalRegistro(item, true)} 
                    className='btn-ver-alergia'
                    style={{
                      backgroundColor: '#ecf0f1',
                      color: '#2c3e50',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontWeight: 500
                    }}
                  >
                    <FaEye /> Ver
                  </button>

                  {/* Botones EDITAR y ELIMINAR solo si es autor y su vigencia NO está vencida */}
                  {esAutor && !vigenciaVencida && (
                    <>
                      <button onClick={() => abrirModalRegistro(item, false)} className='btn-editar'>
                        <FaEdit /> Editar
                      </button>

                      <button 
                        onClick={() => handleEliminar(item)} 
                        className='btn-eliminar-alergia'
                        style={{
                          backgroundColor: '#fceceb',
                          color: '#e74c3c',
                          border: 'none',
                          padding: '8px 14px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                      >
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

      {isModalOpen && (
        <div className='modal-overlay'>
          <div className='modal-content'>
            <div className='modal-header'>
              <h3>
                {isReadOnly ? 'Detalle de Alergia' : (isEditing ? 'Editar Alergia' : 'Nueva Alergia')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className='btn-close'><FaTimes /></button>
            </div>
            
            <form onSubmit={handleGuardar} className='form-alergia'>
              <label>Alergia / Reacción:</label>
              <input 
                type="text" 
                name="alergia" 
                value={formData.alergia} 
                onChange={handleChange} 
                placeholder="Ej. Penicilina, Nueces..." 
                required 
                readOnly={isReadOnly}
                style={isReadOnly ? { backgroundColor: '#f8f9fa' } : {}}
              />

              <label>Notas adicionales:</label>
              <textarea 
                name="nota" 
                value={formData.nota} 
                onChange={handleChange} 
                placeholder="Detalles sobre la reacción o gravedad..."
                rows="3"
                readOnly={isReadOnly}
                style={isReadOnly ? { backgroundColor: '#f8f9fa' } : {}}
              />

              <label>Firma del responsable:</label>
              <input 
                type="text" 
                name="firma" 
                value={formData.firma || nombreUsuario} 
                readOnly
                style={{ backgroundColor: '#e9ecef', color: '#6c757d', cursor: 'not-allowed' }} 
              />

              <div className='modal-actions'>
                <button type="button" onClick={() => setIsModalOpen(false)} className='btn-cancelar'>
                  {isReadOnly ? 'Cerrar' : 'Cancelar'}
                </button>
                {!isReadOnly && !vigenciaVencida && (
                  <button type="submit" className='btn-guardar'>
                    <FaSave /> {isEditing ? 'Actualizar' : 'Guardar'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Alergias;