import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { ref, onValue, set, push, update } from 'firebase/database';
import { FaArrowLeft, FaPlus, FaEdit, FaTimes, FaSave, FaEye } from 'react-icons/fa';
import { GiBookPile } from "react-icons/gi";
import '../Estilos/PHc.css';

const PHc = () => {
  const { id } = useParams(); // UID del paciente
  const myuid = auth.currentUser?.uid; // UID del médico

  const [historias, setHistorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nombreMedico, setNombreMedico] = useState("");

  // Estados del Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editPid, setEditPid] = useState(null);
  
  // Estado para solo lectura
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Formulario clínico estándar
  const [formData, setFormData] = useState({
    ahf: '',
    app: '',
    apnp: '',
    ago: '',
    firma: ''
  });

  useEffect(() => {
    if (myuid) {
      const medicoRef = ref(db, `usuarios/medico/${myuid}`);
      const unsubscribeMedico = onValue(medicoRef, (snapshot) => {
        if (snapshot.exists()) setNombreMedico(snapshot.val().nombre);
      });

      if (id) {
        const hcRef = ref(db, `historiaclinica/${id}`);
        const unsubscribeHc = onValue(hcRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            const historiasArray = Object.keys(data).map(key => ({
              pid: key,
              ...data[key]
            })).reverse(); // Invertimos para ver la más reciente primero
            setHistorias(historiasArray);
          } else {
            setHistorias([]);
          }
          setCargando(false);
        });

        return () => {
          unsubscribeMedico();
          unsubscribeHc();
        };
      }
    }
  }, [id, myuid]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const abrirModalNuevo = () => {
    setIsEditing(false);
    setIsReadOnly(false);
    setEditPid(null);
    setFormData({ ahf: '', app: '', apnp: '', ago: '', firma: nombreMedico });
    setIsModalOpen(true);
  };

  const abrirModalEditar = (item, readOnly = false) => {
    setIsEditing(!readOnly);
    setIsReadOnly(readOnly);
    setEditPid(item.pid);
    setFormData({
      ahf: item.ahf || '',
      app: item.app || '',
      apnp: item.apnp || '',
      ago: item.ago || '',
      firma: readOnly ? item.firma : nombreMedico // Si es lectura, muestra el original. Si edita, sella el actual.
    });
    setIsModalOpen(true);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!myuid) return alert("Error: Sesión no válida.");

    try {
      const fechaActual = new Date().toLocaleString('es-MX', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit'
      });

      if (isEditing) {
        const actualizacion = {
          ahf: formData.ahf,
          app: formData.app,
          apnp: formData.apnp,
          ago: formData.ago,
          firma: formData.firma,
          uidcap: myuid,
          ultimaModificacion: fechaActual
        };
        await update(ref(db, `historiaclinica/${id}/${editPid}`), actualizacion);
        alert("Historia clínica actualizada.");
      } else {
        const nuevaHcRef = push(ref(db, `historiaclinica/${id}`));
        const nuevaHc = {
          pid: nuevaHcRef.key,
          uid: id,
          uidcap: myuid,
          fecha: fechaActual,
          ahf: formData.ahf,
          app: formData.app,
          apnp: formData.apnp,
          ago: formData.ago,
          firma: formData.firma
        };
        await set(nuevaHcRef, nuevaHc);
        alert("Historia clínica guardada exitosamente.");
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Hubo un error al guardar la historia clínica.");
    }
  };

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Cargando expediente clínico...</div>;

  return (
    <div className='hc-container'>
      <div className='hc-header'>
        <Link to={`/px/${id}`} className='btn-regresar'>
          <FaArrowLeft /> Regresar al menú
        </Link>
        <h2 className='hc-titulo'><GiBookPile /> Historias Clínicas</h2>
      </div>

      {historias.length === 0 ? (
        <div className='empty-state'>
          <GiBookPile className='empty-icon' />
          <h3>Sin Historia Clínica</h3>
          <p>Es importante realizar el interrogatorio de antecedentes del paciente.</p>
          <button onClick={abrirModalNuevo} className='btn-agregar-main'>
            <FaPlus /> Crear Historia Clínica
          </button>
        </div>
      ) : (
        <div className='lista-hc'>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
             <button onClick={abrirModalNuevo} className='btn-agregar-small'>
               <FaPlus /> Nueva Evaluación
             </button>
          </div>

          {historias.map((item) => (
            <div key={item.pid} className='hc-card'>
              <div className='hc-info'>
                <h4 className='hc-fecha'>Evaluación del: {item.fecha}</h4>
                <p className='hc-resumen'>
                  <strong>AHF:</strong> {item.ahf ? item.ahf.substring(0, 50) + '...' : 'N/D'}
                </p>
                <p className='hc-firma'><strong>Médico:</strong> {item.firma}</p>
                {item.ultimaModificacion && <span className='hc-modificado'>Modificado: {item.ultimaModificacion}</span>}
              </div>
              <div className='hc-acciones'>
                <button onClick={() => abrirModalEditar(item, true)} className='btn-ver'>
                  <FaEye /> Ver
                </button>
                <button onClick={() => abrirModalEditar(item, false)} className='btn-editar'>
                  <FaEdit /> Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DEL FORMULARIO CLÍNICO */}
      {isModalOpen && (
        <div className='modal-overlay-hc'>
          <div className='modal-content-hc'>
            <div className='modal-header-hc'>
              <h3>{isReadOnly ? 'Detalles de Historia Clínica' : (isEditing ? 'Editar Historia Clínica' : 'Nueva Historia Clínica')}</h3>
              <button onClick={() => setIsModalOpen(false)} className='btn-close'><FaTimes /></button>
            </div>
            
            <form onSubmit={handleGuardar} className='form-hc'>
              
              <div className="form-group-hc">
                <label>Antecedentes Heredofamiliares (AHF):</label>
                <textarea 
                  name="ahf" 
                  value={formData.ahf} 
                  onChange={handleChange} 
                  placeholder="Diabetes, Hipertensión, Cáncer en padres o abuelos..."
                  rows="3"
                  readOnly={isReadOnly}
                  className={isReadOnly ? 'input-readonly' : ''}
                />
              </div>

              <div className="form-group-hc">
                <label>Antecedentes Personales Patológicos (APP):</label>
                <textarea 
                  name="app" 
                  value={formData.app} 
                  onChange={handleChange} 
                  placeholder="Enfermedades crónicas, cirugías previas, fracturas, transfusiones..."
                  rows="3"
                  readOnly={isReadOnly}
                  className={isReadOnly ? 'input-readonly' : ''}
                />
              </div>

              <div className="form-group-hc">
                <label>Antecedentes Personales No Patológicos (APNP):</label>
                <textarea 
                  name="apnp" 
                  value={formData.apnp} 
                  onChange={handleChange} 
                  placeholder="Tabaquismo, alcoholismo, tipo de vivienda, alimentación, esquema de vacunación..."
                  rows="3"
                  readOnly={isReadOnly}
                  className={isReadOnly ? 'input-readonly' : ''}
                />
              </div>

              <div className="form-group-hc">
                <label>Antecedentes Gineco-Obstétricos (AGO) - Opcional:</label>
                <textarea 
                  name="ago" 
                  value={formData.ago} 
                  onChange={handleChange} 
                  placeholder="Menarca, ritmo, G, P, C, A, métodos anticonceptivos..."
                  rows="2"
                  readOnly={isReadOnly}
                  className={isReadOnly ? 'input-readonly' : ''}
                />
              </div>

              <div className="form-group-hc">
                <label>Firma del responsable:</label>
                <input 
                  type="text" 
                  name="firma" 
                  value={formData.firma} 
                  readOnly
                  className="input-readonly"
                />
              </div>

              <div className='modal-actions-hc'>
                <button type="button" onClick={() => setIsModalOpen(false)} className='btn-cancelar'>
                  {isReadOnly ? 'Cerrar' : 'Cancelar'}
                </button>
                {!isReadOnly && (
                  <button type="submit" className='btn-guardar'><FaSave /> {isEditing ? 'Actualizar' : 'Guardar'}</button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PHc;