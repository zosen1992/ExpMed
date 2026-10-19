import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { ref, onValue, set, push, update, get, remove } from 'firebase/database';
import { FaArrowLeft, FaPlus, FaEdit, FaTimes, FaSave, FaEye, FaTrashAlt, FaLock } from 'react-icons/fa';
import { LuHeartPulse } from "react-icons/lu";
import { PiSealWarningDuotone } from "react-icons/pi";
import { estaVigenciaVencida } from '../utilidades/verificadorVigencia';
import '../Estilos/Sv.css';

// --- MOTOR DE VALIDACIÓN CLÍNICA ---
const evaluarSignosVitales = (edad, datos) => {
  let alertas = [];
  let flags = {};
  const { fc, fr, tas, tad, temp, spo2, glucosa } = datos;
  
  if (fc) {
      const v = parseFloat(fc);
      let bad = false;
      if (edad < 1 && (v < 100 || v > 160)) bad = true;
      else if (edad >= 1 && edad <= 5 && (v < 80 || v > 120)) bad = true;
      else if (edad > 5 && edad <= 12 && (v < 75 || v > 115)) bad = true;
      else if (edad > 12 && (v < 60 || v > 100)) bad = true;
      if(bad) { alertas.push(`FC (${v} lpm) anormal`); flags.fc = true; }
  }
  
  if (fr) {
      const v = parseFloat(fr);
      let bad = false;
      if (edad < 1 && (v < 30 || v > 50)) bad = true;
      else if (edad >= 1 && edad <= 5 && (v < 20 || v > 30)) bad = true;
      else if (edad > 5 && edad <= 12 && (v < 15 || v > 25)) bad = true;
      else if (edad > 12 && (v < 12 || v > 20)) bad = true;
      if(bad) { alertas.push(`FR (${v} rpm) anormal`); flags.fr = true; }
  }

  if (temp) {
      const v = parseFloat(temp);
      if (v < 36.0 || v > 37.5) { alertas.push(`Temp (${v} °C) anormal`); flags.temp = true; }
  }

  if (spo2) {
      const v = parseFloat(spo2);
      if (v < 94) { alertas.push(`SpO2 (${v}%) baja`); flags.spo2 = true; }
  }

  if (glucosa) {
      const v = parseFloat(glucosa);
      if (v < 70 || v > 110) { alertas.push(`Glucosa (${v} mg/dL) fuera de rango`); flags.glucosa = true; }
  }

  if (tas || tad) {
      const s = parseFloat(tas);
      const d = parseFloat(tad);
      let bad = false;
      if (edad > 12) {
          if ((s && (s < 90 || s > 130)) || (d && (d < 60 || d > 85))) bad = true;
      } else {
          if ((s && (s < 70 || s > 120)) || (d && (d < 50 || d > 80))) bad = true;
      }
      if(bad) { alertas.push(`TA (${tas || '-'}/${tad || '-'} mmHg) anormal`); flags.ta = true; }
  }

  return { hasAlerts: alertas.length > 0, messages: alertas, flags };
};

