import React, { useEffect, useState } from 'react';
import "../Estilos/Menupx.css";
import { useParams, Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase'; 
import { onValue, ref, get } from 'firebase/database';
import { signOut } from 'firebase/auth';
import { GiBookPile } from "react-icons/gi";
import { GoBook } from "react-icons/go";
import { PiSealWarningDuotone } from "react-icons/pi";
import { LuHeartPulse } from "react-icons/lu";
import { MdOutlineBloodtype, MdNotificationsActive, MdOutlineBackspace } from "react-icons/md";
import { FcInfo } from "react-icons/fc";
import { FaHome, FaPhoneAlt, FaEnvelope, FaMapMarkerAlt, FaBirthdayCake, FaSignOutAlt, FaUserMd, FaSyringe, FaCalendarCheck, FaComments } from "react-icons/fa";
//import { MdOutlineEmojiPeople, MdOutlineGroups, MdNotificationsActive, MdAdminPanelSettings, MdChatBubbleOutline } from "react-icons/md";

function Menupx() {
    const { id } = useParams();
    const navigate = useNavigate();
    const myuid = auth.currentUser?.uid;

    const [paciente, setPaciente] = useState({});
    const [cargando, setCargando] = useState(true);
    const [tieneAlergias, setTieneAlergias] = useState(false);
    const [noLeidasPx, setNoLeidasPx] = useState(0);
    const [rolActual, setRolActual] = useState(localStorage.getItem('rolActivo') || '');

    useEffect(() => {
        const verificarRol = async () => {
            if (!myuid) return;
            const rolGuardado = localStorage.getItem('rolActivo');
            const ramas = rolGuardado 
                ? [rolGuardado, 'medico', 'enfermeria', 'enfermero', 'enfemero', 'px', 'admin', 'otro'] 
                : ['medico', 'enfermeria', 'enfermero', 'enfemero', 'px', 'admin', 'otro'];

            for (const r of ramas) {
                const snap = await get(ref(db, `usuarios/${r}/${myuid}`));
                if (snap.exists()) {
                    const data = snap.val();
                    const rolDetectado = (data.rol || r).toLowerCase();
                    if (r === 'enfermeria' || r === 'enfermero' || r === 'enfemero' || rolDetectado.includes('enfermer')) {
                        setRolActual('enfermeria');
                    } else if (r === 'px' || rolDetectado === 'px') {
                        setRolActual('px');
                        if (id !== myuid) {
                            navigate(`/px/${myuid}`, { replace: true });
                        }
                    } else {
                        setRolActual(r);
                    }
                    break;
                }
            }
        };
        verificarRol();
    }, [myuid, id, navigate]);

    useEffect(() => {
        if (id) {
            const pxRef = ref(db, `usuarios/px/${id}`);
            const unsubscribePx = onValue(pxRef, (snapshot) => {
                if (snapshot.exists()) {
                    setPaciente(snapshot.val());
                } else {
                    setPaciente({});
                }
                setCargando(false);
            });

            const alergiasRef = ref(db, `alergias/${id}`);
            const unsubscribeAlergias = onValue(alergiasRef, (snapshot) => {
                setTieneAlergias(snapshot.exists());
            });

            // Escuchar las notificaciones del paciente para mostrar contador de no leídas
            const notifRef = ref(db, `notificaciones/${id}`);
            const unsubscribeNotif = onValue(notifRef, (snapshot) => {
                if (snapshot.exists()) {
                    const lista = Object.values(snapshot.val());
                    setNoLeidasPx(lista.filter(n => !n.leido).length);
                } else {
                    setNoLeidasPx(0);
                }
            });

            return () => {
                unsubscribePx();
                unsubscribeAlergias();
                unsubscribeNotif();
            };
        }
    }, [id]);

    const handleCerrarSesionPx = async () => {
        try {
            localStorage.removeItem('rolActivo');
            localStorage.removeItem('vigenciaVencida');
            await signOut(auth);
            navigate('/login', { replace: true });
        } catch (error) {
            console.error("Error al salir:", error);
        }
    };

    const calcularEdad = (fechaString) => {
        if (!fechaString) return 0;
        let fechaNacimiento = new Date(fechaString);
        if (isNaN(fechaNacimiento.getTime()) && fechaString.includes('/')) {
            const partes = fechaString.split('/');
            if (partes.length === 3) fechaNacimiento = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
        }
        if (isNaN(fechaNacimiento.getTime())) return 0;
        const hoy = new Date();
        let edadCalc = hoy.getFullYear() - fechaNacimiento.getFullYear();
        const diferenciaMes = hoy.getMonth() - fechaNacimiento.getMonth();
        if (diferenciaMes < 0 || (diferenciaMes === 0 && hoy.getDate() < fechaNacimiento.getDate())) edadCalc--;
        return edadCalc;
    };

    const edad = calcularEdad(paciente.fecha_nac || paciente.fechanacimiento);

    const esUsuarioPx = rolActual === 'px';
    const esEnfermeria = rolActual === 'enfermeria' || rolActual.includes('enfermer');

    if (cargando) return <div style={{textAlign: 'center', marginTop: '50px'}}>Cargando expediente...</div>;

    return (
        <div className='menupx-container'>
            
            {/* BARRA SUPERIOR */}
            <div className='menupx-header'>
                {!esUsuarioPx ? (
                    <>
                        <Link to={`/`} className='btn-nav'><FaHome/> Menú Principal</Link>
                        <Link to={`/listapx`} className='btn-nav btn-back'><MdOutlineBackspace/> Regresar a Pacientes</Link>
                    </>
                ) : (
                    <button onClick={handleCerrarSesionPx} className='btn-nav' style={{ cursor: 'pointer', color: '#e74c3c', borderColor: '#f5b7b1', backgroundColor: '#fceceb', marginLeft: 'auto' }}>
                        <FaSignOutAlt /> Cerrar Sesión
                    </button>
                )}
            </div>

            <div className='menupx-layout'>
                <aside className='px-profile-card'>
            <img 
                        src={
                            paciente.fotoperfil && paciente.fotoperfil !== 'null' 
                                ? paciente.fotoperfil 
                                : 'https://cdn-icons-png.flaticon.com/512/387/387561.png'
                        } 
                        alt="Perfil Paciente" 
                        className='px-avatar'
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://cdn-icons-png.flaticon.com/512/387/387561.png';
                        }}
                    />
                    
                    <h2 className='px-name'>
                        {paciente.nombre || paciente.nombrecom}
                        {tieneAlergias && (
                            <Link to={`/alergias/${id}`} className='alerta-alergia-link' title="Ver Alergias Registradas">
                                <PiSealWarningDuotone />
                            </Link>
                        )}
                    </h2>
                    
                    <span className='px-age'>{edad} años</span>

                    <div className='px-info-list'>
                        <div className='px-info-item'><FaBirthdayCake className="info-icon"/> {paciente.fecha_nac || paciente.fechanacimiento || 'N/D'}</div>
                        <div className='px-info-item'><FaPhoneAlt className="info-icon"/> {paciente.num_cel || paciente.celular || 'Sin celular'}</div>
                        <div className='px-info-item'><FaEnvelope className="info-icon"/> <span className="truncate-text">{paciente.correo || 'Sin correo'}</span></div>
                        <div className='px-info-item'><FaMapMarkerAlt className="info-icon"/> {paciente.localidad || 'Sin ubicación'}</div>
                    </div>
                </aside>

                <main className='px-actions-grid'>
                    {/* HISTORIA CLÍNICA: Solo Médico / Admin */}
                    {!esUsuarioPx && !esEnfermeria && (
                        <Link to={`/PHc/${id}`} className='action-card'>        
                            <GiBookPile className='action-icon text-primary'/>
                            <span className='action-title'>Historia Clínica</span>
                        </Link>
                    )}

                    <Link to={`/chat`} className='action-card'>        
                             <FaComments className='action-icon text-primary'/>
                             <span className='action-title'>Chat Médico</span>
                         </Link>

                    {/* VISITA MÉDICA (Personal clínico) vs PROCEDIMIENTOS (Paciente) */}
                    {!esUsuarioPx ? (
                        <Link to={`/consulta/${id}`} className='action-card'>        
                            <GoBook className='action-icon text-success'/>
                            <span className='action-title'>Visita Médica</span>
                        </Link>
                    ) : (
                        <Link to={`/consulta/${id}`} className='action-card'>        
                            <FaSyringe className='action-icon text-success'/>
                            <span className='action-title'>Procedimientos</span>
                        </Link>
                    )}

                    <Link to={`/alergias/${id}`} className={`action-card ${tieneAlergias ? 'card-alerta' : ''}`}>        
                        <PiSealWarningDuotone className={`action-icon ${tieneAlergias ? 'text-danger' : 'text-secondary'}`}/>
                        <span className='action-title'>Alergias</span>
                        {tieneAlergias && <span className='badge-alerta'>¡Atención!</span>}
                    </Link>

                    <Link to={`/sv/${id}`} className='action-card'>        
                        <LuHeartPulse className='action-icon text-warning'/>
                        <span className='action-title'>Signos Vitales</span>
                    </Link>

                    <Link to={`/Estudios/${id}`} className='action-card'>        
                        <MdOutlineBloodtype className='action-icon text-info'/>
                        <span className='action-title'>Estudios</span>
                    </Link>

                    <Link to={`/Datospx/${id}`} className='action-card'>        
                        <FcInfo className='action-icon'/>
                        <span className='action-title'>Información Gral.</span>
                    </Link>

                    {/* CITAS DEL PACIENTE */}
                    <Link to={`/mis-citas/${id}`} className='action-card'>        
                        <FaCalendarCheck className='action-icon text-primary'/>
                        <span className='action-title'>{esUsuarioPx ? 'Mis Citas' : 'Citas del Paciente'}</span>
                    </Link>

                    {/* APARTADO EXCLUSIVO CUANDO EL PACIENTE ACCEDE: HISTORIAL DE NOTIFICACIONES Y BUSCAR PROFESIONAL */}
                    {esUsuarioPx && (
                        <>
                            <Link to={`/notificaciones`} className='action-card' style={{ position: 'relative' }}>        
                                <MdNotificationsActive className='action-icon' style={{ color: noLeidasPx > 0 ? '#e74c3c' : '#3498db' }}/>
                                <span className='action-title'>Notificaciones</span>
                                {noLeidasPx > 0 && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '12px',
                                        right: '12px',
                                        backgroundColor: '#e74c3c',
                                        color: 'white',
                                        fontSize: '0.78rem',
                                        fontWeight: 'bold',
                                        padding: '3px 9px',
                                        borderRadius: '20px',
                                        boxShadow: '0 2px 6px rgba(231, 76, 60, 0.4)'
                                    }}>
                                        {noLeidasPx} nueva{noLeidasPx > 1 ? 's' : ''}
                                    </span>
                                )}
                            </Link>

                            <Link to={`/buscar-profesional`} className='action-card'>        
                                <FaUserMd className='action-icon text-primary'/>
                                <span className='action-title'>Buscar Profesional</span>
                            </Link>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}

export default Menupx;