const Sv = () => {
  const { id } = useParams(); // UID del paciente
  const myuid = auth.currentUser?.uid; // UID del usuario logueado

  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nombreCapturista, setNombreCapturista] = useState("");
  const [nombrePx, setNombrePx] = useState("Paciente");
  const [edadPx, setEdadPx] = useState(25);
  const [vigenciaVencida, setVigenciaVencida] = useState(
    localStorage.getItem('vigenciaVencida') === 'true'
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [editPid, setEditPid] = useState(null);

  const [formData, setFormData] = useState({
    peso: '', talla: '', imc: '', tas: '', tad: '', 
    fc: '', fr: '', temp: '', spo2: '', glucosa: '', notas: '', firma: ''
  });

  const calcularEdad = (fechaString) => {
    if (!fechaString) return null;
    let fechaNacimiento = new Date(fechaString);
    if (isNaN(fechaNacimiento.getTime()) && fechaString.includes('/')) {
        const partes = fechaString.split('/');
        if (partes.length === 3) fechaNacimiento = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
    }
    if (isNaN(fechaNacimiento.getTime())) return null;
    const hoy = new Date();
    let edadCalc = hoy.getFullYear() - fechaNacimiento.getFullYear();
    if (hoy.getMonth() - fechaNacimiento.getMonth() < 0 || (hoy.getMonth() === fechaNacimiento.getMonth() && hoy.getDate() < fechaNacimiento.getDate())) edadCalc--;
    return edadCalc;
  };

  useEffect(() => {
    if (myuid && id) {
      // 1. Obtener nombre y estado de vigencia del usuario logueado
      const buscarUsuarioLogueado = async () => {
        const rolLocal = localStorage.getItem('rolActivo');
        const ramas = rolLocal 
          ? [rolLocal, 'medico', 'enfermeria', 'enfermero', 'enfemero', 'px', 'admin', 'otro'] 
          : ['medico', 'enfermeria', 'enfermero', 'enfemero', 'px', 'admin', 'otro'];
        for (const r of ramas) {
          const snap = await get(ref(db, `usuarios/${r}/${myuid}`));
          if (snap.exists()) {
            const val = snap.val();
            setNombreCapturista(val.nombre || val.nombrecom || auth.currentUser?.email || "Usuario");

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
      buscarUsuarioLogueado();

      // 2. Obtener Nombre y Edad del Paciente
      const pxRef = ref(db, `usuarios/px/${id}`);
      const unsubscribePx = onValue(pxRef, (snapshot) => {
        if (snapshot.exists()) {
           const val = snapshot.val();
           setNombrePx(val.nombre || val.nombrecom || "Paciente");
           const e = calcularEdad(val.fecha_nac || val.fechanacimiento);
           if (e !== null) setEdadPx(e);
        }
      });

      // 3. Registros de Signos Vitales
      const svRef = ref(db, `signosvitales/${id}`);
      const unsubscribeSv = onValue(svRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const registrosArray = Object.keys(data).map(key => ({
            pid: key, ...data[key]
          })).reverse(); 
          setRegistros(registrosArray);
        } else {
          setRegistros([]);
        }
        setCargando(false);
      });

      return () => { unsubscribePx(); unsubscribeSv(); };
    }
  }, [id, myuid]);

  const notificarMedicosAsignados = async (mensajesAlerta, fechaRegistro, svId) => {
    try {
      const relacionesSnap = await get(ref(db, 'px'));
      if (!relacionesSnap.exists()) return;

      const nodoPx = relacionesSnap.val();
      const medicosANotificar = [];

      Object.keys(nodoPx).forEach((uidMedico) => {
        const listaPacientesDelMedico = nodoPx[uidMedico];
        if (listaPacientesDelMedico && listaPacientesDelMedico[id]) {
          medicosANotificar.push(uidMedico);
        }
      });

      const promesasNotificacion = medicosANotificar.map((uidMedico) => {
        const nuevaNotifRef = push(ref(db, `notificaciones/${uidMedico}`));
        return set(nuevaNotifRef, {
          idNotif: nuevaNotifRef.key,
          uidMedico: uidMedico,
          uidPx: id,
          nombrePx: nombrePx,
          alertas: mensajesAlerta,
          detalleTexto: mensajesAlerta.join(', '),
          capturadoPor: formData.firma || nombreCapturista,
          uidCapturista: myuid,
          fecha: fechaRegistro,
          timestamp: Date.now(),
          leido: false,
          svPid: svId
        });
      });

      await Promise.all(promesasNotificacion);
    } catch (error) {
      console.error("Error al enviar notificaciones a los médicos:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'spo2' && value !== '') {
      const numSpo2 = parseFloat(value);
      if (numSpo2 > 100 || numSpo2 < 0) {
        return;
      }
    }

    let nuevosDatos = { ...formData, [name]: value };

    if (name === 'peso' || name === 'talla') {
      const p = parseFloat(name === 'peso' ? value : formData.peso);
      const t = parseFloat(name === 'talla' ? value : formData.talla);
      if (p > 0 && t > 0) nuevosDatos.imc = (p / (t * t)).toFixed(2);
      else nuevosDatos.imc = '';
    }
    setFormData(nuevosDatos);
  };

  const abrirModalNuevo = () => {
    if (vigenciaVencida) {
      return alert("⛔ Modo de solo lectura: Tu vigencia está vencida y no puedes registrar signos vitales.");
    }
    setIsEditing(false); setIsReadOnly(false); setEditPid(null);
    setFormData({
      peso: '', talla: '', imc: '', tas: '', tad: '', fc: '', fr: '', 
      temp: '', spo2: '', glucosa: '', notas: '', 
      firma: nombreCapturista || auth.currentUser?.email || 'Usuario'
    });
    setIsModalOpen(true);
  };

  const abrirModalEditar = (item, readOnly = false) => {
    if (vigenciaVencida) {
      if (item.uidcap !== myuid) {
        return alert("Con vigencia vencida solo puedes visualizar registros creados por ti.");
      }
      readOnly = true;
    }

    if (!readOnly && item.uidcap !== myuid) {
      return alert("Acceso denegado: Solo el usuario que agregó este registro de signos vitales puede editarlo.");
    }

    setIsEditing(!readOnly); 
    setIsReadOnly(readOnly); 
    setEditPid(item.pid);
    setFormData({
      peso: item.peso || '', talla: item.talla || '', imc: item.imc || '',
      tas: item.tas || '', tad: item.tad || '', fc: item.fc || '',
      fr: item.fr || '', temp: item.temp || '', spo2: item.spo2 || '',
      glucosa: item.glucosa || '', notas: item.notas || '', 
      firma: readOnly ? (item.firma || 'N/D') : (nombreCapturista || item.firma),
      uidcap: item.uidcap
    });
    setIsModalOpen(true);
  };

  const handleEliminar = async (item) => {
    if (vigenciaVencida) {
      return alert("⛔ Acción bloqueada: No puedes eliminar registros con vigencia vencida.");
    }
    if (item.uidcap !== myuid) {
      return alert("Acceso denegado: Solo el usuario que registró estos signos vitales puede eliminarlos.");
    }
    const confirmar = window.confirm("¿Estás seguro de que deseas eliminar este registro de signos vitales?");
    if (confirmar) {
      try {
        await remove(ref(db, `signosvitales/${id}/${item.pid}`));
        alert("Registro eliminado correctamente.");
      } catch (error) {
        console.error("Error al eliminar signos vitales:", error);
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

    if (formData.spo2 && parseFloat(formData.spo2) > 100) {
      return alert("La saturación de oxígeno (SpO2) no puede ser mayor a 100%.");
    }

    const evaluacion = evaluarSignosVitales(edadPx, formData);
    if (evaluacion.hasAlerts) {
        const mensaje = `⚠️ ADVERTENCIA CLÍNICA ⚠️\nSe detectaron parámetros fuera de rango:\n\n- ${evaluacion.messages.join('\n- ')}\n\nAl guardar, se enviará una notificación de alerta a los médicos asignados a este paciente.\n¿Desea continuar?`;
        const confirmar = window.confirm(mensaje);
        if (!confirmar) return;
    }

    try {
      const fechaActual = new Date().toLocaleString('es-MX', { 
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      const firmaFinal = formData.firma?.trim() || nombreCapturista || auth.currentUser?.email || "Usuario";
      let pidRegistro = editPid;

      if (isEditing) {
        if (formData.uidcap && formData.uidcap !== myuid) {
          return alert("No tienes permiso para editar este registro.");
        }
        const actualizacion = { 
          ...formData, 
          firma: firmaFinal,
          uidcap: myuid, 
          ultimaModificacion: fechaActual 
        };
        await update(ref(db, `signosvitales/${id}/${editPid}`), actualizacion);
      } else {
        const nuevoSvRef = push(ref(db, `signosvitales/${id}`));
        pidRegistro = nuevoSvRef.key;
        const nuevoSv = { 
          ...formData, 
          firma: firmaFinal,
          pid: pidRegistro, 
          uid: id, 
          uidcap: myuid, 
          fecha: fechaActual 
        };
        await set(nuevoSvRef, nuevoSv);
      }

      if (evaluacion.hasAlerts) {
        await notificarMedicosAsignados(evaluacion.messages, fechaActual, pidRegistro);
      }

      alert(
        evaluacion.hasAlerts 
          ? "Signos vitales guardados. Se ha enviado una alerta a los médicos tratantes." 
          : "Signos vitales guardados exitosamente."
      );
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error al guardar:", error);
    }
  };

  // Si la vigencia está vencida, solo muestra las tomas de signos vitales capturadas por este usuario
  const registrosVisibles = vigenciaVencida
    ? registros.filter((item) => item.uidcap === myuid)
    : registros;

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Cargando signos vitales...</div>;

  return (
    <div className='sv-container'>
      {vigenciaVencida && (
        <div style={{
          backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba',
          borderRadius: '10px', padding: '12px 16px', marginBottom: '18px',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <FaLock />
          <span>
            <strong>Modo Solo Lectura (Vigencia Vencida):</strong> Solo se muestran los registros de signos vitales capturados por ti. No puedes agregar, editar ni eliminar información.
          </span>
        </div>
      )}

      <div className='sv-header'>
        <Link to={`/px/${id}`} className='btn-regresar'>
          <FaArrowLeft /> Regresar al menú
        </Link>
        <h2 className='sv-titulo'><LuHeartPulse /> Signos Vitales y Somatometría</h2>
      </div>

      {registrosVisibles.length === 0 ? (
        <div className='empty-state'>
          <LuHeartPulse className='empty-icon' />
          <h3>{vigenciaVencida ? 'Sin registros propios de signos vitales' : 'Sin registros previos'}</h3>
          <p>
            {vigenciaVencida
              ? 'Con vigencia vencida solo puedes visualizar registros que hayan sido capturados por ti.'
              : 'No hay tomas de signos vitales capturadas para este paciente.'}
          </p>
          {!vigenciaVencida && (
            <button onClick={abrirModalNuevo} className='btn-agregar-main'>
              <FaPlus /> Registrar Signos Vitales
            </button>
          )}
        </div>
      ) : (
        <div className='lista-sv'>
          {!vigenciaVencida && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
               <button onClick={abrirModalNuevo} className='btn-agregar-small'>
                 <FaPlus /> Nuevo Registro
               </button>
            </div>
          )}

          {registrosVisibles.map((item) => {
            const ev = evaluarSignosVitales(edadPx, item);
            const esAutor = item.uidcap === myuid;

            return (
              <div key={item.pid} className={`sv-card ${ev.hasAlerts ? 'card-has-alerts' : ''}`}>
                <div className='sv-info'>
                  <h4 className='sv-fecha'>
                    Toma: {item.fecha}
                    {ev.hasAlerts && <span className='sv-alerta-icon' title={ev.messages.join('\n')}><PiSealWarningDuotone /> Anormal</span>}
                  </h4>
                  
                  <div className='sv-badges'>
                    {item.tas && item.tad && <span className={`badge ${ev.flags.ta ? 'badge-alert-pulse' : 'badge-blue'}`}>TA: {item.tas}/{item.tad} mmHg</span>}
                    {item.fc && <span className={`badge ${ev.flags.fc ? 'badge-alert-pulse' : 'badge-red'}`}>FC: {item.fc} lpm</span>}
                    {item.fr && <span className={`badge ${ev.flags.fr ? 'badge-alert-pulse' : 'badge-green'}`}>FR: {item.fr} rpm</span>}
                    {item.spo2 && <span className={`badge ${ev.flags.spo2 ? 'badge-alert-pulse' : 'badge-cyan'}`}>SpO2: {item.spo2}%</span>}
                    {item.temp && <span className={`badge ${ev.flags.temp ? 'badge-alert-pulse' : 'badge-orange'}`}>Temp: {item.temp} °C</span>}
                    {item.peso && <span className='badge badge-gray'>Peso: {item.peso} kg (IMC: {item.imc})</span>}
                    {item.glucosa && <span className={`badge ${ev.flags.glucosa ? 'badge-alert-pulse' : 'badge-purple'}`}>Gluc: {item.glucosa} mg/dL</span>}
                  </div>
                  
                  <p className='sv-firma'>
                    <strong>Registró:</strong> {item.firma || 'N/D'}
                  </p>
                </div>

                <div className='sv-acciones'>
                  <button onClick={() => abrirModalEditar(item, true)} className='btn-ver'>
                    <FaEye /> Ver
                  </button>

                  {/* SOLO EL AUTOR CON VIGENCIA ACTIVA PUEDE EDITAR O ELIMINAR */}
                  {esAutor && !vigenciaVencida && (
                    <>
                      <button onClick={() => abrirModalEditar(item, false)} className='btn-editar'>
                        <FaEdit /> Editar
                      </button>
                      <button 
                        onClick={() => handleEliminar(item)} 
                        className='btn-eliminar-sv'
                        style={{
                          backgroundColor: '#fceceb',
                          color: '#e74c3c',
                          border: 'none',
                          padding: '8px 15px',
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

      {/* MODAL DE REGISTRO */}
      {isModalOpen && (
        <div className='modal-overlay-sv'>
          <div className='modal-content-sv'>
            <div className='modal-header-sv'>
              <h3>{isReadOnly ? 'Detalle de Signos Vitales' : (isEditing ? 'Editar Signos Vitales' : 'Nuevo Registro')}</h3>
              <button onClick={() => setIsModalOpen(false)} className='btn-close'><FaTimes /></button>
            </div>
            
            <form onSubmit={handleGuardar} className='form-sv'>
              
              <h4 className='section-title'>Somatometría</h4>
              <div className='form-grid-3'>
                <div className="form-group-sv"><label>Peso (kg)</label><input type="number" step="0.01" name="peso" value={formData.peso} onChange={handleChange} readOnly={isReadOnly} /></div>
                <div className="form-group-sv"><label>Talla (metros, ej. 1.75)</label><input type="number" step="0.01" name="talla" value={formData.talla} onChange={handleChange} readOnly={isReadOnly} /></div>
                <div className="form-group-sv"><label>IMC (Auto)</label><input type="text" value={formData.imc} readOnly className="input-readonly-auto" placeholder="-" /></div>
              </div>

              <h4 className='section-title'>Signos Vitales</h4>
              <div className='form-grid-2'>
                <div className="form-group-sv">
                  <label>Tensión Arterial (Sistólica / Diastólica)</label>
                  <div style={{display: 'flex', gap: '5px', alignItems: 'center'}}>
                    <input type="number" name="tas" value={formData.tas} onChange={handleChange} placeholder="Sistólica" readOnly={isReadOnly} />
                    <span>/</span>
                    <input type="number" name="tad" value={formData.tad} onChange={handleChange} placeholder="Diastólica" readOnly={isReadOnly} />
                  </div>
                </div>
                <div className="form-group-sv"><label>Frecuencia Cardíaca (lpm)</label><input type="number" name="fc" value={formData.fc} onChange={handleChange} readOnly={isReadOnly} /></div>
                <div className="form-group-sv"><label>Frec. Respiratoria (rpm)</label><input type="number" name="fr" value={formData.fr} onChange={handleChange} readOnly={isReadOnly} /></div>
                <div className="form-group-sv"><label>Temperatura (°C)</label><input type="number" step="0.1" name="temp" value={formData.temp} onChange={handleChange} readOnly={isReadOnly} /></div>
                <div className="form-group-sv">
                  <label>Saturación O2 (%) [Máx 100]</label>
                  <input 
                    type="number" 
                    name="spo2" 
                    min="0" 
                    max="100" 
                    value={formData.spo2} 
                    onChange={handleChange} 
                    placeholder="0 - 100"
                    readOnly={isReadOnly} 
                  />
                </div>
              </div>

              <h4 className='section-title'>Laboratorio de Gabinete</h4>
              <div className='form-grid-3'>
                <div className="form-group-sv"><label>Glucosa Capilar (mg/dL)</label><input type="number" name="glucosa" value={formData.glucosa} onChange={handleChange} readOnly={isReadOnly} /></div>
              </div>

              <div className="form-group-sv" style={{marginTop: '10px'}}>
                <label>Notas / Observaciones:</label>
                <textarea name="notas" value={formData.notas} onChange={handleChange} rows="2" readOnly={isReadOnly} />
              </div>

              <div className='modal-actions-sv'>
                <span className="firma-sv">Capturó: {formData.firma || nombreCapturista}</span>
                <div style={{display: 'flex', gap: '10px'}}>
                  <button type="button" onClick={() => setIsModalOpen(false)} className='btn-cancelar'>{isReadOnly ? 'Cerrar' : 'Cancelar'}</button>
                  {!isReadOnly && !vigenciaVencida && (
                    <button type="submit" className='btn-guardar'><FaSave /> {isEditing ? 'Actualizar' : 'Guardar'}</button>
                  )}
                </div>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sv;